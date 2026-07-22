import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, readdir, readFile, rename, rm, stat, statfs, writeFile } from "node:fs/promises";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { createHash, randomUUID } from "node:crypto";

export const nativeFileTypes = ["document", "spreadsheet", "presentation", "form", "paste"] as const;
export type NativeFileType = (typeof nativeFileTypes)[number];
export const DEFAULT_STORAGE_QUOTA_BYTES = 100 * 1024 * 1024 * 1024;
export const MIN_STORAGE_QUOTA_BYTES = 1 * 1024 * 1024 * 1024;
const MAX_STORAGE_QUOTA_RATIO = 0.8;

const nativeContentTypes: Record<NativeFileType, string> = {
  document: "application/vnd.zo.document+json",
  spreadsheet: "application/vnd.zo.spreadsheet+json",
  presentation: "application/vnd.zo.presentation+json",
  form: "application/vnd.zo.form+json",
  paste: "application/vnd.zo.paste+json"
};

export class UnsafeDrivePathError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsafeDrivePathError";
  }
}

export class StorageQuotaExceededError extends Error {
  constructor() {
    super("Your Zo Drive has reached its configured storage limit. Remove Drive data or increase the limit to continue.");
    this.name = "StorageQuotaExceededError";
  }
}

export class StorageQuotaConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StorageQuotaConfigurationError";
  }
}

export class NativeFileVersionConflictError extends Error {
  constructor() {
    super("This paste changed before your save. Reload the latest version before trying again.");
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

type StorageCategory = "photos" | "videos" | "documents" | "audio" | "archives" | "other" | "trash" | "databases" | "functions" | "zo-originals";
type StorageUsage = {
  fileCount: number;
  usedBytes: number;
  quotaBytes: number;
  quotaAvailableBytes: number;
  minQuotaBytes: number;
  maxQuotaBytes: number;
  totalBytes: number;
  availableBytes: number;
  systemUsedBytes: number;
  categories: Array<{ id: StorageCategory; bytes: number; fileCount: number }>;
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
type RenameDriveFile = StorageTarget & { name: string };
type MoveDriveFile = StorageTarget & { destination: string };
type CopyDriveFile = StorageTarget & { destination: string; overwrite?: boolean };

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

export type DriveFileCategory = "document" | "spreadsheet" | "presentation" | "form" | "paste" | "image" | "video" | "audio" | "pdf" | "other";

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

function addUsageCategory(categories: Map<StorageCategory, { bytes: number; fileCount: number }>, category: StorageCategory, size: number): void {
  const values = categories.get(category)!;
  values.bytes += size;
  values.fileCount += 1;
}

function categoryForFile(file: Pick<DriveFile, "contentType" | "name">): Exclude<StorageCategory, "trash"> {
  const contentType = file.contentType.toLowerCase();
  const name = file.name.toLowerCase();
  if (contentType.startsWith("image/")) return "photos";
  if (contentType.startsWith("video/")) return "videos";
  if (contentType.startsWith("audio/")) return "audio";
  if (contentType === "application/pdf" || contentType.startsWith("text/") || contentType.includes("document") || contentType.includes("spreadsheet") || contentType.includes("presentation") || contentType.includes("form") || contentType.includes("paste")) return "documents";
  if (contentType.includes("zip") || contentType.includes("compressed") || /\.(zip|rar|7z|tar|gz|bz2|xz)$/i.test(name)) return "archives";
  return "other";
}

function quotaLimitedStream(writableBytes: number): Transform {
  let writtenBytes = 0;
  return new Transform({
    transform(chunk, encoding, callback) {
      writtenBytes += Buffer.isBuffer(chunk) ? chunk.length : Buffer.byteLength(chunk, encoding);
      if (writtenBytes > writableBytes) {
        callback(new StorageQuotaExceededError());
        return;
      }
      callback(null, chunk);
    }
  });
}

/**
 * A filesystem-backed storage adapter for a private Zo site/service.
 * Its root is application data, never the source-code repository.
 */
export class LocalDriveStorage {
  readonly root: string;
  readonly quotaBytes: number;
  private readonly writeLocks = new Map<string, Promise<void>>();

  constructor({ root, quotaBytes = DEFAULT_STORAGE_QUOTA_BYTES }: { root: string; quotaBytes?: number }) {
    if (!root || !isAbsolute(root)) {
      throw new Error("ZO_DRIVE_DATA_ROOT must be an absolute path");
    }
    if (!Number.isSafeInteger(quotaBytes) || quotaBytes < 1) {
      throw new Error("ZO_DRIVE_STORAGE_QUOTA_BYTES must be a positive integer");
    }
    this.root = resolve(root);
    this.quotaBytes = quotaBytes;
  }

  async write({ userId, key, content, contentType }: WriteDriveFile): Promise<DriveFile> {
    return this.withWriteLock(userId, () => this.writeUnlocked({ userId, key, content, contentType }));
  }

  private async writeUnlocked({ userId, key, content, contentType }: WriteDriveFile): Promise<DriveFile> {
    const target = this.resolveFilePath(userId, key);
    const normalizedKey = this.normalizeKey(key, { allowEmpty: false });
    await mkdir(dirname(target), { recursive: true });
    const existingSize = await this.existingFileSize(target);
    const usage = await this.getUsage({ userId });
    const writableBytes = Math.max(0, usage.quotaBytes - usage.usedBytes + existingSize);
    if (Buffer.isBuffer(content) && content.length > writableBytes) throw new StorageQuotaExceededError();

    const temporaryTarget = join(dirname(target), `.${basename(target)}.${randomUUID()}.uploading`);
    try {
      if (Buffer.isBuffer(content)) {
        await writeFile(temporaryTarget, content);
      } else {
        await pipeline(content, quotaLimitedStream(writableBytes), createWriteStream(temporaryTarget));
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

  async updateNativeFileIfUnchanged({ userId, key, content, expectedRevision }: UpdateNativeDriveFile & { expectedRevision: string }): Promise<DriveFile> {
    return this.withWriteLock(userId, async () => {
      const existing = await this.read({ userId, key });
      if (existing.nativeType !== "paste" || content.type !== "paste") {
        throw Object.assign(new Error("This is not an editable Zo Paste"), { code: "ENOTSUP" });
      }
      const existingContent = JSON.parse(await readFile(existing.filePath, "utf8")) as Record<string, unknown>;
      if (pasteContentRevision(existingContent) !== expectedRevision) throw new NativeFileVersionConflictError();
      return this.writeUnlocked({
        userId,
        key,
        content: Buffer.from(JSON.stringify(content)),
        contentType: nativeContentTypes.paste
      });
    });
  }

  async renameFile({ userId, key, name }: RenameDriveFile): Promise<DriveFile> {
    const normalizedKey = this.normalizeKey(key, { allowEmpty: false });
    const normalizedName = name.trim();
    if (!normalizedName || normalizedName.includes("/") || normalizedName.includes("\\") || normalizedName === "." || normalizedName === "..") {
      throw new UnsafeDrivePathError("File names cannot contain path separators");
    }
    const parent = dirname(normalizedKey);
    return this.moveFile({ userId, key: normalizedKey, destination: parent === "." ? normalizedName : `${parent}/${normalizedName}` });
  }

  async moveFile({ userId, key, destination }: MoveDriveFile): Promise<DriveFile> {
    const normalizedKey = this.normalizeKey(key, { allowEmpty: false });
    const nextKey = this.normalizeKey(destination, { allowEmpty: false });
    if (nextKey === normalizedKey) return this.read({ userId, key: normalizedKey });

    const source = this.resolveFilePath(userId, normalizedKey);
    const target = this.resolveFilePath(userId, nextKey);
    if (!(await stat(source)).isFile()) {
      throw Object.assign(new Error("Only files can be moved"), { code: "EISDIR" });
    }
    try {
      await stat(target);
      throw Object.assign(new Error("A file with this name already exists"), { code: "EEXIST" });
    } catch (error: unknown) {
      if (!isNotFound(error)) throw error;
    }

    const [starredKeys, storedContentTypes] = await Promise.all([this.readStarredKeys(userId), this.readContentTypes(userId)]);
    await mkdir(dirname(target), { recursive: true });
    await rename(source, target);
    if (starredKeys.delete(normalizedKey)) {
      starredKeys.add(nextKey);
      await this.writeStarredKeys(userId, starredKeys);
    }
    const contentType = storedContentTypes.get(normalizedKey);
    if (contentType) {
      storedContentTypes.delete(normalizedKey);
      storedContentTypes.set(nextKey, contentType);
      await this.writeContentTypes(userId, storedContentTypes);
    }
    return this.describe(target, nextKey, starredKeys.has(nextKey), storedContentTypes.get(nextKey));
  }

  async copyFile({ userId, key, destination, overwrite = false }: CopyDriveFile): Promise<DriveFile> {
    return this.withWriteLock(userId, async () => {
      const normalizedKey = this.normalizeKey(key, { allowEmpty: false });
      const nextKey = this.normalizeKey(destination, { allowEmpty: false });
      if (nextKey === normalizedKey) return this.read({ userId, key: normalizedKey });

      const source = this.resolveFilePath(userId, normalizedKey);
      const target = this.resolveFilePath(userId, nextKey);
      const sourceStat = await stat(source);
      if (!sourceStat.isFile()) throw Object.assign(new Error("Only files can be copied"), { code: "EISDIR" });
      let existingSize = 0;
      let destinationExists = false;
      try {
        const destinationStat = await stat(target);
        if (!destinationStat.isFile()) throw Object.assign(new Error("A file with this name already exists"), { code: "EEXIST" });
        destinationExists = true;
        existingSize = destinationStat.size;
      } catch (error: unknown) {
        if (!isNotFound(error)) throw error;
      }
      if (destinationExists && !overwrite) throw Object.assign(new Error("A file with this name already exists"), { code: "EEXIST" });

      const usage = await this.getUsage({ userId });
      const writableBytes = Math.max(0, usage.quotaBytes - usage.usedBytes + existingSize);
      if (sourceStat.size > writableBytes) throw new StorageQuotaExceededError();

      const [starredKeys, storedContentTypes] = await Promise.all([this.readStarredKeys(userId), this.readContentTypes(userId)]);
      await mkdir(dirname(target), { recursive: true });
      const temporaryTarget = join(dirname(target), `.${basename(target)}.${randomUUID()}.copying`);
      try {
        await pipeline(createReadStream(source), quotaLimitedStream(writableBytes), createWriteStream(temporaryTarget));
        await rename(temporaryTarget, target);
      } catch (error) {
        await rm(temporaryTarget, { force: true });
        throw error;
      }

      if (starredKeys.has(normalizedKey)) starredKeys.add(nextKey);
      else starredKeys.delete(nextKey);
      await this.writeStarredKeys(userId, starredKeys);
      const contentType = storedContentTypes.get(normalizedKey);
      if (contentType) storedContentTypes.set(nextKey, contentType);
      else storedContentTypes.delete(nextKey);
      await this.writeContentTypes(userId, storedContentTypes);
      return this.describe(target, nextKey, starredKeys.has(nextKey), storedContentTypes.get(nextKey));
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

  async getUsage({ userId }: Pick<StorageTarget, "userId">): Promise<StorageUsage> {
    const safeUserId = this.normalizeUserId(userId);
    const [files, trash, featureUsage] = await Promise.all([
      this.list({ userId: safeUserId }),
      this.listTrash({ userId: safeUserId }),
      ownerFeatureUsage(this.root, safeUserId)
    ]);
    const categories = new Map<StorageCategory, { bytes: number; fileCount: number }>([
      ["photos", { bytes: 0, fileCount: 0 }],
      ["videos", { bytes: 0, fileCount: 0 }],
      ["documents", { bytes: 0, fileCount: 0 }],
      ["audio", { bytes: 0, fileCount: 0 }],
      ["archives", { bytes: 0, fileCount: 0 }],
      ["other", { bytes: 0, fileCount: 0 }],
      ["trash", { bytes: 0, fileCount: 0 }],
      ["databases", featureUsage.databases],
      ["functions", featureUsage.functions],
      ["zo-originals", featureUsage.originals]
    ]);
    for (const file of files) addUsageCategory(categories, categoryForFile(file), file.size);
    for (const file of trash) addUsageCategory(categories, "trash", file.size);
    await mkdir(this.root, { recursive: true });
    const { availableBytes, maxQuotaBytes, totalBytes } = await this.getFilesystemQuotaBounds();
    const quotaBytes = await this.readQuota(safeUserId);
    const featureBytes = Object.values(featureUsage).reduce((total, usage) => total + usage.bytes, 0);
    const usedBytes = [...files, ...trash].reduce((total, file) => total + file.size, featureBytes);
    return {
      fileCount: files.length,
      usedBytes,
      quotaBytes,
      quotaAvailableBytes: Math.max(0, quotaBytes - usedBytes),
      minQuotaBytes: MIN_STORAGE_QUOTA_BYTES,
      maxQuotaBytes,
      totalBytes,
      availableBytes,
      systemUsedBytes: Math.max(0, totalBytes - availableBytes),
      categories: [...categories.entries()].map(([id, values]) => ({ id, ...values }))
    };
  }

  async setQuota({ userId, quotaBytes }: Pick<StorageTarget, "userId"> & { quotaBytes: number }): Promise<StorageUsage> {
    return this.withWriteLock(userId, async () => {
      const { maxQuotaBytes } = await this.getFilesystemQuotaBounds();
      if (!Number.isSafeInteger(quotaBytes)) {
        throw new StorageQuotaConfigurationError("Storage limit must be a whole number of bytes");
      }
      if (quotaBytes < MIN_STORAGE_QUOTA_BYTES) {
        throw new StorageQuotaConfigurationError("Storage limit must be at least 1 GB");
      }
      if (quotaBytes > maxQuotaBytes) {
        throw new StorageQuotaConfigurationError("Storage limit cannot exceed 80% of this machine's disk capacity");
      }
      const usage = await this.getUsage({ userId });
      if (quotaBytes < usage.usedBytes) {
        throw new StorageQuotaConfigurationError("Storage limit cannot be lower than the files currently stored in Zo Drive");
      }
      await this.writeQuota(userId, quotaBytes);
      return this.getUsage({ userId });
    });
  }

  private userFilesRoot(userId: string): string {
    const safeUserId = this.normalizeUserId(userId);
    return join(this.root, "v1", "users", safeUserId, "files");
  }

  private async existingFileSize(filePath: string): Promise<number> {
    try {
      const file = await stat(filePath);
      return file.isFile() ? file.size : 0;
    } catch (error: unknown) {
      if (isNotFound(error)) return 0;
      throw error;
    }
  }

  private async withWriteLock<T>(userId: string, action: () => Promise<T>): Promise<T> {
    const previous = this.writeLocks.get(userId) ?? Promise.resolve();
    let release!: () => void;
    const current = new Promise<void>((resolve) => { release = resolve; });
    this.writeLocks.set(userId, current);
    await previous;
    try {
      return await action();
    } finally {
      release();
      if (this.writeLocks.get(userId) === current) this.writeLocks.delete(userId);
    }
  }

  private userMetadataRoot(userId: string): string {
    const safeUserId = this.normalizeUserId(userId);
    return join(this.root, "v1", "users", safeUserId);
  }

  private async getFilesystemQuotaBounds(): Promise<{ totalBytes: number; availableBytes: number; maxQuotaBytes: number }> {
    await mkdir(this.root, { recursive: true });
    const filesystem = await statfs(this.root);
    const totalBytes = filesystem.blocks * filesystem.bsize;
    return {
      totalBytes,
      availableBytes: filesystem.bavail * filesystem.bsize,
      maxQuotaBytes: Math.floor(totalBytes * MAX_STORAGE_QUOTA_RATIO)
    };
  }

  private async readQuota(userId: string): Promise<number> {
    try {
      const parsed = JSON.parse(await readFile(join(this.userMetadataRoot(userId), "storage.json"), "utf8")) as { quotaBytes?: unknown };
      return typeof parsed.quotaBytes === "number" && Number.isSafeInteger(parsed.quotaBytes) && parsed.quotaBytes >= MIN_STORAGE_QUOTA_BYTES ? parsed.quotaBytes : this.quotaBytes;
    } catch (error: unknown) {
      if (isNotFound(error)) return this.quotaBytes;
      throw error;
    }
  }

  private async writeQuota(userId: string, quotaBytes: number): Promise<void> {
    const metadataRoot = this.userMetadataRoot(userId);
    await mkdir(metadataRoot, { recursive: true });
    const target = join(metadataRoot, "storage.json");
    const temporaryTarget = join(metadataRoot, `.storage.${randomUUID()}.tmp`);
    try {
      await writeFile(temporaryTarget, JSON.stringify({ quotaBytes }));
      await rename(temporaryTarget, target);
    } catch (error) {
      await rm(temporaryTarget, { force: true });
      throw error;
    }
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
    const contentType = resolvedContentType(key, storedContentType);
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

type UsageCounter = { bytes: number; fileCount: number };

type OwnerJsonSelection = {
  value: unknown;
  selectedItems: number;
  totalItems: number;
};

async function ownerFeatureUsage(root: string, ownerUserId: string): Promise<{ databases: UsageCounter; functions: UsageCounter; originals: UsageCounter }> {
  const [databaseFiles, functionFiles, databaseKeys, account, deviceKeys, shares, forms, clusters] = await Promise.all([
    storedPathUsage(join(root, "v1", "databases", ownerUserId)),
    storedPathUsage(join(root, "v1", "functions", ownerUserId)),
    selectedJsonUsage(join(root, "v1", "databases", "api-keys.json"), (value) => selectFlatOwnerRecords(value, "keys", ownerUserId)),
    selectedJsonUsage(join(root, "v1", "auth", "users.json"), (value) => selectFlatOwnerRecords(value, "users", ownerUserId, "id")),
    selectedJsonUsage(join(root, "v1", "auth", "api-keys.json"), (value) => selectFlatOwnerRecords(value, "keys", ownerUserId)),
    selectedJsonUsage(join(root, "v1", "shares", "shares.json"), (value) => selectFlatOwnerRecords(value, "shares", ownerUserId)),
    selectedJsonUsage(join(root, "v1", "forms", "forms.json"), (value) => selectFormRecords(value, ownerUserId)),
    selectedJsonUsage(join(root, "v1", "clusters", "clusters.json"), (value) => selectClusterRecords(value, ownerUserId))
  ]);
  return {
    databases: combineUsage(databaseFiles, databaseKeys),
    functions: functionFiles,
    originals: combineUsage(account, deviceKeys, shares, forms, clusters)
  };
}

async function storedPathUsage(path: string): Promise<UsageCounter> {
  try {
    const info = await stat(path);
    if (info.isFile()) return isTemporaryStoragePath(path) ? { bytes: 0, fileCount: 0 } : { bytes: info.size, fileCount: 1 };
    if (!info.isDirectory()) return { bytes: 0, fileCount: 0 };
    const entries = await readdir(path);
    return combineUsage(...await Promise.all(entries.map((entry) => storedPathUsage(join(path, entry)))));
  } catch (error: unknown) {
    if (isNotFound(error)) return { bytes: 0, fileCount: 0 };
    throw error;
  }
}

async function selectedJsonUsage(path: string, select: (value: unknown) => OwnerJsonSelection): Promise<UsageCounter> {
  try {
    const contents = await readFile(path, "utf8");
    const selected = select(JSON.parse(contents));
    if (selected.selectedItems === 0) return { bytes: 0, fileCount: 0 };
    const bytes = selected.selectedItems === selected.totalItems
      ? Buffer.byteLength(contents)
      : Buffer.byteLength(JSON.stringify(selected.value, null, 2));
    return { bytes, fileCount: selected.selectedItems };
  } catch (error: unknown) {
    if (isNotFound(error)) return { bytes: 0, fileCount: 0 };
    throw error;
  }
}

function selectFlatOwnerRecords(value: unknown, key: string, ownerUserId: string, ownerKey = "ownerUserId"): OwnerJsonSelection {
  const records = objectArray(value, key);
  const selected = records.filter((record) => objectString(record, ownerKey) === ownerUserId);
  return { value: { [key]: selected }, selectedItems: selected.length, totalItems: records.length };
}

function selectFormRecords(value: unknown, ownerUserId: string): OwnerJsonSelection {
  const forms = objectArray(value, "forms");
  const responses = objectArray(value, "responses");
  const selectedForms = forms.filter((form) => objectString(form, "ownerUserId") === ownerUserId);
  const formIds = new Set(selectedForms.map((form) => objectString(form, "id")).filter((id): id is string => Boolean(id)));
  const selectedResponses = responses.filter((response) => formIds.has(objectString(response, "formId") ?? ""));
  return {
    value: { forms: selectedForms, responses: selectedResponses },
    selectedItems: selectedForms.length + selectedResponses.length,
    totalItems: forms.length + responses.length
  };
}

function selectClusterRecords(value: unknown, ownerUserId: string): OwnerJsonSelection {
  const invitations = objectArray(value, "invitations");
  const peers = objectArray(value, "peers");
  const mounts = objectArray(value, "mounts");
  const selectedInvitations = invitations.filter((record) => objectString(record, "ownerUserId") === ownerUserId);
  const selectedPeers = peers.filter((record) => objectString(record, "ownerUserId") === ownerUserId);
  const selectedMounts = mounts.filter((record) => objectString(record, "ownerUserId") === ownerUserId);
  return {
    value: { invitations: selectedInvitations, peers: selectedPeers, mounts: selectedMounts },
    selectedItems: selectedInvitations.length + selectedPeers.length + selectedMounts.length,
    totalItems: invitations.length + peers.length + mounts.length
  };
}

function objectArray(value: unknown, key: string): Record<string, unknown>[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  const records = (value as Record<string, unknown>)[key];
  return Array.isArray(records) ? records.filter((record): record is Record<string, unknown> => Boolean(record) && typeof record === "object" && !Array.isArray(record)) : [];
}

function objectString(value: Record<string, unknown>, key: string): string | null {
  return typeof value[key] === "string" ? value[key] : null;
}

function combineUsage(...values: UsageCounter[]): UsageCounter {
  return values.reduce((total, value) => ({ bytes: total.bytes + value.bytes, fileCount: total.fileCount + value.fileCount }), { bytes: 0, fileCount: 0 });
}

function isTemporaryStoragePath(path: string): boolean {
  return /(?:\.tmp|\.uploading|\.import)$/.test(path);
}

function contentTypeFor(key: string): string {
  const extension = key.slice(key.lastIndexOf(".")).toLowerCase();
  return contentTypes[extension] ?? "application/octet-stream";
}

function resolvedContentType(key: string, storedContentType?: string): string {
  if (storedContentType !== "application/octet-stream") return storedContentType ?? contentTypeFor(key);
  const inferredContentType = contentTypeFor(key);
  return inferredContentType === "application/octet-stream" ? storedContentType : inferredContentType;
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
  if (category === "paste") return file.nativeType === "paste";
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
    case "form": return { format: "zo-native", type, version: 1, createdAt, title: "Untitled form", description: "", questions: [{ id: "question-1", title: "", description: "", type: "multiple-choice", options: ["Option 1"], required: false }] };
    case "paste": return { format: "zo-native", type, version: 1, createdAt, language: "plaintext", tags: [], text: "" };
  }
}

function pasteContentRevision(content: Record<string, unknown>): string {
  return createHash("sha256").update(JSON.stringify({ format: content.format, type: content.type, version: content.version, language: content.language, tags: content.tags, text: content.text })).digest("hex");
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
