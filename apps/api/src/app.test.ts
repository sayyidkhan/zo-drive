import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createApp } from "./app.js";
import { InvalidApiKeyRateLimiter } from "./auth/invalid-api-key-rate-limiter.js";
import { LocalAuthStore } from "./auth/local-auth-store.js";
import { LocalApiKeyStore } from "./auth/local-api-key-store.js";
import { SessionService } from "./auth/session.js";
import { LocalShareStore } from "./sharing/local-share-store.js";
import { LocalFormStore } from "./forms/local-form-store.js";
import { LocalDatabaseStore } from "./databases/local-database-store.js";
import { LocalDriveStorage } from "./storage/local-drive-storage.js";

describe("Zo Drive API", () => {
  const roots: string[] = [];

  afterEach(async () => {
    vi.unstubAllGlobals();
    await Promise.all(roots.splice(0).map((root) => rm(root, { force: true, recursive: true })));
  });

  async function createTestApp({ quotaBytes }: { quotaBytes?: number } = {}) {
    const root = await mkdtemp(join(tmpdir(), "zo-drive-api-"));
    roots.push(root);
    return createApp({
      storage: new LocalDriveStorage({ root, quotaBytes }),
      resolveUserId: (request) => request.headers.get("x-test-user-id")
    });
  }

  it("reports health without requiring a user", async () => {
    const app = await createTestApp();

    const response = await app.request("http://localhost/health");

    await expect(response.json()).resolves.toEqual({ status: "ok" });
  });

  it("requires an authenticated user for drive operations", async () => {
    const app = await createTestApp();

    const response = await app.request("http://localhost/objects");

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "UNAUTHORIZED" } });
  });

  it("pairs a one-time cluster invitation and restricts every peer operation to its folder", async () => {
    const app = await createTestApp();
    const headers = { "content-type": "application/json", "x-test-user-id": "alice" };
    await app.request("http://localhost/objects", { method: "POST", headers: { ...headers, "x-zo-drive-file-name": encodeURIComponent("inside.txt"), "x-zo-drive-path": encodeURIComponent("Shared") }, body: "inside" });
    await app.request("http://localhost/objects", { method: "POST", headers: { ...headers, "x-zo-drive-file-name": encodeURIComponent("outside.txt") }, body: "outside" });
    const invitation = await app.request("http://localhost/clusters/invitations", { method: "POST", headers, body: JSON.stringify({ folder: "Shared" }) });
    expect(invitation.status).toBe(201);
    const invite = await invitation.json() as { token: string };
    const accepted = await app.request("http://localhost/cluster/invitations/accept", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ inviteToken: invite.token }) });
    expect(accepted.status).toBe(201);
    const peer = await accepted.json() as { peerId: string; peerKey: string; author: string };
    expect(peer.author).toBe("alice");
    const objects = await app.request(`http://localhost/cluster/peers/${peer.peerId}/objects`, { headers: { authorization: `Bearer ${peer.peerKey}` } });
    await expect(objects.json()).resolves.toMatchObject({ objects: [expect.objectContaining({ key: "inside.txt" })] });
    const peerHeaders = { authorization: `Bearer ${peer.peerKey}`, "content-type": "text/plain", "x-zo-drive-file-name": encodeURIComponent("collab.txt") };
    const created = await app.request(`http://localhost/cluster/peers/${peer.peerId}/objects`, { method: "POST", headers: peerHeaders, body: "collaboration" });
    expect(created.status).toBe(201);
    await expect(created.json()).resolves.toMatchObject({ key: "collab.txt", name: "collab.txt" });
    const escaped = await app.request(`http://localhost/cluster/peers/${peer.peerId}/objects`, { method: "POST", headers: { ...peerHeaders, "x-zo-drive-file-name": encodeURIComponent("../escaped.txt") }, body: "nope" });
    expect(escaped.status).toBe(400);
    const downloaded = await app.request(`http://localhost/cluster/peers/${peer.peerId}/objects/${encodeURIComponent("collab.txt")}`, { headers: { authorization: `Bearer ${peer.peerKey}` } });
    await expect(downloaded.text()).resolves.toBe("collaboration");
    const renamed = await app.request(`http://localhost/cluster/peers/${peer.peerId}/objects/${encodeURIComponent("collab.txt")}`, { method: "PATCH", headers: { authorization: `Bearer ${peer.peerKey}`, "content-type": "application/json" }, body: JSON.stringify({ name: "renamed.txt" }) });
    await expect(renamed.json()).resolves.toMatchObject({ key: "renamed.txt" });
    expect((await app.request(`http://localhost/cluster/peers/${peer.peerId}/objects/${encodeURIComponent("renamed.txt")}`, { method: "DELETE", headers: { authorization: `Bearer ${peer.peerKey}` } })).status).toBe(204);
    const afterDelete = await app.request(`http://localhost/cluster/peers/${peer.peerId}/objects`, { headers: { authorization: `Bearer ${peer.peerKey}` } });
    await expect(afterDelete.json()).resolves.toMatchObject({ objects: [expect.objectContaining({ key: "inside.txt" })] });
    expect((await app.request("http://localhost/cluster/invitations/accept", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ inviteToken: invite.token }) })).status).toBe(410);
  });

  it("enforces viewer access and lets the owner change or revoke it", async () => {
    const app = await createTestApp();
    const ownerHeaders = { "content-type": "application/json", "x-test-user-id": "alice" };
    await app.request("http://localhost/objects", { method: "POST", headers: { ...ownerHeaders, "x-zo-drive-file-name": encodeURIComponent("brief.txt"), "x-zo-drive-path": encodeURIComponent("Client") }, body: "private brief" });
    const invitation = await app.request("http://localhost/clusters/invitations", { method: "POST", headers: ownerHeaders, body: JSON.stringify({ folder: "Client", role: "viewer", recipient: "Maya - Finance" }) });
    expect(invitation.status).toBe(201);
    const invite = await invitation.json() as { token: string; role: string; recipient: string };
    expect(invite).toMatchObject({ role: "viewer", recipient: "Maya - Finance" });
    const accepted = await app.request("http://localhost/cluster/invitations/accept", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ inviteToken: invite.token }) });
    const peer = await accepted.json() as { peerId: string; peerKey: string; role: string };
    expect(peer.role).toBe("viewer");
    const peerHeaders = { authorization: `Bearer ${peer.peerKey}`, "content-type": "text/plain", "x-zo-drive-file-name": encodeURIComponent("notes.txt") };
    expect((await app.request(`http://localhost/cluster/peers/${peer.peerId}/objects`, { method: "POST", headers: peerHeaders, body: "not permitted" })).status).toBe(403);
    const listed = await app.request("http://localhost/clusters/peers", { headers: ownerHeaders });
    await expect(listed.json()).resolves.toMatchObject({ peers: [expect.objectContaining({ id: peer.peerId, folder: "Client", role: "viewer", recipient: "Maya - Finance" })] });
    const updated = await app.request(`http://localhost/clusters/peers/${peer.peerId}`, { method: "PATCH", headers: ownerHeaders, body: JSON.stringify({ role: "editor" }) });
    await expect(updated.json()).resolves.toMatchObject({ id: peer.peerId, role: "editor" });
    expect((await app.request(`http://localhost/cluster/peers/${peer.peerId}/objects`, { method: "POST", headers: peerHeaders, body: "now permitted" })).status).toBe(201);
    expect((await app.request(`http://localhost/clusters/peers/${peer.peerId}`, { method: "DELETE", headers: ownerHeaders })).status).toBe(204);
    expect((await app.request(`http://localhost/cluster/peers/${peer.peerId}/access`, { headers: { authorization: `Bearer ${peer.peerKey}` } })).status).toBe(401);
  });

  it("lists and cancels pending cluster pairing keys without returning their secret", async () => {
    const app = await createTestApp();
    const headers = { "content-type": "application/json", "x-test-user-id": "alice" };
    const invitation = await app.request("http://localhost/clusters/invitations", { method: "POST", headers, body: JSON.stringify({ folder: "Clients/Maya", role: "viewer", recipient: "Maya" }) });
    const created = await invitation.json() as { id: string; token: string };

    const pending = await app.request("http://localhost/clusters/invitations", { headers });
    expect(pending.status).toBe(200);
    await expect(pending.json()).resolves.toEqual({ invitations: [expect.objectContaining({ id: created.id, folder: "Clients/Maya", role: "viewer", recipient: "Maya" })] });
    expect((await app.request(`http://localhost/clusters/invitations/${created.id}`, { method: "DELETE", headers })).status).toBe(204);
    const afterCancel = await app.request("http://localhost/clusters/invitations", { headers });
    await expect(afterCancel.json()).resolves.toEqual({ invitations: [] });
    expect((await app.request("http://localhost/cluster/invitations/accept", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ inviteToken: created.token }) })).status).toBe(410);
  });

  it("proxies mounted folder writes without exposing the peer credential to the browser", async () => {
    const remote = await createTestApp();
    const local = await createTestApp();
    vi.stubGlobal("fetch", (input: RequestInfo | URL, init?: RequestInit) => remote.request(input.toString(), init));
    const remoteHeaders = { "content-type": "application/json", "x-test-user-id": "alice" };
    const invitation = await remote.request("http://remote/clusters/invitations", { method: "POST", headers: remoteHeaders, body: JSON.stringify({ folder: "Shared" }) });
    const { token } = await invitation.json() as { token: string };
    const mounted = await local.request("http://local/clusters/mounts", { method: "POST", headers: { "content-type": "application/json", "x-test-user-id": "bob" }, body: JSON.stringify({ remoteUrl: "http://remote", inviteToken: token }) });
    expect(mounted.status).toBe(201);
    const mount = await mounted.json() as { id: string; author: string };
    expect(mount.author).toBe("alice");
    const uploaded = await local.request(`http://local/clusters/mounts/${mount.id}/objects`, { method: "POST", headers: { "content-type": "text/plain", "x-test-user-id": "bob", "x-zo-drive-file-name": encodeURIComponent("from-bob.txt") }, body: "private peer write" });
    expect(uploaded.status).toBe(201);
    await expect(uploaded.json()).resolves.toMatchObject({ key: "from-bob.txt" });
    const remoteObjects = await remote.request("http://remote/objects?prefix=Shared", { headers: { "x-test-user-id": "alice" } });
    await expect(remoteObjects.json()).resolves.toMatchObject({ objects: [expect.objectContaining({ key: "Shared/from-bob.txt" })] });
  });

  it("stores, runs, and publicly invokes owner-scoped functions", async () => {
    const app = await createTestApp();
    const created = await app.request("http://localhost/functions", {
      method: "POST",
      headers: { "content-type": "application/json", "x-test-user-id": "alice" },
      body: JSON.stringify({ name: "greet", runtime: "javascript", source: "export default async function handler(input) { return { greeting: `Hello ${input.name}` }; }", visibility: "private", cron: "0 9 * * 1-5", enabled: true })
    });
    expect(created.status).toBe(201);
    const fn = await created.json() as { id: string; visibility: string };
    expect(fn.visibility).toBe("private");

    const privateRun = await app.request(`http://localhost/functions/${fn.id}/run`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-test-user-id": "alice" },
      body: JSON.stringify({ input: { name: "Zo" } })
    });
    expect(privateRun.status).toBe(200);
    await expect(privateRun.json()).resolves.toMatchObject({ status: "success", output: { greeting: "Hello Zo" }, trigger: "manual" });

    const privatePublicAttempt = await app.request(`http://localhost/public/functions/${fn.id}/invoke`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ input: { name: "World" } }) });
    expect(privatePublicAttempt.status).toBe(404);

    const updated = await app.request(`http://localhost/functions/${fn.id}`, { method: "PATCH", headers: { "content-type": "application/json", "x-test-user-id": "alice" }, body: JSON.stringify({ visibility: "public" }) });
    expect(updated.status).toBe(200);
    const publicRun = await app.request(`http://localhost/public/functions/${fn.id}/invoke`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ input: { name: "World" } }) });
    expect(publicRun.status).toBe(200);
    await expect(publicRun.json()).resolves.toMatchObject({ status: "success", output: { greeting: "Hello World" }, trigger: "public" });

    const otherUser = await app.request("http://localhost/functions", { headers: { "x-test-user-id": "bob" } });
    await expect(otherUser.json()).resolves.toEqual({ functions: [] });
    const invalidCron = await app.request("http://localhost/functions", { method: "POST", headers: { "content-type": "application/json", "x-test-user-id": "alice" }, body: JSON.stringify({ name: "bad-cron", runtime: "python", source: "def handler(input): return input", cron: "every day", enabled: true }) });
    expect(invalidCron.status).toBe(400);
  });

  it("creates, browses, queries, and deletes an isolated SQLite database", async () => {
    const app = await createTestApp();
    const engines = await app.request("http://localhost/databases/engines", { headers: { "x-test-user-id": "alice" } });
    await expect(engines.json()).resolves.toMatchObject({ engines: expect.arrayContaining([
      expect.objectContaining({ engine: "sqlite", name: "SQLite", installed: false, installedAt: null, installedVersion: null, updatedAt: null, updateAvailable: false, workspaceAvailable: true }),
      expect.objectContaining({ engine: "redis", name: "Redis", installed: false, installedAt: null, installedVersion: null, updatedAt: null, updateAvailable: false, workspaceAvailable: true }),
      expect.objectContaining({ engine: "kuzu", name: "Kuzu", installed: false, installedAt: null, installedVersion: null, updatedAt: null, updateAvailable: false, workspaceAvailable: true })
    ]) });
    const blockedBeforeInstall = await app.request("http://localhost/databases", {
      method: "POST",
      headers: { "content-type": "application/json", "x-test-user-id": "alice" },
      body: JSON.stringify({ name: "app-data" })
    });
    expect(blockedBeforeInstall.status).toBe(409);
    await expect(blockedBeforeInstall.json()).resolves.toMatchObject({ error: { code: "DATABASE_ENGINE_NOT_INSTALLED" } });
    const redisInstalled = await app.request("http://localhost/databases/engines/redis/install", { method: "POST", headers: { "x-test-user-id": "alice" } });
    expect(redisInstalled.status).toBe(200);
    await expect(redisInstalled.json()).resolves.toMatchObject({ engine: "redis", name: "Redis", installed: true, installedAt: expect.any(String), workspaceAvailable: true });
    const installed = await app.request("http://localhost/databases/engines/sqlite/install", { method: "POST", headers: { "x-test-user-id": "alice" } });
    expect(installed.status).toBe(200);
    await expect(installed.json()).resolves.toMatchObject({ engine: "sqlite", name: "SQLite", installed: true, installedAt: expect.any(String), workspaceAvailable: true });
    const created = await app.request("http://localhost/databases", {
      method: "POST",
      headers: { "content-type": "application/json", "x-test-user-id": "alice" },
      body: JSON.stringify({ name: "app-data" })
    });
    expect(created.status).toBe(201);
    const database = await created.json() as { id: string; engine: string; name: string };
    expect(database).toMatchObject({ engine: "sqlite", name: "app-data" });

    const importSettings = await app.request("http://localhost/databases/settings", { headers: { "x-test-user-id": "alice" } });
    await expect(importSettings.json()).resolves.toMatchObject({ importLimitBytes: 100 * 1024 * 1024, minImportLimitBytes: 1024 * 1024 });
    const updatedImportSettings = await app.request("http://localhost/databases/settings", {
      method: "PUT",
      headers: { "content-type": "application/json", "x-test-user-id": "alice" },
      body: JSON.stringify({ importLimitBytes: 2 * 1024 * 1024 })
    });
    await expect(updatedImportSettings.json()).resolves.toMatchObject({ importLimitBytes: 2 * 1024 * 1024 });

    const createTable = await app.request(`http://localhost/databases/${database.id}/query`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-test-user-id": "alice" },
      body: JSON.stringify({ sql: "CREATE TABLE tasks (id INTEGER PRIMARY KEY, title TEXT NOT NULL)" })
    });
    expect(createTable.status).toBe(200);

    const inserted = await app.request(`http://localhost/databases/${database.id}/query`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-test-user-id": "alice" },
      body: JSON.stringify({ sql: "INSERT INTO tasks (title) VALUES (?)", params: ["Ship Database Engines"] })
    });
    await expect(inserted.json()).resolves.toMatchObject({ changes: 1, lastInsertRowid: 1 });

    const tables = await app.request(`http://localhost/databases/${database.id}/tables`, { headers: { "x-test-user-id": "alice" } });
    await expect(tables.json()).resolves.toMatchObject({ tables: [{ name: "tasks", schema: expect.stringContaining("CREATE TABLE tasks") }] });
    const rows = await app.request(`http://localhost/databases/${database.id}/tables/tasks/rows`, { headers: { "x-test-user-id": "alice" } });
    await expect(rows.json()).resolves.toMatchObject({ columns: ["id", "title"], total: 1, rows: [{ id: 1, title: "Ship Database Engines" }] });

    const queried = await app.request(`http://localhost/databases/${database.id}/query`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-test-user-id": "alice" },
      body: JSON.stringify({ sql: "SELECT title FROM tasks WHERE id = ?", params: [1] })
    });
    await expect(queried.json()).resolves.toMatchObject({ columns: ["title"], rows: [{ title: "Ship Database Engines" }] });

    const exported = await app.request(`http://localhost/databases/${database.id}/export`, { headers: { "x-test-user-id": "alice" } });
    expect(exported.status).toBe(200);
    expect(exported.headers.get("content-type")).toContain("application/vnd.sqlite3");
    const importForm = new FormData();
    importForm.set("name", "imported-data");
    importForm.set("file", new File([await exported.arrayBuffer()], "app-data.sqlite", { type: "application/vnd.sqlite3" }));
    const imported = await app.request("http://localhost/databases/import", { method: "POST", headers: { "x-test-user-id": "alice" }, body: importForm });
    expect(imported.status).toBe(201);
    const importedDatabase = await imported.json() as { id: string; name: string };
    expect(importedDatabase.name).toBe("imported-data");
    const importedRows = await app.request(`http://localhost/databases/${importedDatabase.id}/tables/tasks/rows`, { headers: { "x-test-user-id": "alice" } });
    await expect(importedRows.json()).resolves.toMatchObject({ rows: [{ id: 1, title: "Ship Database Engines" }] });

    const invalidImport = new FormData();
    invalidImport.set("name", "invalid-data");
    invalidImport.set("file", new File(["not sqlite"], "invalid.sqlite", { type: "application/vnd.sqlite3" }));
    const invalidImportResponse = await app.request("http://localhost/databases/import", { method: "POST", headers: { "x-test-user-id": "alice" }, body: invalidImport });
    expect(invalidImportResponse.status).toBe(400);
    await expect(invalidImportResponse.json()).resolves.toMatchObject({ error: { code: "DATABASE_IMPORT_ERROR" } });

    const tooLargeImport = new FormData();
    tooLargeImport.set("name", "too-large-data");
    tooLargeImport.set("file", new File([new Uint8Array((2 * 1024 * 1024) + 1)], "too-large.sqlite", { type: "application/vnd.sqlite3" }));
    const tooLargeImportResponse = await app.request("http://localhost/databases/import", { method: "POST", headers: { "x-test-user-id": "alice" }, body: tooLargeImport });
    expect(tooLargeImportResponse.status).toBe(400);
    await expect(tooLargeImportResponse.json()).resolves.toMatchObject({ error: { code: "DATABASE_IMPORT_ERROR", message: "This SQLite file exceeds your configured import limit" } });

    const blocked = await app.request(`http://localhost/databases/${database.id}/query`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-test-user-id": "alice" },
      body: JSON.stringify({ sql: "SELECT 1; SELECT 2" })
    });
    expect(blocked.status).toBe(400);
    await expect(blocked.json()).resolves.toMatchObject({ error: { code: "DATABASE_QUERY_ERROR" } });

    const privateToOwner = await app.request(`http://localhost/databases/${database.id}/tables`, { headers: { "x-test-user-id": "bob" } });
    expect(privateToOwner.status).toBe(404);
    const deleted = await app.request(`http://localhost/databases/${database.id}`, { method: "DELETE", headers: { "x-test-user-id": "alice" } });
    expect(deleted.status).toBe(204);
  });

  it("creates, updates, and exposes a non-SQLite engine without a table preview", async () => {
    const app = await createTestApp();
    const installed = await app.request("http://localhost/databases/engines/leveldb/install", { method: "POST", headers: { "x-test-user-id": "alice" } });
    await expect(installed.json()).resolves.toMatchObject({ engine: "leveldb", installed: true, installedVersion: "3.0.0", protocol: "key-value", updateAvailable: false });
    const updated = await app.request("http://localhost/databases/engines/leveldb/update", { method: "POST", headers: { "x-test-user-id": "alice" } });
    await expect(updated.json()).resolves.toMatchObject({ engine: "leveldb", installedVersion: "3.0.0", updatedAt: expect.any(String) });

    const created = await app.request("http://localhost/databases", { method: "POST", headers: { "content-type": "application/json", "x-test-user-id": "alice" }, body: JSON.stringify({ name: "cache", engine: "leveldb" }) });
    expect(created.status).toBe(201);
    const database = await created.json() as { id: string; engine: string };
    expect(database.engine).toBe("leveldb");
    expect((await app.request(`http://localhost/databases/${database.id}/tables`, { headers: { "x-test-user-id": "alice" } })).status).toBe(400);

    const put = await app.request(`http://localhost/databases/${database.id}/execute`, { method: "POST", headers: { "content-type": "application/json", "x-test-user-id": "alice" }, body: JSON.stringify({ operation: "put", key: "customer:1", value: "Ada" }) });
    await expect(put.json()).resolves.toEqual({ engine: "leveldb", result: { stored: true } });
    const get = await app.request(`http://localhost/databases/${database.id}/execute`, { method: "POST", headers: { "content-type": "application/json", "x-test-user-id": "alice" }, body: JSON.stringify({ operation: "get", key: "customer:1" }) });
    await expect(get.json()).resolves.toEqual({ engine: "leveldb", result: { value: "Ada" } });

    const keyResponse = await app.request(`http://localhost/databases/${database.id}/api-keys`, { method: "POST", headers: { "content-type": "application/json", "x-test-user-id": "alice" }, body: JSON.stringify({ name: "reader", scopes: ["read"], expiresAt: null }) });
    const key = await keyResponse.json() as { apiKey: string };
    const readHeaders = { authorization: `Bearer ${key.apiKey}`, "content-type": "application/json" };
    expect((await app.request(`http://localhost/databases/${database.id}/execute`, { method: "POST", headers: readHeaders, body: JSON.stringify({ operation: "get", key: "customer:1" }) })).status).toBe(200);
    expect((await app.request(`http://localhost/databases/${database.id}/execute`, { method: "POST", headers: readHeaders, body: JSON.stringify({ operation: "put", key: "customer:2", value: "Lin" }) })).status).toBe(401);
  });

  it("rejects disguised write queries from read-only database keys", async () => {
    const app = await createTestApp();
    await app.request("http://localhost/databases/engines/libsql/install", { method: "POST", headers: { "x-test-user-id": "alice" } });
    const created = await app.request("http://localhost/databases", { method: "POST", headers: { "content-type": "application/json", "x-test-user-id": "alice" }, body: JSON.stringify({ name: "guarded", engine: "libsql" }) });
    const database = await created.json() as { id: string };
    const keyResponse = await app.request(`http://localhost/databases/${database.id}/api-keys`, { method: "POST", headers: { "content-type": "application/json", "x-test-user-id": "alice" }, body: JSON.stringify({ name: "reader", scopes: ["read"], expiresAt: null }) });
    const key = await keyResponse.json() as { apiKey: string };
    const headers = { authorization: `Bearer ${key.apiKey}`, "content-type": "application/json" };

    expect((await app.request(`http://localhost/databases/${database.id}/execute`, { method: "POST", headers, body: JSON.stringify({ query: "SELECT 1" }) })).status).toBe(200);
    expect((await app.request(`http://localhost/databases/${database.id}/execute`, { method: "POST", headers, body: JSON.stringify({ query: "WITH changed AS (DELETE FROM records RETURNING *) SELECT * FROM changed" }) })).status).toBe(401);
  });

  it("runs Redis from a long persistent data-root path", async () => {
    const root = await mkdtemp(join(tmpdir(), `zo-drive-${"long-path-".repeat(7)}`));
    roots.push(root);
    const databases = new LocalDatabaseStore(root, true);
    try {
      await databases.installEngine({ ownerUserId: "alice", engine: "redis" });
      const database = await databases.create({ ownerUserId: "alice", name: "cache", engine: "redis" });
      await expect(databases.execute({ ownerUserId: "alice", id: database.id, request: { command: "SET", args: ["ready", "yes"] } })).resolves.toMatchObject({ result: "OK" });
      await expect(databases.execute({ ownerUserId: "alice", id: database.id, request: { command: "GET", args: ["ready"] } })).resolves.toMatchObject({ result: "yes" });
      await expect(databases.remove({ ownerUserId: "alice", id: database.id })).resolves.toBe(true);
      await expect(databases.list("alice")).resolves.toEqual([]);
    } finally {
      await databases.removeByOwner("alice");
    }
  });

  it("issues database-scoped keys for external backends and enforces their access", async () => {
    const app = await createTestApp();
    expect((await app.request("http://localhost/databases/engines/sqlite/install", { method: "POST", headers: { "x-test-user-id": "alice" } })).status).toBe(200);
    const createDatabase = async (name: string) => {
      const response = await app.request("http://localhost/databases", {
        method: "POST",
        headers: { "content-type": "application/json", "x-test-user-id": "alice" },
        body: JSON.stringify({ name })
      });
      return response.json() as Promise<{ id: string }>;
    };
    const primary = await createDatabase("primary");
    const other = await createDatabase("other");
    const created = await app.request(`http://localhost/databases/${primary.id}/api-keys`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-test-user-id": "alice" },
      body: JSON.stringify({ name: "Read-only production", scopes: ["read"], expiresAt: null })
    });
    expect(created.status).toBe(201);
    const readKey = await created.json() as { id: string; apiKey: string; databaseId: string };
    expect(readKey.apiKey).toMatch(/^zdb_/);
    expect(readKey.databaseId).toBe(primary.id);

    const readHeaders = { authorization: `Bearer ${readKey.apiKey}` };
    expect((await app.request(`http://localhost/databases/${primary.id}/tables`, { headers: readHeaders })).status).toBe(200);
    expect((await app.request(`http://localhost/databases/${other.id}/tables`, { headers: readHeaders })).status).toBe(401);
    expect((await app.request(`http://localhost/databases/${primary.id}/query`, {
      method: "POST",
      headers: { ...readHeaders, "content-type": "application/json" },
      body: JSON.stringify({ sql: "SELECT 1 AS one" })
    })).status).toBe(200);
    expect((await app.request(`http://localhost/databases/${primary.id}/query`, {
      method: "POST",
      headers: { ...readHeaders, "content-type": "application/json" },
      body: JSON.stringify({ sql: "CREATE TABLE blocked (id INTEGER)" })
    })).status).toBe(401);

    const writeCreated = await app.request(`http://localhost/databases/${primary.id}/api-keys`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-test-user-id": "alice" },
      body: JSON.stringify({ name: "Writer", scopes: ["read", "write"], expiresAt: null })
    });
    const writeKey = await writeCreated.json() as { apiKey: string };
    expect((await app.request(`http://localhost/databases/${primary.id}/query`, {
      method: "POST",
      headers: { authorization: `Bearer ${writeKey.apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({ sql: "CREATE TABLE allowed (id INTEGER)" })
    })).status).toBe(200);

    expect((await app.request(`http://localhost/databases/${primary.id}/api-keys/${readKey.id}`, { method: "DELETE", headers: { "x-test-user-id": "alice" } })).status).toBe(204);
    expect((await app.request(`http://localhost/databases/${primary.id}/tables`, { headers: readHeaders })).status).toBe(401);
  });

  it("rate-limits repeated invalid device API key attempts without blocking a valid key", async () => {
    const root = await mkdtemp(join(tmpdir(), "zo-drive-api-key-rate-limit-"));
    roots.push(root);
    const app = createApp({
      storage: new LocalDriveStorage({ root }),
      resolveUserId: (request) => request.headers.get("authorization") === "Bearer zdk_valid_key" ? "owner" : null,
      invalidApiKeyRateLimiter: new InvalidApiKeyRateLimiter({ blockDurationMs: 60_000, maxAttempts: 2 }),
      trustProxy: true
    });
    const clientHeaders = { "x-forwarded-for": "203.0.113.10" };

    expect((await app.request("http://localhost/objects", { headers: { ...clientHeaders, authorization: "Bearer zdk_wrong_key" } })).status).toBe(401);
    expect((await app.request("http://localhost/objects", { headers: { ...clientHeaders, authorization: "Bearer zdk_valid_key" } })).status).toBe(200);
    expect((await app.request("http://localhost/objects", { headers: { ...clientHeaders, authorization: "Bearer zdk_wrong_key" } })).status).toBe(401);

    const limited = await app.request("http://localhost/objects", { headers: { ...clientHeaders, authorization: "Bearer zdk_wrong_key" } });
    expect(limited.status).toBe(429);
    expect(limited.headers.get("retry-after")).toBe("60");
    await expect(limited.json()).resolves.toEqual({
      error: { code: "RATE_LIMITED", message: "Too many failed API key attempts. Try again later." }
  });
  });

  it("uploads, lists, streams, and moves deleted files to Trash until restored", async () => {
    const app = await createTestApp();
    const uploaded = await app.request("http://localhost/objects", {
      method: "POST",
      headers: { "content-type": "text/plain", "x-test-user-id": "alice", "x-zo-drive-file-name": "hello.txt", "x-zo-drive-path": "Notes" },
      body: "hello from Zo Drive"
    });

    expect(uploaded.status).toBe(201);
    await expect(uploaded.json()).resolves.toMatchObject({ key: "Notes/hello.txt", size: 19, contentType: "text/plain" });

    const listed = await app.request("http://localhost/objects?prefix=Notes", { headers: { "x-test-user-id": "alice" } });
    await expect(listed.json()).resolves.toMatchObject({ objects: [{ key: "Notes/hello.txt" }] });

    const usage = await app.request("http://localhost/usage", { headers: { "x-test-user-id": "alice" } });
    await expect(usage.json()).resolves.toMatchObject({ fileCount: 1, usedBytes: 19, totalBytes: expect.any(Number), availableBytes: expect.any(Number), systemUsedBytes: expect.any(Number), categories: expect.arrayContaining([{ id: "documents", bytes: 19, fileCount: 1 }]) });

    const downloaded = await app.request("http://localhost/objects/Notes/hello.txt", { headers: { "x-test-user-id": "alice" } });
    expect(downloaded.headers.get("content-type")).toContain("text/plain");
    await expect(downloaded.text()).resolves.toBe("hello from Zo Drive");

    const copied = await app.request("http://localhost/objects/Notes/hello.txt", {
      method: "PATCH",
      headers: { "content-type": "application/json", "x-test-user-id": "alice" },
      body: JSON.stringify({ copyTo: "Archive/hello copy.txt" })
    });
    expect(copied.status).toBe(200);
    await expect(copied.json()).resolves.toMatchObject({ key: "Archive/hello copy.txt", contentType: "text/plain" });
    await expect((await app.request("http://localhost/objects/Archive/hello%20copy.txt", { headers: { "x-test-user-id": "alice" } })).text()).resolves.toBe("hello from Zo Drive");

    const deleted = await app.request("http://localhost/objects/Notes/hello.txt", {
      method: "DELETE",
      headers: { "x-test-user-id": "alice" }
    });
    expect(deleted.status).toBe(204);

    const missing = await app.request("http://localhost/objects/Notes/hello.txt", { headers: { "x-test-user-id": "alice" } });
    expect(missing.status).toBe(404);

    const trash = await app.request("http://localhost/trash", { headers: { "x-test-user-id": "alice" } });
    const trashBody = await trash.json() as { items: Array<{ id: string; originalKey: string }> };
    expect(trashBody.items).toHaveLength(1);
    expect(trashBody.items[0]?.originalKey).toBe("Notes/hello.txt");

    const restored = await app.request(`http://localhost/trash/${trashBody.items[0]?.id}/restore`, { method: "PUT", headers: { "x-test-user-id": "alice" } });
    expect(restored.status).toBe(200);
    await expect(restored.json()).resolves.toMatchObject({ key: "Notes/hello.txt" });
  });

  it("rejects streamed uploads that exceed the configured storage quota", async () => {
    const app = await createTestApp({ quotaBytes: 5 });

    const response = await app.request("http://localhost/objects", {
      method: "POST",
      headers: { "content-type": "text/plain", "x-test-user-id": "alice", "x-zo-drive-file-name": "too-large.txt" },
      body: "123456"
    });

    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "STORAGE_QUOTA_EXCEEDED" } });
    const files = await app.request("http://localhost/objects", { headers: { "x-test-user-id": "alice" } });
    await expect(files.json()).resolves.toEqual({ objects: [] });
  });

  it("updates a user's persisted storage quota within the machine limits", async () => {
    const app = await createTestApp();
    const usageResponse = await app.request("http://localhost/usage", { headers: { "x-test-user-id": "alice" } });
    const usage = await usageResponse.json() as { maxQuotaBytes: number };
    const quotaBytes = Math.min(200 * 1024 * 1024 * 1024, usage.maxQuotaBytes);

    const updated = await app.request("http://localhost/usage/quota", {
      method: "PUT",
      headers: { "content-type": "application/json", "x-test-user-id": "alice" },
      body: JSON.stringify({ quotaBytes })
    });
    expect(updated.status).toBe(200);
    await expect(updated.json()).resolves.toMatchObject({ quotaBytes });

    const invalid = await app.request("http://localhost/usage/quota", {
      method: "PUT",
      headers: { "content-type": "application/json", "x-test-user-id": "alice" },
      body: JSON.stringify({ quotaBytes: usage.maxQuotaBytes + 1 })
    });
    expect(invalid.status).toBe(400);
    await expect(invalid.json()).resolves.toMatchObject({ error: { code: "INVALID_STORAGE_QUOTA" } });
  });

  it("streams a movie upload to disk without multipart parsing", async () => {
    const app = await createTestApp();
    const movie = new Uint8Array(2 * 1024 * 1024);
    movie[0] = 0x66;
    movie[movie.length - 1] = 0x77;

    const uploaded = await app.request("http://localhost/objects", {
      method: "POST",
      headers: { "content-type": "video/quicktime", "x-test-user-id": "alice", "x-zo-drive-file-name": "movie.MOV", "x-zo-drive-path": "Videos" },
      body: movie
    });

    expect(uploaded.status).toBe(201);
    await expect(uploaded.json()).resolves.toMatchObject({ key: "Videos/movie.MOV", size: movie.byteLength, contentType: "video/quicktime" });
    const downloaded = await app.request("http://localhost/objects/Videos/movie.MOV", { headers: { "x-test-user-id": "alice" } });
    expect(Buffer.from(await downloaded.arrayBuffer()).equals(Buffer.from(movie))).toBe(true);
  });

  it("accepts arbitrary file formats and preserves their MIME type", async () => {
    const app = await createTestApp();
    const uploaded = await app.request("http://localhost/objects", {
      method: "POST",
      headers: { "content-type": "application/vnd.sketch", "x-test-user-id": "alice", "x-zo-drive-file-name": "landing.sketch", "x-zo-drive-path": "Designs" },
      body: "design data"
    });

    await expect(uploaded.json()).resolves.toMatchObject({ key: "Designs/landing.sketch", contentType: "application/vnd.sketch" });
    const downloaded = await app.request("http://localhost/objects/Designs/landing.sketch", { headers: { "x-test-user-id": "alice" } });
    expect(downloaded.headers.get("content-type")).toBe("application/vnd.sketch");
  });

  it("filters list results with advanced search query fields", async () => {
    const app = await createTestApp();
    await app.request("http://localhost/objects", { method: "POST", headers: { "content-type": "text/plain", "x-test-user-id": "alice", "x-zo-drive-file-name": "plan.txt" }, body: "Compound growth" });
    await app.request("http://localhost/objects", { method: "POST", headers: { "content-type": "image/png", "x-test-user-id": "alice", "x-zo-drive-file-name": "logo.png" }, body: "image" });
    await app.request("http://localhost/stars/plan.txt", { method: "PUT", headers: { "x-test-user-id": "alice" } });

    const response = await app.request("http://localhost/objects?type=document&contentQuery=growth&starred=true&modifiedAfter=2020-01-01T00%3A00%3A00.000Z", { headers: { "x-test-user-id": "alice" } });
    await expect(response.json()).resolves.toMatchObject({ objects: [{ key: "plan.txt", starred: true }] });
  });

  it("requires raw-upload file metadata", async () => {
    const app = await createTestApp();

    const response = await app.request("http://localhost/objects", {
      method: "POST",
      headers: { "content-type": "video/mp4", "x-test-user-id": "alice" },
      body: "movie bytes"
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "INVALID_REQUEST", message: "A file name is required" } });
  });

  it("does not expose one user's data to another user", async () => {
    const app = await createTestApp();
    await app.request("http://localhost/objects", {
      method: "POST",
      headers: { "content-type": "text/plain", "x-test-user-id": "alice", "x-zo-drive-file-name": "private.txt" },
      body: "private"
    });

    const listAsBob = await app.request("http://localhost/objects", { headers: { "x-test-user-id": "bob" } });
    await expect(listAsBob.json()).resolves.toEqual({ objects: [] });

    const downloadAsBob = await app.request("http://localhost/objects/private.txt", { headers: { "x-test-user-id": "bob" } });
    expect(downloadAsBob.status).toBe(404);
  });

  it("stars and unstars files only for their authenticated owner", async () => {
    const app = await createTestApp();
    expect((await app.request("http://localhost/objects", { method: "POST", headers: { "content-type": "text/plain", "x-test-user-id": "alice", "x-zo-drive-file-name": "private.txt" }, body: "private" })).status).toBe(201);

    const starred = await app.request("http://localhost/stars/private.txt", { method: "PUT", headers: { "x-test-user-id": "alice" } });
    expect(starred.status).toBe(200);
    await expect(starred.json()).resolves.toMatchObject({ key: "private.txt", starred: true });
    await expect((await app.request("http://localhost/stars", { headers: { "x-test-user-id": "alice" } })).json()).resolves.toMatchObject({ objects: [{ key: "private.txt", starred: true }] });
    await expect((await app.request("http://localhost/stars", { headers: { "x-test-user-id": "bob" } })).json()).resolves.toEqual({ objects: [] });

    expect((await app.request("http://localhost/stars/private.txt", { method: "DELETE", headers: { "x-test-user-id": "alice" } })).status).toBe(204);
    await expect((await app.request("http://localhost/stars", { headers: { "x-test-user-id": "alice" } })).json()).resolves.toEqual({ objects: [] });
  });

  it("creates and lists empty folders for the authenticated user", async () => {
    const app = await createTestApp();

    const created = await app.request("http://localhost/folders", {
      method: "POST",
      headers: { "content-type": "application/json", "x-test-user-id": "alice" },
      body: JSON.stringify({ path: "Projects/2026" })
    });
    expect(created.status).toBe(201);
    await expect(created.json()).resolves.toMatchObject({ key: "Projects/2026", name: "2026" });

    const rootFolders = await app.request("http://localhost/folders", { headers: { "x-test-user-id": "alice" } });
    await expect(rootFolders.json()).resolves.toMatchObject({ folders: [{ key: "Projects", name: "Projects" }] });
  });

  it("creates Zo-native files only for the authenticated owner", async () => {
    const app = await createTestApp();

    const created = await app.request("http://localhost/native-files", {
      method: "POST",
      headers: { "content-type": "application/json", "x-test-user-id": "alice" },
      body: JSON.stringify({ name: "Roadmap", path: "Projects", type: "spreadsheet" })
    });
    expect(created.status).toBe(201);
    await expect(created.json()).resolves.toMatchObject({ key: "Projects/Roadmap", contentType: "application/vnd.zo.spreadsheet+json", nativeType: "spreadsheet" });
    const saved = await app.request("http://localhost/native-files/Projects/Roadmap", {
      method: "PUT",
      headers: { "content-type": "application/json", "x-test-user-id": "alice" },
      body: JSON.stringify({ content: { format: "zo-native", type: "spreadsheet", version: 1, sheets: [{ name: "Sheet 1", cells: { A1: "Revenue" } }] } })
    });
    expect(saved.status).toBe(200);
    const content = await app.request("http://localhost/objects/Projects/Roadmap", { headers: { "x-test-user-id": "alice" } });
    await expect(content.json()).resolves.toMatchObject({ sheets: [{ cells: { A1: "Revenue" } }] });
    expect((await app.request("http://localhost/native-files", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: "Private", type: "document" }) })).status).toBe(401);
    expect((await app.request("http://localhost/native-files", { method: "POST", headers: { "content-type": "application/json", "x-test-user-id": "alice" }, body: JSON.stringify({ name: "Roadmap", path: "Projects", type: "spreadsheet" }) })).status).toBe(409);
  });

  it("allows one owner registration, then protects every drive route with that session", async () => {
    const root = await mkdtemp(join(tmpdir(), "zo-drive-auth-"));
    roots.push(root);
    const sessions = new SessionService("test-session-secret-that-is-more-than-thirty-two-characters");
    const app = createApp({
      storage: new LocalDriveStorage({ root }),
      resolveUserId: (request) => sessions.userIdFromRequest(request),
      auth: { store: new LocalAuthStore({ root }), sessions, secureCookies: false }
    });

    const beforeRegistration = await app.request("http://localhost/auth/status");
    await expect(beforeRegistration.json()).resolves.toEqual({ authenticated: false, registrationAllowed: true, user: null });
    expect((await app.request("http://localhost/objects")).status).toBe(401);

    const registration = await app.request("http://localhost/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: "sayyid", password: "correct-horse-battery-staple" })
    });
    expect(registration.status).toBe(201);
    const cookie = registration.headers.get("set-cookie");
    expect(cookie).toContain("HttpOnly");

    const afterRegistration = await app.request("http://localhost/auth/status", { headers: { cookie: cookie! } });
    await expect(afterRegistration.json()).resolves.toEqual({
      authenticated: true,
      registrationAllowed: false,
      user: expect.objectContaining({ id: "sayyid", username: "sayyid" })
    });

    const profile = await app.request("http://localhost/auth/profile", {
      method: "PATCH",
      headers: { "content-type": "application/json", cookie: cookie! },
      body: JSON.stringify({ username: "drive-owner" })
    });
    await expect(profile.json()).resolves.toEqual({ user: expect.objectContaining({ id: "drive-owner", username: "drive-owner" }) });
    const renamedCookie = profile.headers.get("set-cookie");
    expect(renamedCookie).toContain("HttpOnly");
    expect((await app.request("http://localhost/objects", { headers: { cookie: cookie! } })).status).toBe(401);

    const password = await app.request("http://localhost/auth/password", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: renamedCookie! },
      body: JSON.stringify({ currentPassword: "correct-horse-battery-staple", newPassword: "new-owner-password" })
    });
    expect(password.status).toBe(204);

    const blockedRegistration = await app.request("http://localhost/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: "intruder", password: "correct-horse-battery-staple" })
    });
    expect(blockedRegistration.status).toBe(403);

    expect((await app.request("http://localhost/objects", {
      method: "POST",
      headers: { "content-type": "text/plain", cookie: renamedCookie!, "x-zo-drive-file-name": "private.txt" },
      body: "owner only"
    })).status).toBe(201);
    expect((await app.request("http://localhost/objects")).status).toBe(401);

    const deleted = await app.request("http://localhost/auth/account", {
      method: "DELETE",
      headers: { "content-type": "application/json", cookie: renamedCookie! },
      body: JSON.stringify({ password: "new-owner-password", confirmation: "DELETE MY DRIVE" })
    });
    expect(deleted.status).toBe(204);
    expect(deleted.headers.get("set-cookie")).toContain("Max-Age=0");
    expect((await app.request("http://localhost/objects", { headers: { cookie: renamedCookie! } })).status).toBe(401);
    await expect((await app.request("http://localhost/auth/status", { headers: { cookie: cookie! } })).json()).resolves.toEqual({ authenticated: false, registrationAllowed: true, user: null });
  });

  it("issues revocable scoped device keys without exposing their secrets after creation", async () => {
    const root = await mkdtemp(join(tmpdir(), "zo-drive-api-keys-"));
    roots.push(root);
    const sessions = new SessionService("test-session-secret-that-is-more-than-thirty-two-characters");
    const apiKeys = new LocalApiKeyStore({ root });
    const auth = { store: new LocalAuthStore({ root }), sessions, secureCookies: false };
    const app = createApp({
      storage: new LocalDriveStorage({ root }),
      resolveUserId: async (request) => sessions.userIdFromRequest(request) ?? await apiKeys.userIdFromRequest(request),
      auth,
      apiKeys
    });
    const registration = await app.request("http://localhost/auth/register", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username: "owner", password: "secret1" }) });
    const cookie = registration.headers.get("set-cookie")!;

    const created = await app.request("http://localhost/api-keys", { method: "POST", headers: { "content-type": "application/json", cookie }, body: JSON.stringify({ name: "Read-only laptop", scopes: ["read"], expiresAt: null }) });
    expect(created.status).toBe(201);
    const createdBody = await created.json() as { apiKey: string; id: string; secretHash?: string };
    expect(createdBody.apiKey).toMatch(/^zdk_/);
    expect(createdBody.secretHash).toBeUndefined();
    await expect(readFile(join(root, "v1", "auth", "api-keys.json"), "utf8")).resolves.not.toContain(createdBody.apiKey);

    const listed = await app.request("http://localhost/api-keys", { headers: { cookie } });
    await expect(listed.json()).resolves.toMatchObject({ keys: [{ id: createdBody.id, name: "Read-only laptop" }] });
    expect((await app.request("http://localhost/api-keys", { headers: { authorization: `Bearer ${createdBody.apiKey}` } })).status).toBe(401);
    expect((await app.request("http://localhost/objects", { headers: { authorization: `Bearer ${createdBody.apiKey}` } })).status).toBe(200);
    expect((await app.request("http://localhost/objects", { method: "POST", headers: { authorization: `Bearer ${createdBody.apiKey}`, "content-type": "text/plain", "x-zo-drive-file-name": "blocked.txt" }, body: "blocked" })).status).toBe(401);

    expect((await app.request(`http://localhost/api-keys/${createdBody.id}`, { method: "DELETE", headers: { cookie } })).status).toBe(204);
    expect((await app.request("http://localhost/objects", { headers: { authorization: `Bearer ${createdBody.apiKey}` } })).status).toBe(401);
  });

  it("keeps device keys usable when the owner username changes and deletes them with the account", async () => {
    const root = await mkdtemp(join(tmpdir(), "zo-drive-api-key-rename-"));
    roots.push(root);
    const sessions = new SessionService("test-session-secret-that-is-more-than-thirty-two-characters");
    const apiKeys = new LocalApiKeyStore({ root });
    const auth = { store: new LocalAuthStore({ root }), sessions, secureCookies: false };
    const app = createApp({
      storage: new LocalDriveStorage({ root }),
      resolveUserId: async (request) => sessions.userIdFromRequest(request) ?? await apiKeys.userIdFromRequest(request),
      auth,
      apiKeys
    });
    const registration = await app.request("http://localhost/auth/register", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username: "owner", password: "secret1" }) });
    const cookie = registration.headers.get("set-cookie")!;
    const created = await app.request("http://localhost/api-keys", { method: "POST", headers: { "content-type": "application/json", cookie }, body: JSON.stringify({ name: "Automation", scopes: ["read", "write"], expiresAt: null }) });
    const { apiKey } = await created.json() as { apiKey: string };

    const profile = await app.request("http://localhost/auth/profile", { method: "PATCH", headers: { "content-type": "application/json", cookie }, body: JSON.stringify({ username: "drive-owner" }) });
    const renamedCookie = profile.headers.get("set-cookie")!;
    expect((await app.request("http://localhost/objects", { headers: { authorization: `Bearer ${apiKey}` } })).status).toBe(200);

    expect((await app.request("http://localhost/auth/account", { method: "DELETE", headers: { "content-type": "application/json", cookie: renamedCookie }, body: JSON.stringify({ password: "secret1", confirmation: "DELETE MY DRIVE" }) })).status).toBe(204);
    expect((await app.request("http://localhost/objects", { headers: { authorization: `Bearer ${apiKey}` } })).status).toBe(401);
  });

  it("preserves existing share links when a username renames its storage namespace", async () => {
    const root = await mkdtemp(join(tmpdir(), "zo-drive-rename-share-"));
    roots.push(root);
    const sessions = new SessionService("test-session-secret-that-is-more-than-thirty-two-characters");
    const app = createApp({
      storage: new LocalDriveStorage({ root }),
      resolveUserId: (request) => sessions.userIdFromRequest(request),
      auth: { store: new LocalAuthStore({ root }), sessions, secureCookies: false },
      sharing: new LocalShareStore({ root })
    });

    const registration = await app.request("http://localhost/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: "sayyid", password: "correct-horse-battery-staple" })
    });
    const cookie = registration.headers.get("set-cookie");
    expect((await app.request("http://localhost/objects", {
      method: "POST",
      headers: { "content-type": "text/plain", cookie: cookie!, "x-zo-drive-file-name": "notes.txt" },
      body: "shared content"
    })).status).toBe(201);

    const createdShare = await app.request("http://localhost/shares", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: cookie! },
      body: JSON.stringify({ key: "notes.txt", access: "public" })
    });
    const share = await createdShare.json() as { id: string };

    const profile = await app.request("http://localhost/auth/profile", {
      method: "PATCH",
      headers: { "content-type": "application/json", cookie: cookie! },
      body: JSON.stringify({ username: "sayyidkhan" })
    });
    expect(profile.status).toBe(200);

    const sharedContent = await app.request(`http://localhost/shared/${share.id}/content`);
    expect(sharedContent.status).toBe(200);
    await expect(sharedContent.text()).resolves.toBe("shared content");
  });

  it("creates, protects, expires, and revokes file share links", async () => {
    const root = await mkdtemp(join(tmpdir(), "zo-drive-shares-"));
    roots.push(root);
    const sessions = new SessionService("test-session-secret-that-is-more-than-thirty-two-characters");
    const storage = new LocalDriveStorage({ root });
    const app = createApp({
      storage,
      resolveUserId: (request) => sessions.userIdFromRequest(request),
      auth: { store: new LocalAuthStore({ root }), sessions, secureCookies: false },
      sharing: new LocalShareStore({ root })
    });
    const registration = await app.request("http://localhost/auth/register", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username: "owner", password: "secret1" }) });
    const cookie = registration.headers.get("set-cookie")!;
    expect((await app.request("http://localhost/objects", {
      method: "POST",
      headers: { "content-type": "text/plain", cookie, "x-zo-drive-file-name": "shared.txt" },
      body: "shared contents"
    })).status).toBe(201);

    const publicShare = await app.request("http://localhost/shares", { method: "POST", headers: { "content-type": "application/json", cookie }, body: JSON.stringify({ key: "shared.txt", access: "public", kind: "transfer" }) });
    const publicBody = await publicShare.json() as { id: string; kind: string };
    expect(publicShare.status).toBe(201);
    expect(publicBody.kind).toBe("transfer");
    await expect((await app.request(`http://localhost/shared/${publicBody.id}`)).json()).resolves.toMatchObject({ name: "shared.txt", requiresPasscode: false });
    await expect((await app.request(`http://localhost/shared/${publicBody.id}/content`)).text()).resolves.toBe("shared contents");

    const renamed = await app.request("http://localhost/objects/shared.txt", { method: "PATCH", headers: { "content-type": "application/json", cookie }, body: JSON.stringify({ name: "renamed.txt" }) });
    expect(renamed.status).toBe(200);
    await expect(renamed.json()).resolves.toMatchObject({ key: "renamed.txt", name: "renamed.txt" });
    await expect((await app.request(`http://localhost/shared/${publicBody.id}`)).json()).resolves.toMatchObject({ name: "renamed.txt" });
    await expect((await app.request(`http://localhost/shared/${publicBody.id}/content`)).text()).resolves.toBe("shared contents");

    const expiredShare = await app.request("http://localhost/shares", { method: "POST", headers: { "content-type": "application/json", cookie }, body: JSON.stringify({ key: "renamed.txt", access: "public", expiresAt: new Date(Date.now() - 60_000).toISOString() }) });
    expect(expiredShare.status).toBe(400);

    const protectedShare = await app.request("http://localhost/shares", { method: "POST", headers: { "content-type": "application/json", cookie }, body: JSON.stringify({ key: "renamed.txt", access: "passcode", kind: "transfer", passcode: "open-sesame", expiresAt: new Date(Date.now() + 60_000).toISOString() }) });
    const protectedBody = await protectedShare.json() as { id: string; kind: string };
    expect(protectedBody.kind).toBe("transfer");
    expect((await app.request(`http://localhost/shared/${protectedBody.id}/content`)).status).toBe(401);
    await expect((await app.request(`http://localhost/shared/${protectedBody.id}/content`, { headers: { "x-zo-drive-share-passcode": "open-sesame" } })).text()).resolves.toBe("shared contents");

    const changedPasscode = await app.request(`http://localhost/shares/${protectedBody.id}/passcode`, { method: "PATCH", headers: { "content-type": "application/json", cookie }, body: JSON.stringify({ passcode: "new-passcode" }) });
    expect(changedPasscode.status).toBe(200);
    await expect(changedPasscode.json()).resolves.toMatchObject({ id: protectedBody.id, access: "passcode" });
    expect((await app.request(`http://localhost/shared/${protectedBody.id}/content`, { headers: { "x-zo-drive-share-passcode": "open-sesame" } })).status).toBe(401);
    await expect((await app.request(`http://localhost/shared/${protectedBody.id}/content`, { headers: { "x-zo-drive-share-passcode": "new-passcode" } })).text()).resolves.toBe("shared contents");

    expect((await app.request(`http://localhost/shares/${publicBody.id}`, { method: "DELETE", headers: { cookie } })).status).toBe(204);
    expect((await app.request(`http://localhost/shared/${publicBody.id}`)).status).toBe(404);
  });

  it("lets anonymous guests edit only explicitly editable Zo Pastes", async () => {
    const root = await mkdtemp(join(tmpdir(), "zo-drive-editable-paste-"));
    roots.push(root);
    const sessions = new SessionService("test-session-secret-that-is-more-than-thirty-two-characters");
    const app = createApp({
      storage: new LocalDriveStorage({ root }),
      resolveUserId: (request) => sessions.userIdFromRequest(request),
      auth: { store: new LocalAuthStore({ root }), sessions, secureCookies: false },
      sharing: new LocalShareStore({ root })
    });
    const registration = await app.request("http://localhost/auth/register", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username: "owner", password: "secret1" }) });
    const cookie = registration.headers.get("set-cookie")!;
    expect((await app.request("http://localhost/native-files", { method: "POST", headers: { "content-type": "application/json", cookie }, body: JSON.stringify({ name: "Sprint notes", type: "paste" }) })).status).toBe(201);
    const created = await app.request("http://localhost/shares", { method: "POST", headers: { "content-type": "application/json", cookie }, body: JSON.stringify({ key: "Sprint notes", access: "public", editable: true }) });
    expect(created.status).toBe(201);
    const share = await created.json() as { id: string; editable: boolean };
    expect(share.editable).toBe(true);

    const opened = await app.request(`http://localhost/shared/${share.id}/paste`);
    expect(opened.status).toBe(200);
    const openedBody = await opened.json() as { content: { text: string }; revision: string };
    expect(openedBody.content.text).toBe("");
    const saved = await app.request(`http://localhost/shared/${share.id}/paste`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ expectedRevision: openedBody.revision, content: { format: "zo-native", type: "paste", version: 1, language: "plaintext", tags: [], text: "Ideas from the group" } }) });
    expect(saved.status).toBe(200);
    const savedBody = await saved.json() as { revision: string };
    expect(savedBody.revision).not.toBe(openedBody.revision);
    const staleSave = await app.request(`http://localhost/shared/${share.id}/paste`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ expectedRevision: openedBody.revision, content: { format: "zo-native", type: "paste", version: 1, language: "plaintext", tags: [], text: "Stale edit" } }) });
    expect(staleSave.status).toBe(409);
    await expect(staleSave.json()).resolves.toMatchObject({ error: { code: "PASTE_VERSION_CONFLICT" } });

    const protectedShare = await app.request("http://localhost/shares", { method: "POST", headers: { "content-type": "application/json", cookie }, body: JSON.stringify({ key: "Sprint notes", access: "passcode", editable: true, passcode: "sprint-secret" }) });
    const protectedBody = await protectedShare.json() as { id: string };
    expect((await app.request(`http://localhost/shared/${protectedBody.id}/paste`)).status).toBe(401);
    expect((await app.request(`http://localhost/shared/${protectedBody.id}/paste`, { headers: { "x-zo-drive-share-passcode": "sprint-secret" } })).status).toBe(200);

    expect((await app.request("http://localhost/objects", { method: "POST", headers: { "content-type": "text/plain", cookie, "x-zo-drive-file-name": "readme.txt" }, body: "private" })).status).toBe(201);
    const invalidEditable = await app.request("http://localhost/shares", { method: "POST", headers: { "content-type": "application/json", cookie }, body: JSON.stringify({ key: "readme.txt", access: "public", editable: true }) });
    expect(invalidEditable.status).toBe(400);
  });

  it("publishes Zo Forms and records public responses", async () => {
    const root = await mkdtemp(join(tmpdir(), "zo-drive-forms-"));
    roots.push(root);
    const sessions = new SessionService("test-session-secret-that-is-more-than-thirty-two-characters");
    const app = createApp({
      storage: new LocalDriveStorage({ root }),
      resolveUserId: (request) => sessions.userIdFromRequest(request),
      auth: { store: new LocalAuthStore({ root }), sessions, secureCookies: false },
      forms: new LocalFormStore({ root })
    });
    const registration = await app.request("http://localhost/auth/register", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username: "owner", password: "secret1" }) });
    const cookie = registration.headers.get("set-cookie")!;
    expect((await app.request("http://localhost/native-files", { method: "POST", headers: { "content-type": "application/json", cookie }, body: JSON.stringify({ name: "Feedback", type: "form" }) })).status).toBe(201);
    expect((await app.request("http://localhost/native-files/Feedback", { method: "PUT", headers: { "content-type": "application/json", cookie }, body: JSON.stringify({ content: { format: "zo-native", type: "form", version: 1, title: "Feedback", theme: "ocean", settings: { acceptingResponses: true, confirmationMessage: "Thanks for your feedback.", showProgressBar: true }, questions: [{ id: "q1", title: "How was it?", description: "", type: "multiple-choice", options: ["Great", "Okay"], required: true }, { id: "q2", title: "Rate each area", description: "", type: "multiple-choice-grid", options: [], rows: ["Support"], columns: ["Good", "Great"], required: true }] } }) })).status).toBe(200);

    const published = await app.request("http://localhost/forms", { method: "POST", headers: { "content-type": "application/json", cookie }, body: JSON.stringify({ key: "Feedback" }) });
    expect(published.status).toBe(201);
    const form = await published.json() as { id: string; shortCode: string; theme: string; questions: Array<{ id: string }> };
    expect(form).toMatchObject({ theme: "ocean", settings: { confirmationMessage: "Thanks for your feedback.", showProgressBar: true }, questions: [{ id: "q1" }, { id: "q2", type: "multiple-choice-grid", rows: ["Support"] }] });
    await expect((await app.request(`http://localhost/public/forms/${form.id}`)).json()).resolves.toMatchObject({ id: form.id, title: "Feedback" });
    await expect((await app.request(`http://localhost/public/forms/${form.shortCode}`)).json()).resolves.toMatchObject({ id: form.id, shortCode: form.shortCode, title: "Feedback" });
    expect((await app.request(`http://localhost/public/forms/${form.id}/responses`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ answers: { q1: "Great", q2: ["Support::Great"] } }) })).status).toBe(201);
    await expect((await app.request(`http://localhost/forms/${form.id}/responses`, { headers: { cookie } })).json()).resolves.toMatchObject({ responses: [{ answers: { q1: "Great", q2: ["Support::Great"] } }] });
  });
});
