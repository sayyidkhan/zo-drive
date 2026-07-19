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

  it("uploads a browser-compatible Blob through the API", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ key: "Notes/hello.txt", name: "hello.txt", size: 5, contentType: "text/plain", updatedAt: "2026-01-01T00:00:00.000Z" }), { status: 201 })
    );
    const client = new ZoDriveClient({ baseUrl: "https://drive.example/", fetcher });

    await client.upload({ file: new Blob(["hello"], { type: "text/plain" }), fileName: "hello.txt", path: "Notes" });

    const [, request] = fetcher.mock.calls[0] as [string, RequestInit];
    expect(request.method).toBe("POST");
    expect(request.body).toBeInstanceOf(FormData);
    const form = request.body as FormData;
    expect(form.get("path")).toBe("Notes");
    expect((form.get("file") as File).name).toBe("hello.txt");
  });

  it("surfaces typed API errors", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: { code: "NOT_FOUND", message: "File not found" } }), { status: 404 })
    );
    const client = new ZoDriveClient({ baseUrl: "https://drive.example", fetcher });

    await expect(client.delete("missing.txt")).rejects.toMatchObject({ code: "NOT_FOUND", status: 404 });
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

  it("uses the CLI-only login endpoint without exposing a token to browser login", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ user: { id: "owner", username: "sayyid" }, sessionToken: "signed-session" }), { status: 200 })
    );
    const client = new ZoDriveClient({ baseUrl: "https://drive.example", fetcher });

    await expect(client.loginForCli({ username: "sayyid", password: "correct-horse-battery-staple" })).resolves.toEqual({
      user: { id: "owner", username: "sayyid" },
      sessionToken: "signed-session"
    });
    expect(fetcher).toHaveBeenCalledWith("https://drive.example/auth/login", expect.objectContaining({
      method: "POST",
      headers: expect.any(Headers)
    }));
    const [, request] = fetcher.mock.calls[0] as [string, RequestInit];
    expect(new Headers(request.headers).get("x-zo-drive-cli")).toBe("1");
  });
});
