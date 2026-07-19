import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { LocalDriveStorage, UnsafeDrivePathError } from "./local-drive-storage.js";

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
    await expect(storage.getUsage({ userId: "user_123" })).resolves.toEqual({ fileCount: 2, usedBytes: 8 });
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

  it("moves files into Trash, restores them with their metadata, and purges expired entries", async () => {
    const storage = await createStorage();
    await storage.write({ userId: "alice", key: "Notes/plan.txt", content: Buffer.from("ship it"), contentType: "text/plain" });
    await storage.setStarred({ userId: "alice", key: "Notes/plan.txt", starred: true });

    const item = await storage.trash({ userId: "alice", key: "Notes/plan.txt" });
    await expect(storage.list({ userId: "alice" })).resolves.toEqual([]);
    await expect(storage.listTrash({ userId: "alice" })).resolves.toMatchObject([{ id: item.id, originalKey: "Notes/plan.txt", starred: true }]);
    await expect(storage.getUsage({ userId: "alice" })).resolves.toEqual({ fileCount: 1, usedBytes: 7 });

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

  it("creates and lists empty folders without creating fake user files", async () => {
    const storage = await createStorage();

    await expect(storage.createFolder({ userId: "user_123", key: "Projects/2026" })).resolves.toMatchObject({ key: "Projects/2026", name: "2026" });
    await expect(storage.listFolders({ userId: "user_123" })).resolves.toMatchObject([{ key: "Projects", name: "Projects" }]);
    await expect(storage.listFolders({ userId: "user_123", prefix: "Projects" })).resolves.toMatchObject([{ key: "Projects/2026", name: "2026" }]);
    await expect(storage.getUsage({ userId: "user_123" })).resolves.toEqual({ fileCount: 0, usedBytes: 0 });
  });
});
