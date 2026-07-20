import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

export type ApiKeyScope = "read" | "write";

type StoredApiKey = {
  id: string;
  ownerUserId: string;
  name: string;
  prefix: string;
  secretHash: string;
  scopes: ApiKeyScope[];
  createdAt: string;
  expiresAt: string | null;
  lastUsedAt: string | null;
};

type StoredApiKeys = { keys: StoredApiKey[] };
export type PublicApiKey = Omit<StoredApiKey, "ownerUserId" | "secretHash">;

export class LocalApiKeyStore {
  private readonly keysFile: string;

  constructor({ root }: { root: string }) {
    this.keysFile = join(root, "v1", "auth", "api-keys.json");
  }

  async create({ ownerUserId, name, scopes, expiresAt }: { ownerUserId: string; name: string; scopes: ApiKeyScope[]; expiresAt: string | null }): Promise<PublicApiKey & { apiKey: string }> {
    const id = randomUUID();
    const apiKey = `zdk_${id.replaceAll("-", "")}_${randomBytes(32).toString("base64url")}`;
    const stored: StoredApiKey = { id, ownerUserId, name, prefix: apiKey.slice(0, 20), secretHash: hash(apiKey), scopes: [...new Set(scopes)].sort() as ApiKeyScope[], createdAt: new Date().toISOString(), expiresAt, lastUsedAt: null };
    const data = await this.read();
    data.keys.push(stored);
    await this.write(data);
    return { ...publicKey(stored), apiKey };
  }

  async list(ownerUserId: string): Promise<PublicApiKey[]> {
    return (await this.read()).keys.filter((key) => key.ownerUserId === ownerUserId).map(publicKey).sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  async revoke({ id, ownerUserId }: { id: string; ownerUserId: string }): Promise<boolean> {
    const data = await this.read();
    const index = data.keys.findIndex((key) => key.id === id && key.ownerUserId === ownerUserId);
    if (index === -1) return false;
    data.keys.splice(index, 1);
    await this.write(data);
    return true;
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

  async userIdFromRequest(request: Request): Promise<string | null> {
    const authorization = request.headers.get("authorization");
    const apiKey = authorization?.match(/^Bearer (zdk_[A-Za-z0-9_-]+)$/)?.[1];
    const path = new URL(request.url).pathname;
    if (!apiKey || path.startsWith("/api-keys") || path.startsWith("/auth/")) return null;
    const data = await this.read();
    const requestHash = hash(apiKey);
    const stored = data.keys.find((key) => hashesMatch(key.secretHash, requestHash));
    if (!stored || (stored.expiresAt && new Date(stored.expiresAt).getTime() <= Date.now())) return null;
    const required: ApiKeyScope = ["GET", "HEAD", "OPTIONS"].includes(request.method) ? "read" : "write";
    if (!stored.scopes.includes(required)) return null;
    if (!stored.lastUsedAt || Date.now() - new Date(stored.lastUsedAt).getTime() > 60_000) {
      stored.lastUsedAt = new Date().toISOString();
      await this.write(data);
    }
    return stored.ownerUserId;
  }

  async removeByOwner(ownerUserId: string): Promise<void> {
    const data = await this.read();
    data.keys = data.keys.filter((key) => key.ownerUserId !== ownerUserId);
    await this.write(data);
  }

  private async read(): Promise<StoredApiKeys> {
    try {
      const data = JSON.parse(await readFile(this.keysFile, "utf8")) as StoredApiKeys;
      return Array.isArray(data.keys) ? data : { keys: [] };
    } catch (error: unknown) {
      if (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT") return { keys: [] };
      throw error;
    }
  }

  private async write(data: StoredApiKeys): Promise<void> {
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

function publicKey(key: StoredApiKey): PublicApiKey {
  const { ownerUserId: _ownerUserId, secretHash: _secretHash, ...value } = key;
  return value;
}
