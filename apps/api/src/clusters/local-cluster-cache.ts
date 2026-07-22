import { createHash, randomUUID } from "node:crypto";
import { createWriteStream } from "node:fs";
import { mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

type CachedFile = {
  id: string;
  ownerUserId: string;
  mountId: string;
  key: string;
  name: string;
  size: number;
  contentType: string;
  updatedAt: string;
  lastAccessedAt: string;
};

type CachedManifest = {
  ownerUserId: string;
  mountId: string;
  objects: unknown[];
  cachedAt: string;
  lastAccessedAt: string;
};

type CacheData = {
  files: CachedFile[];
  manifests: CachedManifest[];
};

export type CachedClusterFile = Omit<CachedFile, "id"> & { filePath: string };
export type CachedClusterManifest = Omit<CachedManifest, "lastAccessedAt">;

/**
 * A private, mount-scoped LRU cache for remote Shared Drive content. It never
 * writes into a user's Drive namespace or contributes to their Drive quota.
 */
export class LocalClusterCache {
  private readonly cacheFile: string;
  private readonly filesDirectory: string;
  private readonly maxBytes: number;
  private writeChain = Promise.resolve();

  constructor({ root, maxBytes }: { root: string; maxBytes: number }) {
    if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) throw new Error("Cluster cache size must be a positive integer");
    const cacheRoot = join(root, "v1", "clusters", "cache");
    this.cacheFile = join(cacheRoot, "cache.json");
    this.filesDirectory = join(cacheRoot, "files");
    this.maxBytes = maxBytes;
  }

  async getManifest({ ownerUserId, mountId }: { ownerUserId: string; mountId: string }): Promise<CachedClusterManifest | null> {
    return this.withWriteLock(async () => {
      const data = await this.read();
      const manifest = data.manifests.find((item) => item.ownerUserId === ownerUserId && item.mountId === mountId);
      if (!manifest) return null;
      manifest.lastAccessedAt = new Date().toISOString();
      await this.write(data);
      return { ownerUserId: manifest.ownerUserId, mountId: manifest.mountId, objects: manifest.objects, cachedAt: manifest.cachedAt };
    });
  }

  async putManifest({ ownerUserId, mountId, objects }: { ownerUserId: string; mountId: string; objects: unknown[] }): Promise<void> {
    await this.withWriteLock(async () => {
      const data = await this.read();
      const now = new Date().toISOString();
      const index = data.manifests.findIndex((item) => item.ownerUserId === ownerUserId && item.mountId === mountId);
      const manifest: CachedManifest = { ownerUserId, mountId, objects, cachedAt: now, lastAccessedAt: now };
      if (index < 0) data.manifests.push(manifest);
      else data.manifests[index] = manifest;
      await this.write(data);
    });
  }

  async getFile({ ownerUserId, mountId, key }: { ownerUserId: string; mountId: string; key: string }): Promise<CachedClusterFile | null> {
    return this.withWriteLock(async () => {
      const data = await this.read();
      const index = data.files.findIndex((item) => item.ownerUserId === ownerUserId && item.mountId === mountId && item.key === key);
      if (index < 0) return null;
      const file = data.files[index]!;
      const filePath = this.filePath(file.id);
      try {
        await stat(filePath);
      } catch {
        data.files.splice(index, 1);
        await this.write(data);
        return null;
      }
      file.lastAccessedAt = new Date().toISOString();
      await this.write(data);
      return { ...file, filePath };
    });
  }

  async putFile({ ownerUserId, mountId, key, name, size, contentType, updatedAt, body }: { ownerUserId: string; mountId: string; key: string; name: string; size: number; contentType: string; updatedAt: string; body: ReadableStream<Uint8Array> }): Promise<void> {
    await mkdir(this.filesDirectory, { recursive: true, mode: 0o700 });
    const temporaryPath = join(this.filesDirectory, `.${randomUUID()}.uploading`);
    try {
      await pipeline(Readable.fromWeb(body as unknown as import("node:stream/web").ReadableStream), createWriteStream(temporaryPath, { mode: 0o600 }));
      const cachedSize = (await stat(temporaryPath)).size;
      await this.withWriteLock(async () => {
        const data = await this.read();
        const id = cacheId({ ownerUserId, mountId, key });
        const previousIndex = data.files.findIndex((item) => item.id === id);
        const now = new Date().toISOString();
        const file: CachedFile = { id, ownerUserId, mountId, key, name, size: cachedSize || size, contentType, updatedAt, lastAccessedAt: now };
        await rename(temporaryPath, this.filePath(id));
        if (previousIndex < 0) data.files.push(file);
        else data.files[previousIndex] = file;
        await this.evict(data);
        await this.write(data);
      });
    } catch (error) {
      await rm(temporaryPath, { force: true });
      throw error;
    }
  }

  async invalidateMount({ ownerUserId, mountId }: { ownerUserId: string; mountId: string }): Promise<void> {
    await this.withWriteLock(async () => {
      const data = await this.read();
      const removed = data.files.filter((item) => item.ownerUserId === ownerUserId && item.mountId === mountId);
      data.files = data.files.filter((item) => item.ownerUserId !== ownerUserId || item.mountId !== mountId);
      data.manifests = data.manifests.filter((item) => item.ownerUserId !== ownerUserId || item.mountId !== mountId);
      await Promise.all(removed.map((item) => rm(this.filePath(item.id), { force: true })));
      await this.write(data);
    });
  }

  private async evict(data: CacheData): Promise<void> {
    let usedBytes = data.files.reduce((total, file) => total + file.size, 0);
    const evicted: CachedFile[] = [];
    for (const file of [...data.files].sort((left, right) => left.lastAccessedAt.localeCompare(right.lastAccessedAt))) {
      if (usedBytes <= this.maxBytes) break;
      usedBytes -= file.size;
      evicted.push(file);
    }
    if (evicted.length === 0) return;
    const evictedIds = new Set(evicted.map((item) => item.id));
    data.files = data.files.filter((item) => !evictedIds.has(item.id));
    await Promise.all(evicted.map((item) => rm(this.filePath(item.id), { force: true })));
  }

  private filePath(id: string): string {
    return join(this.filesDirectory, id);
  }

  private async withWriteLock<T>(work: () => Promise<T>): Promise<T> {
    let release!: () => void;
    const previous = this.writeChain;
    this.writeChain = new Promise<void>((resolve) => { release = resolve; });
    await previous;
    try {
      return await work();
    } finally {
      release();
    }
  }

  private async read(): Promise<CacheData> {
    try {
      const value = JSON.parse(await readFile(this.cacheFile, "utf8")) as Partial<CacheData>;
      return { files: Array.isArray(value.files) ? value.files : [], manifests: Array.isArray(value.manifests) ? value.manifests : [] };
    } catch (error: unknown) {
      if (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT") return { files: [], manifests: [] };
      throw error;
    }
  }

  private async write(data: CacheData): Promise<void> {
    await mkdir(dirname(this.cacheFile), { recursive: true, mode: 0o700 });
    const temporaryPath = `${this.cacheFile}.${randomUUID()}.tmp`;
    await writeFile(temporaryPath, JSON.stringify(data), { mode: 0o600 });
    await rename(temporaryPath, this.cacheFile);
  }
}

function cacheId({ ownerUserId, mountId, key }: { ownerUserId: string; mountId: string; key: string }): string {
  return createHash("sha256").update(`${ownerUserId}\0${mountId}\0${key}`).digest("hex");
}
