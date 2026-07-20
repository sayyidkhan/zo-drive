import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

export type DatabaseApiKeyScope = "read" | "write";

type StoredDatabaseApiKey = {
  id: string;
  ownerUserId: string;
  databaseId: string;
  name: string;
  prefix: string;
  secretHash: string;
  scopes: DatabaseApiKeyScope[];
  createdAt: string;
  expiresAt: string | null;
  lastUsedAt: string | null;
};

type StoredDatabaseApiKeys = { keys: StoredDatabaseApiKey[] };
export type PublicDatabaseApiKey = Omit<StoredDatabaseApiKey, "ownerUserId" | "secretHash">;

export class LocalDatabaseApiKeyStore {
  private readonly keysFile: string;

  constructor({ root }: { root: string }) {
    this.keysFile = join(root, "v1", "databases", "api-keys.json");
  }

  async create({ ownerUserId, databaseId, name, scopes, expiresAt }: { ownerUserId: string; databaseId: string; name: string; scopes: DatabaseApiKeyScope[]; expiresAt: string | null }): Promise<PublicDatabaseApiKey & { apiKey: string }> {
    const id = randomUUID();
    const apiKey = `zdb_${id.replaceAll("-", "")}_${randomBytes(32).toString("base64url")}`;
    const stored: StoredDatabaseApiKey = {
      id,
      ownerUserId,
      databaseId,
      name,
      prefix: apiKey.slice(0, 20),
      secretHash: hash(apiKey),
      scopes: [...new Set(scopes)].sort() as DatabaseApiKeyScope[],
      createdAt: new Date().toISOString(),
      expiresAt,
      lastUsedAt: null
    };
    const data = await this.read();
    data.keys.push(stored);
    await this.write(data);
    return { ...publicKey(stored), apiKey };
  }

  async list({ ownerUserId, databaseId }: { ownerUserId: string; databaseId: string }): Promise<PublicDatabaseApiKey[]> {
    return (await this.read()).keys
      .filter((key) => key.ownerUserId === ownerUserId && key.databaseId === databaseId)
      .map(publicKey)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  async revoke({ id, ownerUserId, databaseId }: { id: string; ownerUserId: string; databaseId: string }): Promise<boolean> {
    const data = await this.read();
    const index = data.keys.findIndex((key) => key.id === id && key.ownerUserId === ownerUserId && key.databaseId === databaseId);
    if (index === -1) return false;
    data.keys.splice(index, 1);
    await this.write(data);
    return true;
  }

  async authorize(request: Request, requiredScope: DatabaseApiKeyScope): Promise<{ ownerUserId: string; databaseId: string } | null> {
    const authorization = request.headers.get("authorization");
    const apiKey = authorization?.match(/^Bearer (zdb_[A-Za-z0-9_-]+)$/)?.[1];
    if (!apiKey) return null;
    const data = await this.read();
    const stored = data.keys.find((key) => hashesMatch(key.secretHash, hash(apiKey)));
    if (!stored || !stored.scopes.includes(requiredScope) || (stored.expiresAt && new Date(stored.expiresAt).getTime() <= Date.now())) return null;
    if (!stored.lastUsedAt || Date.now() - new Date(stored.lastUsedAt).getTime() > 60_000) {
      stored.lastUsedAt = new Date().toISOString();
      await this.write(data);
    }
    return { ownerUserId: stored.ownerUserId, databaseId: stored.databaseId };
  }

  async removeByDatabase({ ownerUserId, databaseId }: { ownerUserId: string; databaseId: string }): Promise<void> {
    const data = await this.read();
    data.keys = data.keys.filter((key) => key.ownerUserId !== ownerUserId || key.databaseId !== databaseId);
    await this.write(data);
  }

  async renameOwner({ fromUserId, toUserId }: { fromUserId: string; toUserId: string }): Promise<void> {
    const data = await this.read();
    let changed = false;
    for (const key of data.keys) {
      if (key.ownerUserId === fromUserId) {
        key.ownerUserId = toUserId;
        changed = true;
      }
    }
    if (changed) await this.write(data);
  }

  async removeByOwner(ownerUserId: string): Promise<void> {
    const data = await this.read();
    data.keys = data.keys.filter((key) => key.ownerUserId !== ownerUserId);
    await this.write(data);
  }

  private async read(): Promise<StoredDatabaseApiKeys> {
    try {
      const data = JSON.parse(await readFile(this.keysFile, "utf8")) as StoredDatabaseApiKeys;
      return Array.isArray(data.keys) ? data : { keys: [] };
    } catch (error: unknown) {
      if (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT") return { keys: [] };
      throw error;
    }
  }

  private async write(data: StoredDatabaseApiKeys): Promise<void> {
    await mkdir(dirname(this.keysFile), { recursive: true });
    const temporary = `${this.keysFile}.${randomUUID()}.tmp`;
    await writeFile(temporary, JSON.stringify(data, null, 2), { encoding: "utf8", mode: 0o600 });
    await rename(temporary, this.keysFile);
  }
}

function hash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function hashesMatch(left: string, right: string): boolean {
  const leftBytes = Buffer.from(left, "utf8");
  const rightBytes = Buffer.from(right, "utf8");
  return leftBytes.length === rightBytes.length && timingSafeEqual(leftBytes, rightBytes);
}

function publicKey(key: StoredDatabaseApiKey): PublicDatabaseApiKey {
  const { ownerUserId: _ownerUserId, secretHash: _secretHash, ...value } = key;
  return value;
}
