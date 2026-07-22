import { randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);
export type AuthenticatedUser = {
  id: string;
  username: string;
  access: "read" | "write";
  role: "regular" | "super";
  isOwner: boolean;
  createdAt: string;
};

type StoredUser = Omit<AuthenticatedUser, "access" | "role" | "isOwner"> & {
  accountOwnerId?: string;
  access?: "read" | "write";
  role?: "regular" | "super";
  isOwner?: boolean;
  passwordHash: string;
};

type StoredUsers = {
  users: StoredUser[];
};

/** File-backed account store. The bootstrap user remains the immutable owner. */
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
      id: normalizedUsername,
      username: normalizedUsername,
      passwordHash: await hashPassword(password),
      createdAt: new Date().toISOString(),
      accountOwnerId: normalizedUsername,
      access: "write",
      role: "super",
      isOwner: true
    };
    users.users.push(user);
    await this.writeUsers(users);
    return publicUser(user, users.users);
  }

  async authenticate({ username, password }: { username: string; password: string }): Promise<AuthenticatedUser | null> {
    const users = await this.readUsers();
    const user = users.users.find((candidate) => candidate.username === normalizeUsername(username));
    if (!user || !(await verifyPassword(password, user.passwordHash))) return null;
    return publicUser(user, users.users);
  }

  async findById(id: string): Promise<AuthenticatedUser | null> {
    const users = await this.readUsers();
    const user = users.users.find((candidate) => candidate.id === id);
    return user ? publicUser(user, users.users) : null;
  }

  async renameUser(id: string, username: string): Promise<AuthenticatedUser | null> {
    const users = await this.readUsers();
    const user = users.users.find((candidate) => candidate.id === id);
    const normalizedUsername = normalizeUsername(username);
    if (!user || users.users.some((candidate) => candidate.id !== id && (candidate.id === normalizedUsername || candidate.username === normalizedUsername))) return null;
    user.id = normalizedUsername;
    user.username = normalizedUsername;
    if (user.isOwner) {
      for (const member of users.users) {
        if (member.accountOwnerId === id) member.accountOwnerId = normalizedUsername;
      }
    }
    await this.writeUsers(users);
    return publicUser(user, users.users);
  }

  async listAccountMembers(userId: string): Promise<AuthenticatedUser[] | null> {
    const users = await this.readUsers();
    const user = users.users.find((candidate) => candidate.id === userId);
    if (!user) return null;
    const ownerId = accountOwnerId(user, users.users);
    return users.users
      .filter((candidate) => accountOwnerId(candidate, users.users) === ownerId)
      .sort((left, right) => Number(Boolean(right.isOwner)) - Number(Boolean(left.isOwner)) || left.username.localeCompare(right.username))
      .map((member) => publicUser(member, users.users));
  }

  async createAccountMember(actorId: string, { username, password, access, role }: { username: string; password: string; access: "read" | "write"; role: "regular" | "super" }): Promise<AuthenticatedUser | null> {
    const users = await this.readUsers();
    const actor = users.users.find((candidate) => candidate.id === actorId);
    if (!actor || !canManage(actor, users.users)) return null;
    const normalizedUsername = normalizeUsername(username);
    if (users.users.some((candidate) => candidate.id === normalizedUsername || candidate.username === normalizedUsername)) return null;
    const user: StoredUser = {
      id: normalizedUsername,
      username: normalizedUsername,
      passwordHash: await hashPassword(password),
      createdAt: new Date().toISOString(),
      accountOwnerId: accountOwnerId(actor, users.users),
      access,
      role,
      isOwner: false
    };
    users.users.push(user);
    await this.writeUsers(users);
    return publicUser(user, users.users);
  }

  async updateAccountMember(actorId: string, memberId: string, changes: { access?: "read" | "write"; role?: "regular" | "super" }): Promise<AuthenticatedUser | "forbidden" | null> {
    const users = await this.readUsers();
    const actor = users.users.find((candidate) => candidate.id === actorId);
    const member = users.users.find((candidate) => candidate.id === memberId);
    if (!actor || !member || !canManage(actor, users.users) || accountOwnerId(actor, users.users) !== accountOwnerId(member, users.users)) return null;
    if (member.isOwner) return "forbidden";
    if (changes.access) member.access = changes.access;
    if (changes.role) member.role = changes.role;
    await this.writeUsers(users);
    return publicUser(member, users.users);
  }

  async removeAccountMember(actorId: string, memberId: string): Promise<"removed" | "forbidden" | "not_found"> {
    const users = await this.readUsers();
    const actor = users.users.find((candidate) => candidate.id === actorId);
    const index = users.users.findIndex((candidate) => candidate.id === memberId);
    const member = index >= 0 ? users.users[index] : null;
    if (!member) return "not_found";
    if (!actor || !canManage(actor, users.users) || accountOwnerId(actor, users.users) !== accountOwnerId(member, users.users)) return "not_found";
    if (member.isOwner) return "forbidden";
    users.users.splice(index, 1);
    await this.writeUsers(users);
    return "removed";
  }

  async accountOwnerIdFor(userId: string, requiredAccess: "read" | "write" = "read"): Promise<string | null> {
    const users = await this.readUsers();
    const user = users.users.find((candidate) => candidate.id === userId);
    if (!user) return null;
    const normalized = normaliseStoredUser(user, users.users);
    if (requiredAccess === "write" && normalized.access !== "write") return null;
    return normalized.accountOwnerId;
  }

  async canManageUsers(userId: string): Promise<boolean> {
    const users = await this.readUsers();
    const user = users.users.find((candidate) => candidate.id === userId);
    return Boolean(user && canManage(user, users.users));
  }

  async isAccountOwner(userId: string): Promise<boolean> {
    const users = await this.readUsers();
    return Boolean(users.users.find((candidate) => candidate.id === userId)?.isOwner);
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

  async removeAccount(ownerId: string): Promise<void> {
    const users = await this.readUsers();
    const owner = users.users.find((candidate) => candidate.id === ownerId);
    if (!owner?.isOwner) return;
    users.users = users.users.filter((candidate) => accountOwnerId(candidate, users.users) !== ownerId);
    await this.writeUsers(users);
  }

  private async readUsers(): Promise<StoredUsers> {
    try {
      const contents = await readFile(this.usersFile, "utf8");
      const parsed = JSON.parse(contents) as StoredUsers;
      if (!Array.isArray(parsed.users)) return { users: [] };
      const users = parsed.users.map((user, index, all) => normaliseStoredUser(user, all, index === 0));
      return { users };
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

function publicUser(user: StoredUser, users: StoredUser[]): AuthenticatedUser {
  const normalized = normaliseStoredUser(user, users);
  return { id: normalized.id, username: normalized.username, access: normalized.access, role: normalized.role, isOwner: normalized.isOwner, createdAt: normalized.createdAt };
}

function accountOwnerId(user: StoredUser, users: StoredUser[]): string {
  return normaliseStoredUser(user, users).accountOwnerId;
}

function canManage(user: StoredUser, users: StoredUser[]): boolean {
  const normalized = normaliseStoredUser(user, users);
  return normalized.isOwner || normalized.role === "super";
}

function normaliseStoredUser(user: StoredUser, users: StoredUser[], assumeOwner = false): StoredUser & Required<Pick<StoredUser, "accountOwnerId" | "access" | "role" | "isOwner">> {
  const owner = user.accountOwnerId ?? (user.isOwner || assumeOwner ? user.id : users.find((candidate) => candidate.isOwner)?.id ?? users[0]?.id ?? user.id);
  return {
    ...user,
    accountOwnerId: owner,
    access: user.access === "read" ? "read" : "write",
    role: user.role === "super" ? "super" : (user.isOwner || assumeOwner ? "super" : "regular"),
    isOwner: user.isOwner === true || (assumeOwner && !user.accountOwnerId)
  };
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
