import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { randomUUID } from "node:crypto";

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
};

export type ReadDriveFile = DriveFile & {
  filePath: string;
};

export type DriveFolder = {
  key: string;
  name: string;
  updatedAt: string;
};

type StorageTarget = {
  userId: string;
  key: string;
};

type WriteDriveFile = StorageTarget & {
  content: Buffer | Readable;
  contentType?: string;
};

type ListDriveFiles = {
  userId: string;
  prefix?: string;
  query?: string;
};

type ListDriveFolders = {
  userId: string;
  prefix?: string;
};

const contentTypes: Record<string, string> = {
  ".gif": "image/gif",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".json": "application/json",
  ".md": "text/markdown",
  ".mp3": "audio/mpeg",
  ".mp4": "video/mp4",
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".txt": "text/plain",
  ".wav": "audio/wav",
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

  async write({ userId, key, content }: WriteDriveFile): Promise<DriveFile> {
    const target = this.resolveFilePath(userId, key);
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

    return this.describe(target, key);
  }

  async read({ userId, key }: StorageTarget): Promise<ReadDriveFile> {
    const target = this.resolveFilePath(userId, key);
    return { ...(await this.describe(target, key)), filePath: target };
  }

  createReadStream(filePath: string) {
    return createReadStream(filePath);
  }

  async remove({ userId, key }: StorageTarget): Promise<void> {
    const target = this.resolveFilePath(userId, key);
    await rm(target);
    await this.removeEmptyParents(dirname(target), this.userFilesRoot(userId));
  }

  async removeUser({ userId }: Pick<StorageTarget, "userId">): Promise<void> {
    const safeUserId = this.normalizeUserId(userId);
    await rm(join(this.root, "v1", "users", safeUserId), { force: true, recursive: true });
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

  async list({ userId, prefix = "", query = "" }: ListDriveFiles): Promise<DriveFile[]> {
    const filesRoot = this.userFilesRoot(userId);
    const normalizedPrefix = prefix ? this.normalizeKey(prefix, { allowEmpty: false }) : "";
    const normalizedQuery = query.trim().toLowerCase();
    const files = await this.collectFiles(filesRoot, filesRoot);

    return files
      .filter((file) => !normalizedPrefix || file.key === normalizedPrefix || file.key.startsWith(`${normalizedPrefix}/`))
      .filter((file) => !normalizedQuery || file.name.toLowerCase().includes(normalizedQuery))
      .sort((left, right) => left.key.localeCompare(right.key));
  }

  async getUsage({ userId }: Pick<StorageTarget, "userId">): Promise<{ fileCount: number; usedBytes: number }> {
    const files = await this.list({ userId });
    return {
      fileCount: files.length,
      usedBytes: files.reduce((total, file) => total + file.size, 0)
    };
  }

  private userFilesRoot(userId: string): string {
    const safeUserId = this.normalizeUserId(userId);
    return join(this.root, "v1", "users", safeUserId, "files");
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

  private async collectFiles(currentDirectory: string, filesRoot: string): Promise<DriveFile[]> {
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
          return this.collectFiles(entryPath, filesRoot);
        }
        if (!entry.isFile()) {
          return [];
        }
        const key = relative(filesRoot, entryPath).split(sep).join("/");
        return [await this.describe(entryPath, key)];
      })
    );
    return files.flat();
  }

  private async describe(filePath: string, key: string): Promise<DriveFile> {
    const fileStat = await stat(filePath);
    return {
      key,
      name: basename(key),
      size: fileStat.size,
      contentType: contentTypeFor(key),
      updatedAt: fileStat.mtime.toISOString()
    };
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

function isNotFound(error: unknown): error is NodeJS.ErrnoException {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}
