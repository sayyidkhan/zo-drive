import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { LocalDriveStorage, MIN_STORAGE_QUOTA_BYTES, StorageQuotaConfigurationError, StorageQuotaExceededError, UnsafeDrivePathError } from "./local-drive-storage.js";

describe("LocalDriveStorage", () => {
  const roots: string[] = [];

  afterEach(async () => {
    await Promise.all(roots.splice(0).map((root) => rm(root, { force: true, recursive: true })));
  });

  async function createStorage() {
    const root = await mkdtemp(join(tmpdir(), "zo-drive-storage-"));
    roots.push(root);
    return new LocalDriveStorage({ root });
  }

  it("stores a user's file below the configured data root", async () => {
    const storage = await createStorage();

    await storage.write({
      userId: "user_123",
      key: "Work/plan.txt",
      content: Buffer.from("ship it"),
      contentType: "text/plain"
    });

    const stored = await readFile(join(storage.root, "v1", "users", "user_123", "files", "Work", "plan.txt"), "utf8");
    expect(stored).toBe("ship it");
  });

  it("never allows a key to escape the user's file namespace", async () => {
    const storage = await createStorage();

    await expect(
      storage.write({
        userId: "user_123",
        key: "../../outside.txt",
        content: Buffer.from("nope"),
        contentType: "text/plain"
      })
    ).rejects.toBeInstanceOf(UnsafeDrivePathError);
  });

  it("keeps users isolated when listing, reading, and deleting files", async () => {
    const storage = await createStorage();
    await storage.write({ userId: "alice", key: "shared.txt", content: Buffer.from("alice"), contentType: "text/plain" });
    await storage.write({ userId: "bob", key: "shared.txt", content: Buffer.from("bob"), contentType: "text/plain" });

    await expect(storage.read({ userId: "alice", key: "shared.txt" })).resolves.toMatchObject({ key: "shared.txt" });
    await expect(storage.remove({ userId: "alice", key: "shared.txt" })).resolves.toBeUndefined();
    await expect(storage.read({ userId: "alice", key: "shared.txt" })).rejects.toMatchObject({ code: "ENOENT" });
    await expect(storage.read({ userId: "bob", key: "shared.txt" })).resolves.toMatchObject({ key: "shared.txt" });
  });

  it("copies a file server-side, preserves metadata, and requires explicit overwrite", async () => {
    const storage = await createStorage();
    await storage.write({ userId: "alice", key: "Plans/source.txt", content: Buffer.from("copy me"), contentType: "text/plain" });
    await storage.setStarred({ userId: "alice", key: "Plans/source.txt", starred: true });

    await expect(storage.copyFile({ userId: "alice", key: "Plans/source.txt", destination: "Archive/copy.txt" })).resolves.toMatchObject({ key: "Archive/copy.txt", contentType: "text/plain", starred: true });
    await expect(readFile(join(storage.root, "v1", "users", "alice", "files", "Archive", "copy.txt"), "utf8")).resolves.toBe("copy me");
    await expect(storage.read({ userId: "alice", key: "Plans/source.txt" })).resolves.toMatchObject({ key: "Plans/source.txt" });
    await expect(storage.copyFile({ userId: "alice", key: "Plans/source.txt", destination: "Archive/copy.txt" })).rejects.toMatchObject({ code: "EEXIST" });

    await storage.write({ userId: "alice", key: "Plans/source.txt", content: Buffer.from("new copy"), contentType: "text/plain" });
    await expect(storage.copyFile({ userId: "alice", key: "Plans/source.txt", destination: "Archive/copy.txt", overwrite: true })).resolves.toMatchObject({ size: 8 });
  });

  it("moves an account's complete file namespace when its username changes", async () => {
    const storage = await createStorage();
    await storage.write({ userId: "sayyid", key: "Notes/plan.txt", content: Buffer.from("ship it"), contentType: "text/plain" });

    await storage.renameUser({ fromUserId: "sayyid", toUserId: "sayyidkhan" });

    await expect(storage.read({ userId: "sayyid", key: "Notes/plan.txt" })).rejects.toMatchObject({ code: "ENOENT" });
    await expect(storage.read({ userId: "sayyidkhan", key: "Notes/plan.txt" })).resolves.toMatchObject({ key: "Notes/plan.txt" });
  });

  it("lists relative keys, filters by name, and calculates storage usage", async () => {
    const storage = await createStorage();
    await storage.write({ userId: "user_123", key: "Work/plan.txt", content: Buffer.from("abc"), contentType: "text/plain" });
    await storage.write({ userId: "user_123", key: "Photos/cat.jpg", content: Buffer.from("12345"), contentType: "image/jpeg" });

    await expect(storage.list({ userId: "user_123", prefix: "Work" })).resolves.toMatchObject([
      { key: "Work/plan.txt", size: 3, contentType: "text/plain" }
    ]);
    await expect(storage.list({ userId: "user_123", query: "cat" })).resolves.toMatchObject([
      { key: "Photos/cat.jpg", size: 5, contentType: "image/jpeg" }
    ]);
    await expect(storage.getUsage({ userId: "user_123" })).resolves.toMatchObject({ fileCount: 2, usedBytes: 8, quotaBytes: 100 * 1024 * 1024 * 1024, quotaAvailableBytes: 100 * 1024 * 1024 * 1024 - 8, totalBytes: expect.any(Number), availableBytes: expect.any(Number), systemUsedBytes: expect.any(Number), categories: expect.arrayContaining([{ id: "photos", bytes: 5, fileCount: 1 }, { id: "documents", bytes: 3, fileCount: 1 }]) });
  });

  it("enforces the configured quota while allowing a replacement file to reuse its allocation", async () => {
    const root = await mkdtemp(join(tmpdir(), "zo-drive-quota-"));
    roots.push(root);
    const storage = new LocalDriveStorage({ root, quotaBytes: 5 });
    await storage.write({ userId: "user_123", key: "draft.txt", content: Buffer.from("12345"), contentType: "text/plain" });
    await expect(storage.write({ userId: "user_123", key: "another.txt", content: Buffer.from("6"), contentType: "text/plain" })).rejects.toBeInstanceOf(StorageQuotaExceededError);
    await expect(storage.write({ userId: "user_123", key: "draft.txt", content: Buffer.from("1234"), contentType: "text/plain" })).resolves.toMatchObject({ size: 4 });
  });

  it("persists a per-user storage limit and enforces the 1 GB to 80% machine range", async () => {
    const storage = await createStorage();
    const initialUsage = await storage.getUsage({ userId: "user_123" });
    const selectedQuota = Math.min(200 * 1024 * 1024 * 1024, initialUsage.maxQuotaBytes);

    await expect(storage.setQuota({ userId: "user_123", quotaBytes: selectedQuota })).resolves.toMatchObject({ quotaBytes: selectedQuota });
    await expect(new LocalDriveStorage({ root: storage.root }).getUsage({ userId: "user_123" })).resolves.toMatchObject({ quotaBytes: selectedQuota });
    await expect(storage.setQuota({ userId: "user_123", quotaBytes: MIN_STORAGE_QUOTA_BYTES - 1 })).rejects.toBeInstanceOf(StorageQuotaConfigurationError);
    await expect(storage.setQuota({ userId: "user_123", quotaBytes: initialUsage.maxQuotaBytes + 1 })).rejects.toBeInstanceOf(StorageQuotaConfigurationError);
  });

  it("filters files by type, text content, star state, and modified date", async () => {
    const storage = await createStorage();
    await storage.write({ userId: "user_123", key: "Notes/strategy.txt", content: Buffer.from("Compound growth plan"), contentType: "text/plain" });
    await storage.write({ userId: "user_123", key: "Photos/logo.png", content: Buffer.from("image"), contentType: "image/png" });
    await storage.setStarred({ userId: "user_123", key: "Notes/strategy.txt", starred: true });

    await expect(storage.list({ userId: "user_123", type: "document", contentQuery: "growth", starred: true, modifiedAfter: "2020-01-01T00:00:00.000Z" })).resolves.toMatchObject([{ key: "Notes/strategy.txt", starred: true }]);
    await expect(storage.list({ userId: "user_123", type: "image", contentQuery: "growth" })).resolves.toEqual([]);
  });

  it("persists starred files in the user's namespace and clears stars when files are deleted", async () => {
    const storage = await createStorage();
    await storage.write({ userId: "alice", key: "Notes/plan.txt", content: Buffer.from("ship it"), contentType: "text/plain" });
    await storage.write({ userId: "bob", key: "Notes/plan.txt", content: Buffer.from("private"), contentType: "text/plain" });

    await expect(storage.setStarred({ userId: "alice", key: "Notes/plan.txt", starred: true })).resolves.toMatchObject({ starred: true });
    await expect(storage.listStarred({ userId: "alice" })).resolves.toMatchObject([{ key: "Notes/plan.txt", starred: true }]);
    await expect(storage.listStarred({ userId: "bob" })).resolves.toEqual([]);

    await storage.remove({ userId: "alice", key: "Notes/plan.txt" });
    await expect(storage.listStarred({ userId: "alice" })).resolves.toEqual([]);
  });

  it("renames files in place while preserving their metadata", async () => {
    const storage = await createStorage();
    await storage.write({ userId: "alice", key: "Notes/plan.txt", content: Buffer.from("ship it"), contentType: "text/plain" });
    await storage.setStarred({ userId: "alice", key: "Notes/plan.txt", starred: true });

    await expect(storage.renameFile({ userId: "alice", key: "Notes/plan.txt", name: "strategy.txt" })).resolves.toMatchObject({ key: "Notes/strategy.txt", name: "strategy.txt", contentType: "text/plain", starred: true });
    await expect(storage.read({ userId: "alice", key: "Notes/plan.txt" })).rejects.toMatchObject({ code: "ENOENT" });
    await expect(storage.read({ userId: "alice", key: "Notes/strategy.txt" })).resolves.toMatchObject({ starred: true });
  });

  it("moves files across folders while preserving metadata", async () => {
    const storage = await createStorage();
    await storage.write({ userId: "alice", key: "Notes/plan.txt", content: Buffer.from("ship it"), contentType: "text/plain" });
    await storage.setStarred({ userId: "alice", key: "Notes/plan.txt", starred: true });

    await expect(storage.moveFile({ userId: "alice", key: "Notes/plan.txt", destination: "Archive/2026/plan.txt" })).resolves.toMatchObject({ key: "Archive/2026/plan.txt", name: "plan.txt", starred: true });
    await expect(storage.read({ userId: "alice", key: "Notes/plan.txt" })).rejects.toMatchObject({ code: "ENOENT" });
    await expect(storage.read({ userId: "alice", key: "Archive/2026/plan.txt" })).resolves.toMatchObject({ starred: true });
  });

  it("moves files into Trash, restores them with their metadata, and purges expired entries", async () => {
    const storage = await createStorage();
    await storage.write({ userId: "alice", key: "Notes/plan.txt", content: Buffer.from("ship it"), contentType: "text/plain" });
    await storage.setStarred({ userId: "alice", key: "Notes/plan.txt", starred: true });

    const item = await storage.trash({ userId: "alice", key: "Notes/plan.txt" });
    await expect(storage.list({ userId: "alice" })).resolves.toEqual([]);
    await expect(storage.listTrash({ userId: "alice" })).resolves.toMatchObject([{ id: item.id, originalKey: "Notes/plan.txt", starred: true }]);
    await expect(storage.getUsage({ userId: "alice" })).resolves.toMatchObject({ fileCount: 1, usedBytes: 7, categories: expect.arrayContaining([{ id: "trash", bytes: 7, fileCount: 1 }]) });

    await expect(storage.restoreTrash({ userId: "alice", id: item.id })).resolves.toMatchObject({ key: "Notes/plan.txt", starred: true, contentType: "text/plain" });
    await expect(storage.read({ userId: "alice", key: "Notes/plan.txt" })).resolves.toMatchObject({ starred: true });

    const expired = await storage.trash({ userId: "alice", key: "Notes/plan.txt" });
    const tablePath = join(storage.root, "v1", "users", "alice", "trash.json");
    await writeFile(tablePath, JSON.stringify({ items: [{ ...expired, expiresAt: "2020-01-01T00:00:00.000Z" }] }));
    await storage.purgeExpiredTrash();
    await expect(storage.listTrash({ userId: "alice" })).resolves.toEqual([]);
  });

  it("preserves the supplied MIME type for arbitrary file formats", async () => {
    const storage = await createStorage();
    await storage.write({ userId: "user_123", key: "Designs/landing.sketch", content: Buffer.from("design"), contentType: "application/vnd.sketch" });

    await expect(storage.read({ userId: "user_123", key: "Designs/landing.sketch" })).resolves.toMatchObject({ contentType: "application/vnd.sketch" });
    await expect(storage.list({ userId: "user_123" })).resolves.toMatchObject([{ key: "Designs/landing.sketch", contentType: "application/vnd.sketch" }]);
  });

  it("creates structured Zo-native files without allowing an accidental overwrite", async () => {
    const storage = await createStorage();

    const document = await storage.createNativeFile({ userId: "user_123", key: "Projects/Untitled document", type: "document" });

    expect(document).toMatchObject({ key: "Projects/Untitled document", contentType: "application/vnd.zo.document+json", nativeType: "document" });
    const stored = JSON.parse(await readFile(join(storage.root, "v1", "users", "user_123", "files", "Projects", "Untitled document"), "utf8"));
    expect(stored).toMatchObject({ format: "zo-native", type: "document", version: 1 });
    await expect(storage.createNativeFile({ userId: "user_123", key: "Projects/Untitled document", type: "document" })).rejects.toMatchObject({ code: "EEXIST" });
  });

  it("creates and filters Zo Paste files as a distinct native type", async () => {
    const storage = await createStorage();

    const paste = await storage.createNativeFile({ userId: "user_123", key: "Notes/deploy-script", type: "paste" });

    expect(paste).toMatchObject({ contentType: "application/vnd.zo.paste+json", nativeType: "paste" });
    await expect(storage.list({ userId: "user_123", type: "paste" })).resolves.toMatchObject([{ key: "Notes/deploy-script", nativeType: "paste" }]);
    const stored = JSON.parse(await readFile(join(storage.root, "v1", "users", "user_123", "files", "Notes", "deploy-script"), "utf8"));
    expect(stored).toMatchObject({ format: "zo-native", type: "paste", version: 1, language: "plaintext", tags: [], text: "" });
  });

  it("creates and lists empty folders without creating fake user files", async () => {
    const storage = await createStorage();

    await expect(storage.createFolder({ userId: "user_123", key: "Projects/2026" })).resolves.toMatchObject({ key: "Projects/2026", name: "2026" });
    await expect(storage.listFolders({ userId: "user_123" })).resolves.toMatchObject([{ key: "Projects", name: "Projects" }]);
    await expect(storage.listFolders({ userId: "user_123", prefix: "Projects" })).resolves.toMatchObject([{ key: "Projects/2026", name: "2026" }]);
    await expect(storage.getUsage({ userId: "user_123" })).resolves.toMatchObject({ fileCount: 0, usedBytes: 0, categories: expect.arrayContaining([{ id: "photos", bytes: 0, fileCount: 0 }]) });
  });
});
