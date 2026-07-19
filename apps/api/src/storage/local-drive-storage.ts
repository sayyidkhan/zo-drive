import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, readdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { randomUUID } from "node:crypto";

export const nativeFileTypes = ["document", "spreadsheet", "presentation", "form"] as const;
export type NativeFileType = (typeof nativeFileTypes)[number];

const nativeContentTypes: Record<NativeFileType, string> = {
  document: "application/vnd.zo.document+json",
  spreadsheet: "application/vnd.zo.spreadsheet+json",
  presentation: "application/vnd.zo.presentation+json",
  form: "application/vnd.zo.form+json"
};

export class UnsafeDrivePathError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsafeDrivePathError";
  }
}

export type DriveFile = {
  key: string;
  name: string;
  size: number;
  contentType: string;
  updatedAt: string;
  starred: boolean;
  nativeType?: NativeFileType;
};

export type ReadDriveFile = DriveFile & {
  filePath: string;
};

export type DriveFolder = {
  key: string;
  name: string;
  updatedAt: string;
};

export type DriveTrashItem = {
  id: string;
  originalKey: string;
  name: string;
  size: number;
  contentType: string;
  starred: boolean;
  trashedAt: string;
  expiresAt: string;
};

export class TrashRestoreConflictError extends Error {
  constructor() {
    super("A file already exists at the original location");
    this.name = "TrashRestoreConflictError";
  }
}

type StorageTarget = {
  userId: string;
  key: string;
};

type WriteDriveFile = StorageTarget & {
  content: Buffer | Readable;
  contentType?: string;
};

type CreateNativeDriveFile = StorageTarget & { type: NativeFileType };
type UpdateNativeDriveFile = StorageTarget & { content: Record<string, unknown> & { format: "zo-native"; type: NativeFileType; version: 1 } };

type ListDriveFiles = {
  userId: string;
  prefix?: string;
  query?: string;
  contentQuery?: string;
  type?: DriveFileCategory;
  starred?: boolean;
  modifiedAfter?: string;
  modifiedBefore?: string;
};

export type DriveFileCategory = "document" | "spreadsheet" | "presentation" | "form" | "image" | "video" | "audio" | "pdf" | "other";

type ListDriveFolders = {
  userId: string;
  prefix?: string;
};

type StoredContentTypes = Map<string, string>;

const TRASH_RETENTION_MS = 30 * 24 * 60 * 60 * 1_000;

const contentTypes: Record<string, string> = {
  ".gif": "image/gif",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".json": "application/json",
  ".m4v": "video/x-m4v",
  ".md": "text/markdown",
  ".mp3": "audio/mpeg",
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".txt": "text/plain",
  ".wav": "audio/wav",
  ".webm": "video/webm",
  ".webp": "image/webp"
};

/**
 * A filesystem-backed storage adapter for a private Zo site/service.
 * Its root is application data, never the source-code repository.
 */
export class LocalDriveStorage {
  readonly root: string;

  constructor({ root }: { root: string }) {
    if (!root || !isAbsolute(root)) {
      throw new Error("ZO_DRIVE_DATA_ROOT must be an absolute path");
    }
    this.root = resolve(root);
  }

  async write({ userId, key, content, contentType }: WriteDriveFile): Promise<DriveFile> {
    const target = this.resolveFilePath(userId, key);
    const normalizedKey = this.normalizeKey(key, { allowEmpty: false });
    await mkdir(dirname(target), { recursive: true });

    const temporaryTarget = join(dirname(target), `.${basename(target)}.${randomUUID()}.uploading`);
    try {
      if (Buffer.isBuffer(content)) {
        await writeFile(temporaryTarget, content);
      } else {
        await pipeline(content, createWriteStream(temporaryTarget));
      }
      await rename(temporaryTarget, target);
    } catch (error) {
      await rm(temporaryTarget, { force: true });
      throw error;
    }

    const [starredKeys, storedContentTypes] = await Promise.all([this.readStarredKeys(userId), this.readContentTypes(userId)]);
    const normalizedContentType = normalizeContentType(contentType);
    if (normalizedContentType && storedContentTypes.get(normalizedKey) !== normalizedContentType) {
      storedContentTypes.set(normalizedKey, normalizedContentType);
      await this.writeContentTypes(userId, storedContentTypes);
    } else if (!normalizedContentType && storedContentTypes.delete(normalizedKey)) {
      await this.writeContentTypes(userId, storedContentTypes);
    }
    return this.describe(target, normalizedKey, starredKeys.has(normalizedKey), storedContentTypes.get(normalizedKey));
  }

  async createNativeFile({ userId, key, type }: CreateNativeDriveFile): Promise<DriveFile> {
    const normalizedKey = this.normalizeKey(key, { allowEmpty: false });
    const target = this.resolveFilePath(userId, normalizedKey);
    try {
      await stat(target);
      throw Object.assign(new Error("A file with this name already exists"), { code: "EEXIST" });
    } catch (error: unknown) {
      if (!isNotFound(error)) throw error;
    }
    return this.write({
      userId,
      key: normalizedKey,
      content: Buffer.from(JSON.stringify(nativeFileTemplate(type))),
      contentType: nativeContentTypes[type]
    });
  }

  async updateNativeFile({ userId, key, content }: UpdateNativeDriveFile): Promise<DriveFile> {
    const existing = await this.read({ userId, key });
    if (!existing.nativeType || existing.nativeType !== content.type) {
      throw Object.assign(new Error("This is not a matching Zo-native file"), { code: "ENOTSUP" });
    }
    return this.write({
      userId,
      key,
      content: Buffer.from(JSON.stringify(content)),
      contentType: nativeContentTypes[content.type]
    });
  }

  async read({ userId, key }: StorageTarget): Promise<ReadDriveFile> {
    const target = this.resolveFilePath(userId, key);
    const normalizedKey = this.normalizeKey(key, { allowEmpty: false });
    const [starredKeys, storedContentTypes] = await Promise.all([this.readStarredKeys(userId), this.readContentTypes(userId)]);
    return { ...(await this.describe(target, normalizedKey, starredKeys.has(normalizedKey), storedContentTypes.get(normalizedKey))), filePath: target };
  }

  createReadStream(filePath: string) {
    return createReadStream(filePath);
  }

  async remove({ userId, key }: StorageTarget): Promise<void> {
    const target = this.resolveFilePath(userId, key);
    const normalizedKey = this.normalizeKey(key, { allowEmpty: false });
    await rm(target);
    const [starredKeys, storedContentTypes] = await Promise.all([this.readStarredKeys(userId), this.readContentTypes(userId)]);
    if (starredKeys.delete(normalizedKey)) await this.writeStarredKeys(userId, starredKeys);
    if (storedContentTypes.delete(normalizedKey)) await this.writeContentTypes(userId, storedContentTypes);
    await this.removeEmptyParents(dirname(target), this.userFilesRoot(userId));
  }

  async trash({ userId, key }: StorageTarget): Promise<DriveTrashItem> {
    await this.purgeExpiredTrashForUser(userId);
    const normalizedKey = this.normalizeKey(key, { allowEmpty: false });
    const source = this.resolveFilePath(userId, normalizedKey);
    const [starredKeys, storedContentTypes, items] = await Promise.all([
      this.readStarredKeys(userId),
      this.readContentTypes(userId),
      this.readTrashItems(userId)
    ]);
    const file = await this.describe(source, normalizedKey, starredKeys.has(normalizedKey), storedContentTypes.get(normalizedKey));
    const trashedAt = new Date().toISOString();
    const item: DriveTrashItem = {
      id: randomUUID(),
      originalKey: normalizedKey,
      name: file.name,
      size: file.size,
      contentType: file.contentType,
      starred: file.starred,
      trashedAt,
      expiresAt: new Date(Date.now() + TRASH_RETENTION_MS).toISOString()
    };

    await mkdir(this.userTrashRoot(userId), { recursive: true });
    await rename(source, this.trashFilePath(userId, item.id));
    if (starredKeys.delete(normalizedKey)) await this.writeStarredKeys(userId, starredKeys);
    if (storedContentTypes.delete(normalizedKey)) await this.writeContentTypes(userId, storedContentTypes);
    await this.writeTrashItems(userId, [...items, item]);
    await this.removeEmptyParents(dirname(source), this.userFilesRoot(userId));
    return item;
  }

  async listTrash({ userId }: Pick<StorageTarget, "userId">): Promise<DriveTrashItem[]> {
    await this.purgeExpiredTrashForUser(userId);
    return (await this.readTrashItems(userId)).sort((left, right) => right.trashedAt.localeCompare(left.trashedAt));
  }

  async restoreTrash({ userId, id }: Pick<StorageTarget, "userId"> & { id: string }): Promise<DriveFile> {
    await this.purgeExpiredTrashForUser(userId);
    const item = await this.findTrashItem(userId, id);
    const target = this.resolveFilePath(userId, item.originalKey);
    try {
      await stat(target);
      throw new TrashRestoreConflictError();
    } catch (error: unknown) {
      if (!isNotFound(error)) throw error;
    }

    await mkdir(dirname(target), { recursive: true });
    await rename(this.trashFilePath(userId, item.id), target);
    const [starredKeys, storedContentTypes, items] = await Promise.all([
      this.readStarredKeys(userId),
      this.readContentTypes(userId),
      this.readTrashItems(userId)
    ]);
    if (item.starred) starredKeys.add(item.originalKey);
    storedContentTypes.set(item.originalKey, item.contentType);
    await Promise.all([
      this.writeStarredKeys(userId, starredKeys),
      this.writeContentTypes(userId, storedContentTypes),
      this.writeTrashItems(userId, items.filter((candidate) => candidate.id !== item.id))
    ]);
    return this.describe(target, item.originalKey, item.starred, item.contentType);
  }

  async permanentlyDeleteTrash({ userId, id }: Pick<StorageTarget, "userId"> & { id: string }): Promise<void> {
    await this.purgeExpiredTrashForUser(userId);
    const item = await this.findTrashItem(userId, id);
    await rm(this.trashFilePath(userId, item.id), { force: true });
    const items = await this.readTrashItems(userId);
    await this.writeTrashItems(userId, items.filter((candidate) => candidate.id !== item.id));
  }

  async emptyTrash({ userId }: Pick<StorageTarget, "userId">): Promise<void> {
    const items = await this.listTrash({ userId });
    await Promise.all(items.map((item) => rm(this.trashFilePath(userId, item.id), { force: true })));
    await this.writeTrashItems(userId, []);
  }

  async purgeExpiredTrash({ now = Date.now() }: { now?: number } = {}): Promise<void> {
    const usersRoot = join(this.root, "v1", "users");
    let users;
    try {
      users = await readdir(usersRoot, { withFileTypes: true });
    } catch (error: unknown) {
      if (isNotFound(error)) return;
      throw error;
    }
    await Promise.all(users.filter((entry) => entry.isDirectory()).map((entry) => this.purgeExpiredTrashForUser(entry.name, now)));
  }

  async removeUser({ userId }: Pick<StorageTarget, "userId">): Promise<void> {
    const safeUserId = this.normalizeUserId(userId);
    await rm(join(this.root, "v1", "users", safeUserId), { force: true, recursive: true });
  }

  async renameUser({ fromUserId, toUserId }: { fromUserId: string; toUserId: string }): Promise<void> {
    const from = this.normalizeUserId(fromUserId);
    const to = this.normalizeUserId(toUserId);
    if (from === to) return;

    const usersRoot = join(this.root, "v1", "users");
    const source = join(usersRoot, from);
    const target = join(usersRoot, to);
    await mkdir(usersRoot, { recursive: true });
    try {
      await rename(source, target);
    } catch (error: unknown) {
      if (!isNotFound(error)) throw error;
    }
  }

  async createFolder({ userId, key }: StorageTarget): Promise<DriveFolder> {
    const target = this.resolveFolderPath(userId, key);
    await mkdir(target, { recursive: true });
    return this.describeFolder(target, this.normalizeKey(key, { allowEmpty: false }));
  }

  async listFolders({ userId, prefix = "" }: ListDriveFolders): Promise<DriveFolder[]> {
    const filesRoot = this.userFilesRoot(userId);
    const directory = prefix ? this.resolveFolderPath(userId, prefix) : filesRoot;
    let entries;
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch (error: unknown) {
      if (isNotFound(error)) return [];
      throw error;
    }

    const folders = await Promise.all(
      entries.filter((entry) => entry.isDirectory()).map(async (entry) => {
        const folderPath = join(directory, entry.name);
        const key = relative(filesRoot, folderPath).split(sep).join("/");
        return this.describeFolder(folderPath, key);
      })
    );
    return folders.sort((left, right) => left.key.localeCompare(right.key));
  }

  async list({ userId, prefix = "", query = "", contentQuery = "", type, starred, modifiedAfter, modifiedBefore }: ListDriveFiles): Promise<DriveFile[]> {
    const filesRoot = this.userFilesRoot(userId);
    const normalizedPrefix = prefix ? this.normalizeKey(prefix, { allowEmpty: false }) : "";
    const normalizedQuery = query.trim().toLowerCase();
    const [starredKeys, storedContentTypes] = await Promise.all([this.readStarredKeys(userId), this.readContentTypes(userId)]);
    const files = await this.collectFiles(filesRoot, filesRoot, starredKeys, storedContentTypes);
    const filtered = files
      .filter((file) => !normalizedPrefix || file.key === normalizedPrefix || file.key.startsWith(`${normalizedPrefix}/`))
      .filter((file) => !normalizedQuery || file.name.toLowerCase().includes(normalizedQuery))
      .filter((file) => !type || matchesFileCategory(file, type))
      .filter((file) => starred === undefined || file.starred === starred)
      .filter((file) => !modifiedAfter || file.updatedAt >= modifiedAfter)
      .filter((file) => !modifiedBefore || file.updatedAt <= modifiedBefore);
    const normalizedContentQuery = contentQuery.trim().toLowerCase();
    const contentMatches = normalizedContentQuery
      ? (await Promise.all(filtered.map(async (file) => (await this.matchesContentQuery(userId, file, normalizedContentQuery)) ? file : null))).filter((file): file is DriveFile => file !== null)
      : filtered;
    return contentMatches.sort((left, right) => left.key.localeCompare(right.key));
  }

  async listStarred({ userId }: Pick<StorageTarget, "userId">): Promise<DriveFile[]> {
    return (await this.list({ userId })).filter((file) => file.starred);
  }

  async setStarred({ userId, key, starred }: StorageTarget & { starred: boolean }): Promise<DriveFile> {
    const normalizedKey = this.normalizeKey(key, { allowEmpty: false });
    const target = this.resolveFilePath(userId, normalizedKey);
    const fileStat = await stat(target);
    if (!fileStat.isFile()) {
      const error = Object.assign(new Error("File not found"), { code: "ENOENT" });
      throw error;
    }

    const [starredKeys, storedContentTypes] = await Promise.all([this.readStarredKeys(userId), this.readContentTypes(userId)]);
    if (starred) starredKeys.add(normalizedKey);
    else starredKeys.delete(normalizedKey);
    await this.writeStarredKeys(userId, starredKeys);
    return this.describe(target, normalizedKey, starred, storedContentTypes.get(normalizedKey));
  }

  async getUsage({ userId }: Pick<StorageTarget, "userId">): Promise<{ fileCount: number; usedBytes: number }> {
    const [files, trash] = await Promise.all([this.list({ userId }), this.listTrash({ userId })]);
    const items = [...files, ...trash];
    return {
      fileCount: items.length,
      usedBytes: items.reduce((total, file) => total + file.size, 0)
    };
  }

  private userFilesRoot(userId: string): string {
    const safeUserId = this.normalizeUserId(userId);
    return join(this.root, "v1", "users", safeUserId, "files");
  }

  private userMetadataRoot(userId: string): string {
    const safeUserId = this.normalizeUserId(userId);
    return join(this.root, "v1", "users", safeUserId);
  }

  private userTrashRoot(userId: string): string {
    return join(this.userMetadataRoot(userId), "trash");
  }

  private trashFilePath(userId: string, id: string): string {
    if (!isTrashId(id)) throw new UnsafeDrivePathError("Trash item ID is invalid");
    return join(this.userTrashRoot(userId), id);
  }

  private async findTrashItem(userId: string, id: string): Promise<DriveTrashItem> {
    if (!isTrashId(id)) throw new UnsafeDrivePathError("Trash item ID is invalid");
    const item = (await this.readTrashItems(userId)).find((candidate) => candidate.id === id);
    if (!item) throw Object.assign(new Error("Trash item not found"), { code: "ENOENT" });
    return item;
  }

  private async readTrashItems(userId: string): Promise<DriveTrashItem[]> {
    try {
      const parsed = JSON.parse(await readFile(join(this.userMetadataRoot(userId), "trash.json"), "utf8")) as { items?: unknown };
      if (!Array.isArray(parsed.items)) return [];
      return parsed.items.filter(isDriveTrashItem);
    } catch (error: unknown) {
      if (isNotFound(error)) return [];
      throw error;
    }
  }

  private async writeTrashItems(userId: string, items: DriveTrashItem[]): Promise<void> {
    const metadataRoot = this.userMetadataRoot(userId);
    await mkdir(metadataRoot, { recursive: true });
    const target = join(metadataRoot, "trash.json");
    const temporaryTarget = join(metadataRoot, `.trash.${randomUUID()}.tmp`);
    try {
      await writeFile(temporaryTarget, JSON.stringify({ items }));
      await rename(temporaryTarget, target);
    } catch (error) {
      await rm(temporaryTarget, { force: true });
      throw error;
    }
  }

  private async purgeExpiredTrashForUser(userId: string, now = Date.now()): Promise<void> {
    const items = await this.readTrashItems(userId);
    const expired = items.filter((item) => Date.parse(item.expiresAt) <= now);
    if (expired.length === 0) return;
    await Promise.all(expired.map((item) => rm(this.trashFilePath(userId, item.id), { force: true })));
    await this.writeTrashItems(userId, items.filter((item) => !expired.some((candidate) => candidate.id === item.id)));
  }

  private async readStarredKeys(userId: string): Promise<Set<string>> {
    try {
      const parsed = JSON.parse(await readFile(join(this.userMetadataRoot(userId), "stars.json"), "utf8")) as { keys?: unknown };
      if (!Array.isArray(parsed.keys)) return new Set();
      return new Set(parsed.keys.filter((key): key is string => typeof key === "string" && isSafeStarKey(key)));
    } catch (error: unknown) {
      if (isNotFound(error)) return new Set();
      throw error;
    }
  }

  private async writeStarredKeys(userId: string, keys: Set<string>): Promise<void> {
    const metadataRoot = this.userMetadataRoot(userId);
    await mkdir(metadataRoot, { recursive: true });
    const target = join(metadataRoot, "stars.json");
    const temporaryTarget = join(metadataRoot, `.stars.${randomUUID()}.tmp`);
    try {
      await writeFile(temporaryTarget, JSON.stringify({ keys: [...keys].sort() }));
      await rename(temporaryTarget, target);
    } catch (error) {
      await rm(temporaryTarget, { force: true });
      throw error;
    }
  }

  private async readContentTypes(userId: string): Promise<StoredContentTypes> {
    try {
      const parsed = JSON.parse(await readFile(join(this.userMetadataRoot(userId), "content-types.json"), "utf8")) as { types?: Record<string, unknown> };
      if (!parsed.types || typeof parsed.types !== "object") return new Map();
      const entries = Object.entries(parsed.types).filter((entry): entry is [string, string] => isSafeStarKey(entry[0]) && typeof entry[1] === "string" && Boolean(normalizeContentType(entry[1])));
      return new Map(entries);
    } catch (error: unknown) {
      if (isNotFound(error)) return new Map();
      throw error;
    }
  }

  private async writeContentTypes(userId: string, contentTypes: StoredContentTypes): Promise<void> {
    const metadataRoot = this.userMetadataRoot(userId);
    await mkdir(metadataRoot, { recursive: true });
    const target = join(metadataRoot, "content-types.json");
    const temporaryTarget = join(metadataRoot, `.content-types.${randomUUID()}.tmp`);
    try {
      await writeFile(temporaryTarget, JSON.stringify({ types: Object.fromEntries([...contentTypes.entries()].sort(([left], [right]) => left.localeCompare(right))) }));
      await rename(temporaryTarget, target);
    } catch (error) {
      await rm(temporaryTarget, { force: true });
      throw error;
    }
  }

  private resolveFilePath(userId: string, key: string): string {
    return this.resolveFolderPath(userId, key);
  }

  private resolveFolderPath(userId: string, key: string): string {
    const filesRoot = this.userFilesRoot(userId);
    const normalizedKey = this.normalizeKey(key, { allowEmpty: false });
    const candidate = resolve(filesRoot, ...normalizedKey.split("/"));
    const pathFromRoot = relative(filesRoot, candidate);

    if (pathFromRoot === "" || pathFromRoot.startsWith(`..${sep}`) || pathFromRoot === ".." || isAbsolute(pathFromRoot)) {
      throw new UnsafeDrivePathError("File path must remain inside the user's drive");
    }
    return candidate;
  }

  private normalizeUserId(userId: string): string {
    if (!/^[a-zA-Z0-9_-]+$/.test(userId)) {
      throw new UnsafeDrivePathError("User ID contains unsafe characters");
    }
    return userId;
  }

  private normalizeKey(key: string, { allowEmpty }: { allowEmpty: boolean }): string {
    if (typeof key !== "string" || (!allowEmpty && key.trim() === "")) {
      throw new UnsafeDrivePathError("File path is required");
    }
    if (isAbsolute(key) || key.includes("\\") || key.includes("\0")) {
      throw new UnsafeDrivePathError("File path must be a safe relative path");
    }

    const segments = key.split("/");
    if (segments.some((segment) => segment === "" || segment === "." || segment === "..")) {
      throw new UnsafeDrivePathError("File path contains unsafe segments");
    }
    return segments.join("/");
  }

  private async collectFiles(currentDirectory: string, filesRoot: string, starredKeys: Set<string>, storedContentTypes: StoredContentTypes): Promise<DriveFile[]> {
    let entries;
    try {
      entries = await readdir(currentDirectory, { withFileTypes: true });
    } catch (error: unknown) {
      if (isNotFound(error)) {
        return [];
      }
      throw error;
    }

    const files = await Promise.all(
      entries.map(async (entry) => {
        const entryPath = join(currentDirectory, entry.name);
        if (entry.isDirectory()) {
          return this.collectFiles(entryPath, filesRoot, starredKeys, storedContentTypes);
        }
        if (!entry.isFile()) {
          return [];
        }
        const key = relative(filesRoot, entryPath).split(sep).join("/");
        return [await this.describe(entryPath, key, starredKeys.has(key), storedContentTypes.get(key))];
      })
    );
    return files.flat();
  }

  private async describe(filePath: string, key: string, starred: boolean, storedContentType?: string): Promise<DriveFile> {
    const fileStat = await stat(filePath);
    const contentType = storedContentType ?? contentTypeFor(key);
    return {
      key,
      name: basename(key),
      size: fileStat.size,
      contentType,
      updatedAt: fileStat.mtime.toISOString(),
      starred,
      nativeType: nativeFileTypeFromContentType(contentType)
    };
  }

  private async matchesContentQuery(userId: string, file: DriveFile, query: string): Promise<boolean> {
    if (!isTextSearchable(file.contentType) || file.size > 1_048_576) return false;
    try {
      return (await readFile(this.resolveFilePath(userId, file.key), "utf8")).toLowerCase().includes(query);
    } catch {
      return false;
    }
  }

  private async describeFolder(folderPath: string, key: string): Promise<DriveFolder> {
    const folderStat = await stat(folderPath);
    return {
      key,
      name: basename(key),
      updatedAt: folderStat.mtime.toISOString()
    };
  }

  private async removeEmptyParents(currentDirectory: string, stopAt: string): Promise<void> {
    if (currentDirectory === stopAt) {
      return;
    }
    try {
      const entries = await readdir(currentDirectory);
      if (entries.length > 0) {
        return;
      }
      await rm(currentDirectory, { recursive: true });
      await this.removeEmptyParents(dirname(currentDirectory), stopAt);
    } catch (error: unknown) {
      if (!isNotFound(error)) {
        throw error;
      }
    }
  }
}

function contentTypeFor(key: string): string {
  const extension = key.slice(key.lastIndexOf(".")).toLowerCase();
  return contentTypes[extension] ?? "application/octet-stream";
}

function normalizeContentType(value: string | undefined): string | null {
  const type = value?.split(";", 1)[0]?.trim().toLowerCase();
  return type && /^[!#$%&'*+.^_`|~0-9a-z-]+\/[!#$%&'*+.^_`|~0-9a-z-]+$/.test(type) ? type : null;
}

function nativeFileTypeFromContentType(contentType: string): NativeFileType | undefined {
  return nativeFileTypes.find((type) => nativeContentTypes[type] === contentType);
}

function matchesFileCategory(file: DriveFile, category: DriveFileCategory): boolean {
  if (category === "document") return file.nativeType === "document" || file.contentType.startsWith("text/");
  if (category === "spreadsheet") return file.nativeType === "spreadsheet";
  if (category === "presentation") return file.nativeType === "presentation";
  if (category === "form") return file.nativeType === "form";
  if (category === "image") return file.contentType.startsWith("image/");
  if (category === "video") return file.contentType.startsWith("video/");
  if (category === "audio") return file.contentType.startsWith("audio/");
  if (category === "pdf") return file.contentType === "application/pdf";
  return !file.nativeType && !file.contentType.startsWith("text/") && !file.contentType.startsWith("image/") && !file.contentType.startsWith("video/") && !file.contentType.startsWith("audio/") && file.contentType !== "application/pdf";
}

function isTextSearchable(contentType: string): boolean {
  return contentType.startsWith("text/") || contentType === "application/json" || contentType.endsWith("+json");
}

function nativeFileTemplate(type: NativeFileType): Record<string, unknown> {
  const createdAt = new Date().toISOString();
  switch (type) {
    case "document": return { format: "zo-native", type, version: 1, createdAt, blocks: [] };
    case "spreadsheet": return { format: "zo-native", type, version: 1, createdAt, sheets: [{ name: "Sheet 1", cells: {} }] };
    case "presentation": return { format: "zo-native", type, version: 1, createdAt, slides: [{ title: "Untitled presentation", body: "" }] };
    case "form": return { format: "zo-native", type, version: 1, createdAt, questions: [] };
  }
}

function isNotFound(error: unknown): error is NodeJS.ErrnoException {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}

function isSafeStarKey(key: string): boolean {
  return !isAbsolute(key) && !key.includes("\\") && !key.includes("\0") && key.split("/").every((segment) => segment !== "" && segment !== "." && segment !== "..");
}

function isTrashId(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function isDriveTrashItem(value: unknown): value is DriveTrashItem {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<DriveTrashItem>;
  return Boolean(
    typeof item.id === "string" && isTrashId(item.id) &&
    typeof item.originalKey === "string" && isSafeStarKey(item.originalKey) &&
    typeof item.name === "string" && item.name === basename(item.originalKey) &&
    typeof item.size === "number" && Number.isSafeInteger(item.size) && item.size >= 0 &&
    typeof item.contentType === "string" && normalizeContentType(item.contentType) &&
    typeof item.starred === "boolean" &&
    typeof item.trashedAt === "string" && Number.isFinite(Date.parse(item.trashedAt)) &&
    typeof item.expiresAt === "string" && Number.isFinite(Date.parse(item.expiresAt))
  );
}
