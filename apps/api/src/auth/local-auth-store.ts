import { randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);

export type AuthenticatedUser = {
  id: string;
  username: string;
};

type StoredUser = AuthenticatedUser & {
  passwordHash: string;
  createdAt: string;
};

type StoredUsers = {
  users: StoredUser[];
};

/**
 * File-backed owner account store. It intentionally lives beside the external
 * drive data, never in source control. Registration is bootstrap-only.
 */
export class LocalAuthStore {
  private readonly usersFile: string;

  constructor({ root }: { root: string }) {
    this.usersFile = join(root, "v1", "auth", "users.json");
  }

  async hasUsers(): Promise<boolean> {
    return (await this.readUsers()).users.length > 0;
  }

  async registerInitialUser({ username, password }: { username: string; password: string }): Promise<AuthenticatedUser | null> {
    const users = await this.readUsers();
    if (users.users.length > 0) return null;

    const normalizedUsername = normalizeUsername(username);
    const user: StoredUser = {
      id: randomUUID(),
      username: normalizedUsername,
      passwordHash: await hashPassword(password),
      createdAt: new Date().toISOString()
    };
    users.users.push(user);
    await this.writeUsers(users);
    return publicUser(user);
  }

  async authenticate({ username, password }: { username: string; password: string }): Promise<AuthenticatedUser | null> {
    const user = (await this.readUsers()).users.find((candidate) => candidate.username === normalizeUsername(username));
    if (!user || !(await verifyPassword(password, user.passwordHash))) return null;
    return publicUser(user);
  }

  async findById(id: string): Promise<AuthenticatedUser | null> {
    const user = (await this.readUsers()).users.find((candidate) => candidate.id === id);
    return user ? publicUser(user) : null;
  }

  async updateUsername(id: string, username: string): Promise<AuthenticatedUser | null> {
    const users = await this.readUsers();
    const user = users.users.find((candidate) => candidate.id === id);
    const normalizedUsername = normalizeUsername(username);
    if (!user || users.users.some((candidate) => candidate.id !== id && candidate.username === normalizedUsername)) return null;
    user.username = normalizedUsername;
    await this.writeUsers(users);
    return publicUser(user);
  }

  async verifyPasswordForUser(id: string, password: string): Promise<boolean> {
    const user = (await this.readUsers()).users.find((candidate) => candidate.id === id);
    return Boolean(user && await verifyPassword(password, user.passwordHash));
  }

  async changePassword(id: string, currentPassword: string, newPassword: string): Promise<boolean> {
    const users = await this.readUsers();
    const user = users.users.find((candidate) => candidate.id === id);
    if (!user || !(await verifyPassword(currentPassword, user.passwordHash))) return false;
    user.passwordHash = await hashPassword(newPassword);
    await this.writeUsers(users);
    return true;
  }

  async removeUser(id: string): Promise<void> {
    const users = await this.readUsers();
    const index = users.users.findIndex((candidate) => candidate.id === id);
    if (index === -1) return;
    users.users.splice(index, 1);
    await this.writeUsers(users);
  }

  private async readUsers(): Promise<StoredUsers> {
    try {
      const contents = await readFile(this.usersFile, "utf8");
      const parsed = JSON.parse(contents) as StoredUsers;
      return Array.isArray(parsed.users) ? parsed : { users: [] };
    } catch (error: unknown) {
      if (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT") return { users: [] };
      throw error;
    }
  }

  private async writeUsers(users: StoredUsers): Promise<void> {
    await mkdir(dirname(this.usersFile), { recursive: true });
    const temporaryFile = `${this.usersFile}.${randomUUID()}.tmp`;
    await writeFile(temporaryFile, JSON.stringify(users, null, 2), { encoding: "utf8", mode: 0o600 });
    await rename(temporaryFile, this.usersFile);
  }
}

function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

function publicUser(user: StoredUser): AuthenticatedUser {
  return { id: user.id, username: user.username };
}

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const hash = (await scrypt(password, salt, 64)) as Buffer;
  return `${salt}:${hash.toString("hex")}`;
}

async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const [salt, expectedHash] = storedHash.split(":");
  if (!salt || !expectedHash) return false;
  const calculatedHash = (await scrypt(password, salt, 64)) as Buffer;
  const expected = Buffer.from(expectedHash, "hex");
  return expected.length === calculatedHash.length && timingSafeEqual(expected, calculatedHash);
}
