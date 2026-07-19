import { randomUUID, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);

export type ShareAccess = "public" | "passcode";

export type StoredShare = {
  id: string;
  ownerUserId: string;
  key: string;
  access: ShareAccess;
  passcodeHash: string | null;
  expiresAt: string | null;
  createdAt: string;
};

type StoredShares = { shares: StoredShare[] };

/** Share-link metadata is stored outside user files so it can be revoked safely. */
export class LocalShareStore {
  private readonly sharesFile: string;

  constructor({ root }: { root: string }) {
    this.sharesFile = join(root, "v1", "shares", "shares.json");
  }

  async create({ ownerUserId, key, access, passcode, expiresAt }: { ownerUserId: string; key: string; access: ShareAccess; passcode?: string; expiresAt: string | null }): Promise<StoredShare> {
    const shares = await this.readShares();
    const share: StoredShare = {
      id: randomUUID(),
      ownerUserId,
      key,
      access,
      passcodeHash: access === "passcode" && passcode ? await hashSecret(passcode) : null,
      expiresAt,
      createdAt: new Date().toISOString()
    };
    shares.shares.push(share);
    await this.writeShares(shares);
    return share;
  }

  async findActive(id: string): Promise<StoredShare | null> {
    const share = (await this.readShares()).shares.find((candidate) => candidate.id === id);
    return share && !isExpired(share) ? share : null;
  }

  async listByOwner(ownerUserId: string): Promise<StoredShare[]> {
    return (await this.readShares()).shares.filter((share) => share.ownerUserId === ownerUserId && !isExpired(share)).sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  async remove({ id, ownerUserId }: { id: string; ownerUserId: string }): Promise<boolean> {
    const shares = await this.readShares();
    const before = shares.shares.length;
    shares.shares = shares.shares.filter((share) => !(share.id === id && share.ownerUserId === ownerUserId));
    if (shares.shares.length === before) return false;
    await this.writeShares(shares);
    return true;
  }

  async removeByOwner(ownerUserId: string): Promise<void> {
    const shares = await this.readShares();
    shares.shares = shares.shares.filter((share) => share.ownerUserId !== ownerUserId);
    await this.writeShares(shares);
  }

  async verifyPasscode(share: StoredShare, passcode: string | null | undefined): Promise<boolean> {
    return share.access === "public" || Boolean(passcode && share.passcodeHash && await verifySecret(passcode, share.passcodeHash));
  }

  private async readShares(): Promise<StoredShares> {
    try {
      const parsed = JSON.parse(await readFile(this.sharesFile, "utf8")) as StoredShares;
      return Array.isArray(parsed.shares) ? parsed : { shares: [] };
    } catch (error: unknown) {
      if (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT") return { shares: [] };
      throw error;
    }
  }

  private async writeShares(shares: StoredShares): Promise<void> {
    await mkdir(dirname(this.sharesFile), { recursive: true });
    const temporaryFile = `${this.sharesFile}.${randomUUID()}.tmp`;
    await writeFile(temporaryFile, JSON.stringify(shares, null, 2), { encoding: "utf8", mode: 0o600 });
    await rename(temporaryFile, this.sharesFile);
  }
}

function isExpired(share: StoredShare): boolean {
  return Boolean(share.expiresAt && new Date(share.expiresAt).getTime() <= Date.now());
}

async function hashSecret(secret: string): Promise<string> {
  const salt = randomUUID();
  const hash = (await scrypt(secret, salt, 64)) as Buffer;
  return `${salt}:${hash.toString("hex")}`;
}

async function verifySecret(secret: string, storedHash: string): Promise<boolean> {
  const [salt, expectedHash] = storedHash.split(":");
  if (!salt || !expectedHash) return false;
  const calculated = (await scrypt(secret, salt, 64)) as Buffer;
  const expected = Buffer.from(expectedHash, "hex");
  return expected.length === calculated.length && timingSafeEqual(expected, calculated);
}
