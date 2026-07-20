import { describe, expect, it, vi } from "vitest";

import { ZoDriveClient } from "./index.js";

describe("ZoDriveClient", () => {
  it("lists files through the API with encoded query parameters", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ objects: [{ key: "Notes/hello.txt", name: "hello.txt", size: 5, contentType: "text/plain", updatedAt: "2026-01-01T00:00:00.000Z" }] }), { status: 200 })
    );
    const client = new ZoDriveClient({ baseUrl: "https://drive.example", fetcher });

    const result = await client.list({ prefix: "Notes", query: "hello world" });

    expect(result).toHaveLength(1);
    expect(fetcher).toHaveBeenCalledWith(
      "https://drive.example/objects?prefix=Notes&query=hello+world",
      expect.objectContaining({ credentials: "include", method: "GET" })
    );
  });

  it("sends advanced file search options through the list endpoint", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ objects: [] }), { status: 200 }));
    const client = new ZoDriveClient({ baseUrl: "https://drive.example", fetcher });

    await client.list({ contentQuery: "growth plan", modifiedAfter: "2026-01-01T00:00:00.000Z", starred: true, type: "document" });

    expect(fetcher).toHaveBeenCalledWith("https://drive.example/objects?contentQuery=growth+plan&type=document&starred=true&modifiedAfter=2026-01-01T00%3A00%3A00.000Z", expect.objectContaining({ method: "GET" }));
  });

  it("streams a browser-compatible Blob through the API", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ key: "Notes/hello.txt", name: "hello.txt", size: 5, contentType: "text/plain", updatedAt: "2026-01-01T00:00:00.000Z" }), { status: 201 })
    );
    const client = new ZoDriveClient({ baseUrl: "https://drive.example/", fetcher });

    await client.upload({ file: new Blob(["hello"], { type: "text/plain" }), fileName: "hello.txt", path: "Notes" });

    const [, request] = fetcher.mock.calls[0] as [string, RequestInit];
    expect(request.method).toBe("POST");
    expect(request.body).toBeInstanceOf(Blob);
    const headers = new Headers(request.headers);
    expect(headers.get("content-type")).toBe("text/plain");
    expect(headers.get("x-zo-drive-path")).toBe("Notes");
    expect(headers.get("x-zo-drive-file-name")).toBe("hello.txt");
  });

  it("surfaces typed API errors", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: { code: "NOT_FOUND", message: "File not found" } }), { status: 404 })
    );
    const client = new ZoDriveClient({ baseUrl: "https://drive.example", fetcher });

    await expect(client.delete("missing.txt")).rejects.toMatchObject({ code: "NOT_FOUND", status: 404 });
  });

  it("updates the storage quota through the usage endpoint", async () => {
    const usage = { fileCount: 0, usedBytes: 0, quotaBytes: 200 * 1024 * 1024 * 1024, quotaAvailableBytes: 200 * 1024 * 1024 * 1024, minQuotaBytes: 1024 * 1024 * 1024, maxQuotaBytes: 400 * 1024 * 1024 * 1024, totalBytes: 500 * 1024 * 1024 * 1024, availableBytes: 499 * 1024 * 1024 * 1024, systemUsedBytes: 1024 * 1024 * 1024, categories: [{ id: "photos", bytes: 0, fileCount: 0 }, { id: "videos", bytes: 0, fileCount: 0 }, { id: "documents", bytes: 0, fileCount: 0 }, { id: "audio", bytes: 0, fileCount: 0 }, { id: "archives", bytes: 0, fileCount: 0 }, { id: "other", bytes: 0, fileCount: 0 }, { id: "trash", bytes: 0, fileCount: 0 }] };
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify(usage), { status: 200 }));
    const client = new ZoDriveClient({ baseUrl: "https://drive.example", fetcher });

    await expect(client.setQuota(usage.quotaBytes)).resolves.toMatchObject({ quotaBytes: usage.quotaBytes });
    expect(fetcher).toHaveBeenCalledWith("https://drive.example/usage/quota", expect.objectContaining({ method: "PUT" }));
  });

  it("creates and lists empty folders through the API", async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ key: "Projects", name: "Projects", updatedAt: "2026-01-01T00:00:00.000Z" }), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ folders: [{ key: "Projects", name: "Projects", updatedAt: "2026-01-01T00:00:00.000Z" }] }), { status: 200 }));
    const client = new ZoDriveClient({ baseUrl: "https://drive.example", fetcher });

    await expect(client.createFolder("Projects")).resolves.toMatchObject({ key: "Projects" });
    await expect(client.listFolders()).resolves.toMatchObject([{ key: "Projects" }]);
    expect(fetcher).toHaveBeenNthCalledWith(1, "https://drive.example/folders", expect.objectContaining({ method: "POST" }));
  });

  it("creates Zo-native files through the API", async () => {
    const file = { key: "Projects/Roadmap", name: "Roadmap", size: 10, contentType: "application/vnd.zo.spreadsheet+json", nativeType: "spreadsheet", updatedAt: "2026-01-01T00:00:00.000Z", starred: false };
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify(file), { status: 201 }));
    const client = new ZoDriveClient({ baseUrl: "https://drive.example", fetcher });

    await expect(client.createNativeFile({ name: "Roadmap", path: "Projects", type: "spreadsheet" })).resolves.toEqual(file);
    expect(fetcher).toHaveBeenCalledWith("https://drive.example/native-files", expect.objectContaining({ method: "POST" }));
  });

  it("saves Zo-native file content through the API", async () => {
    const file = { key: "Projects/Notes", name: "Notes", size: 10, contentType: "application/vnd.zo.document+json", nativeType: "document", updatedAt: "2026-01-01T00:00:00.000Z", starred: false };
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify(file), { status: 200 }));
    const client = new ZoDriveClient({ baseUrl: "https://drive.example", fetcher });
    const content = { format: "zo-native" as const, type: "document" as const, version: 1 as const, blocks: ["Hello"] };

    await expect(client.saveNativeFile("Projects/Notes", content)).resolves.toEqual(file);
    expect(fetcher).toHaveBeenCalledWith("https://drive.example/native-files/Projects/Notes", expect.objectContaining({ method: "PUT" }));
  });

  it("renames files through the API", async () => {
    const file = { key: "Projects/Strategy", name: "Strategy", size: 10, contentType: "application/vnd.zo.document+json", nativeType: "document", updatedAt: "2026-01-01T00:00:00.000Z", starred: false };
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify(file), { status: 200 }));
    const client = new ZoDriveClient({ baseUrl: "https://drive.example", fetcher });

    await expect(client.rename("Projects/Notes", "Strategy")).resolves.toEqual(file);
    expect(fetcher).toHaveBeenCalledWith("https://drive.example/objects/Projects/Notes", expect.objectContaining({ method: "PATCH" }));
  });

  it("lists and updates starred files through the API", async () => {
    const starredFile = { key: "Notes/hello.txt", name: "hello.txt", size: 5, contentType: "text/plain", updatedAt: "2026-01-01T00:00:00.000Z", starred: true };
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ objects: [starredFile] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(starredFile), { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    const client = new ZoDriveClient({ baseUrl: "https://drive.example", fetcher });

    await expect(client.listStarred()).resolves.toEqual([starredFile]);
    await expect(client.star("Notes/hello.txt")).resolves.toEqual(starredFile);
    await expect(client.unstar("Notes/hello.txt")).resolves.toBeUndefined();
    expect(fetcher).toHaveBeenNthCalledWith(2, "https://drive.example/stars/Notes/hello.txt", expect.objectContaining({ method: "PUT" }));
  });

  it("updates a passcode-protected share through the API", async () => {
    const share = { id: "share-123", key: "hello.txt", name: "hello.txt", size: 5, contentType: "text/plain", access: "passcode", kind: "share", expiresAt: null, createdAt: "2026-01-01T00:00:00.000Z" };
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify(share), { status: 200 }));
    const client = new ZoDriveClient({ baseUrl: "https://drive.example", fetcher });

    await expect(client.updateSharePasscode({ id: share.id, passcode: "new-secret" })).resolves.toEqual(share);
    expect(fetcher).toHaveBeenCalledWith("https://drive.example/shares/share-123/passcode", expect.objectContaining({ method: "PATCH" }));
  });

  it("creates, lists, and revokes browser-managed API keys", async () => {
    const key = { id: "key-123", name: "MacBook", prefix: "zdk_key", scopes: ["read", "write"], createdAt: "2026-01-01T00:00:00.000Z", expiresAt: null, lastUsedAt: null };
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ ...key, apiKey: "zdk_key_secret" }), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ keys: [key] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    const client = new ZoDriveClient({ baseUrl: "https://drive.example", fetcher });

    await expect(client.createApiKey({ name: "MacBook", scopes: ["read", "write"], expiresAt: null })).resolves.toMatchObject({ apiKey: "zdk_key_secret" });
    await expect(client.listApiKeys()).resolves.toEqual([key]);
    await expect(client.revokeApiKey(key.id)).resolves.toBeUndefined();
    expect(fetcher).toHaveBeenNthCalledWith(1, "https://drive.example/api-keys", expect.objectContaining({ method: "POST" }));
    expect(fetcher).toHaveBeenNthCalledWith(3, "https://drive.example/api-keys/key-123", expect.objectContaining({ method: "DELETE" }));
  });
});
