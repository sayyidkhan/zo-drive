import { mkdtemp, readFile, rm } from "node:fs/promises";
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

  it("creates and lists empty folders without creating fake user files", async () => {
    const storage = await createStorage();

    await expect(storage.createFolder({ userId: "user_123", key: "Projects/2026" })).resolves.toMatchObject({ key: "Projects/2026", name: "2026" });
    await expect(storage.listFolders({ userId: "user_123" })).resolves.toMatchObject([{ key: "Projects", name: "Projects" }]);
    await expect(storage.listFolders({ userId: "user_123", prefix: "Projects" })).resolves.toMatchObject([{ key: "Projects/2026", name: "2026" }]);
    await expect(storage.getUsage({ userId: "user_123" })).resolves.toEqual({ fileCount: 0, usedBytes: 0 });
  });
});
