import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { createApp } from "./app.js";
import { LocalAuthStore } from "./auth/local-auth-store.js";
import { SessionService } from "./auth/session.js";
import { LocalShareStore } from "./sharing/local-share-store.js";
import { LocalDriveStorage } from "./storage/local-drive-storage.js";

describe("Zo Drive API", () => {
  const roots: string[] = [];

  afterEach(async () => {
    await Promise.all(roots.splice(0).map((root) => rm(root, { force: true, recursive: true })));
  });

  async function createTestApp() {
    const root = await mkdtemp(join(tmpdir(), "zo-drive-api-"));
    roots.push(root);
    return createApp({
      storage: new LocalDriveStorage({ root }),
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

  it("uploads, lists, streams, reports usage, and deletes a file", async () => {
    const app = await createTestApp();
    const form = new FormData();
    form.set("file", new File(["hello from Zo Drive"], "hello.txt", { type: "text/plain" }));
    form.set("path", "Notes");

    const uploaded = await app.request("http://localhost/objects", {
      method: "POST",
      headers: { "x-test-user-id": "alice" },
      body: form
    });

    expect(uploaded.status).toBe(201);
    await expect(uploaded.json()).resolves.toMatchObject({ key: "Notes/hello.txt", size: 19, contentType: "text/plain" });

    const listed = await app.request("http://localhost/objects?prefix=Notes", { headers: { "x-test-user-id": "alice" } });
    await expect(listed.json()).resolves.toMatchObject({ objects: [{ key: "Notes/hello.txt" }] });

    const usage = await app.request("http://localhost/usage", { headers: { "x-test-user-id": "alice" } });
    await expect(usage.json()).resolves.toEqual({ fileCount: 1, usedBytes: 19 });

    const downloaded = await app.request("http://localhost/objects/Notes/hello.txt", { headers: { "x-test-user-id": "alice" } });
    expect(downloaded.headers.get("content-type")).toContain("text/plain");
    await expect(downloaded.text()).resolves.toBe("hello from Zo Drive");

    const deleted = await app.request("http://localhost/objects/Notes/hello.txt", {
      method: "DELETE",
      headers: { "x-test-user-id": "alice" }
    });
    expect(deleted.status).toBe(204);

    const missing = await app.request("http://localhost/objects/Notes/hello.txt", { headers: { "x-test-user-id": "alice" } });
    expect(missing.status).toBe(404);
  });

  it("does not expose one user's data to another user", async () => {
    const app = await createTestApp();
    const form = new FormData();
    form.set("file", new File(["private"], "private.txt", { type: "text/plain" }));

    await app.request("http://localhost/objects", {
      method: "POST",
      headers: { "x-test-user-id": "alice" },
      body: form
    });

    const listAsBob = await app.request("http://localhost/objects", { headers: { "x-test-user-id": "bob" } });
    await expect(listAsBob.json()).resolves.toEqual({ objects: [] });

    const downloadAsBob = await app.request("http://localhost/objects/private.txt", { headers: { "x-test-user-id": "bob" } });
    expect(downloadAsBob.status).toBe(404);
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
      user: expect.objectContaining({ username: "sayyid" })
    });

    const profile = await app.request("http://localhost/auth/profile", {
      method: "PATCH",
      headers: { "content-type": "application/json", cookie: cookie! },
      body: JSON.stringify({ username: "drive-owner" })
    });
    await expect(profile.json()).resolves.toEqual({ user: expect.objectContaining({ username: "drive-owner" }) });

    const password = await app.request("http://localhost/auth/password", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: cookie! },
      body: JSON.stringify({ currentPassword: "correct-horse-battery-staple", newPassword: "new-owner-password" })
    });
    expect(password.status).toBe(204);

    const blockedRegistration = await app.request("http://localhost/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: "intruder", password: "correct-horse-battery-staple" })
    });
    expect(blockedRegistration.status).toBe(403);

    const form = new FormData();
    form.set("file", new File(["owner only"], "private.txt", { type: "text/plain" }));
    expect((await app.request("http://localhost/objects", { method: "POST", headers: { cookie: cookie! }, body: form })).status).toBe(201);
    expect((await app.request("http://localhost/objects")).status).toBe(401);

    const deleted = await app.request("http://localhost/auth/account", {
      method: "DELETE",
      headers: { "content-type": "application/json", cookie: cookie! },
      body: JSON.stringify({ password: "new-owner-password", confirmation: "DELETE MY DRIVE" })
    });
    expect(deleted.status).toBe(204);
    expect(deleted.headers.get("set-cookie")).toContain("Max-Age=0");
    expect((await app.request("http://localhost/objects", { headers: { cookie: cookie! } })).status).toBe(401);
    await expect((await app.request("http://localhost/auth/status", { headers: { cookie: cookie! } })).json()).resolves.toEqual({ authenticated: false, registrationAllowed: true, user: null });
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
    const form = new FormData();
    form.set("file", new File(["shared contents"], "shared.txt", { type: "text/plain" }));
    expect((await app.request("http://localhost/objects", { method: "POST", headers: { cookie }, body: form })).status).toBe(201);

    const publicShare = await app.request("http://localhost/shares", { method: "POST", headers: { "content-type": "application/json", cookie }, body: JSON.stringify({ key: "shared.txt", access: "public" }) });
    const publicBody = await publicShare.json() as { id: string };
    expect(publicShare.status).toBe(201);
    await expect((await app.request(`http://localhost/shared/${publicBody.id}`)).json()).resolves.toMatchObject({ name: "shared.txt", requiresPasscode: false });
    await expect((await app.request(`http://localhost/shared/${publicBody.id}/content`)).text()).resolves.toBe("shared contents");

    const expiredShare = await app.request("http://localhost/shares", { method: "POST", headers: { "content-type": "application/json", cookie }, body: JSON.stringify({ key: "shared.txt", access: "public", expiresAt: new Date(Date.now() - 60_000).toISOString() }) });
    expect(expiredShare.status).toBe(400);

    const protectedShare = await app.request("http://localhost/shares", { method: "POST", headers: { "content-type": "application/json", cookie }, body: JSON.stringify({ key: "shared.txt", access: "passcode", passcode: "open-sesame", expiresAt: new Date(Date.now() + 60_000).toISOString() }) });
    const protectedBody = await protectedShare.json() as { id: string };
    expect((await app.request(`http://localhost/shared/${protectedBody.id}/content`)).status).toBe(401);
    await expect((await app.request(`http://localhost/shared/${protectedBody.id}/content`, { headers: { "x-zo-drive-share-passcode": "open-sesame" } })).text()).resolves.toBe("shared contents");

    expect((await app.request(`http://localhost/shares/${publicBody.id}`, { method: "DELETE", headers: { cookie } })).status).toBe(204);
    expect((await app.request(`http://localhost/shared/${publicBody.id}`)).status).toBe(404);
  });
});
