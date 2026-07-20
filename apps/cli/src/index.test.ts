import { describe, expect, it, vi } from "vitest";

import { runCli } from "./index.js";

describe("zo-drive CLI", () => {
  it("lists files through the shared SDK as JSON", async () => {
    const write = vi.fn();
    const client = {
      list: vi.fn().mockResolvedValue([{ key: "Notes/hello.txt", name: "hello.txt", size: 5, contentType: "text/plain", updatedAt: "2026-01-01T00:00:00.000Z" }])
    };

    const code = await runCli(["ls", "Notes", "--json"], { client, write });

    expect(code).toBe(0);
    expect(client.list).toHaveBeenCalledWith({ prefix: "Notes" });
    expect(write).toHaveBeenCalledWith(`${JSON.stringify([{ key: "Notes/hello.txt", name: "hello.txt", size: 5, contentType: "text/plain", updatedAt: "2026-01-01T00:00:00.000Z" }])}\n`);
  });

  it("uploads a local file through the shared SDK", async () => {
    const write = vi.fn();
    const client = {
      upload: vi.fn().mockResolvedValue({ key: "Notes/report.txt", name: "report.txt", size: 6, contentType: "text/plain", updatedAt: "2026-01-01T00:00:00.000Z" })
    };
    const readFile = vi.fn().mockResolvedValue(Buffer.from("report"));

    const code = await runCli(["upload", "/tmp/report.txt", "--path", "Notes"], { client, readFile, write });

    expect(code).toBe(0);
    expect(client.upload).toHaveBeenCalledWith(expect.objectContaining({ fileName: "report.txt", path: "Notes" }));
    expect(write).toHaveBeenCalledWith("Uploaded Notes/report.txt (6 B)\n");
  });

  it("creates an empty folder through the shared SDK", async () => {
    const write = vi.fn();
    const client = { createFolder: vi.fn().mockResolvedValue({ key: "Projects", name: "Projects", updatedAt: "2026-01-01T00:00:00.000Z" }) };

    const code = await runCli(["mkdir", "Projects"], { client, write });

    expect(code).toBe(0);
    expect(client.createFolder).toHaveBeenCalledWith("Projects");
    expect(write).toHaveBeenCalledWith("Created folder Projects\n");
  });

  it("does not offer password-based terminal login", async () => {
    const write = vi.fn();
    const code = await runCli(["login"], { client: {}, write });
    expect(code).toBe(1);
    expect(write).not.toHaveBeenCalled();
  });

  it("prints the independent CLI version without a Drive client", async () => {
    const write = vi.fn();

    const code = await runCli(["--version"], { client: {}, write });

    expect(code).toBe(0);
    expect(write).toHaveBeenCalledWith("zo-drive 1.0.0\n");
  });

  it("returns a non-zero result and a useful error for invalid commands", async () => {
    const error = vi.fn();

    const code = await runCli(["unknown"], { client: {}, error });

    expect(code).toBe(1);
    expect(error).toHaveBeenCalledWith(expect.stringContaining("Unknown command"));
  });
});
