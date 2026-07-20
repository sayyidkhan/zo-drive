import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { runCli } from "@zo-drive/cli";
import { ZoDriveClient } from "@zo-drive/sdk";

import { createApp } from "./app.js";
import { LocalDriveStorage } from "./storage/local-drive-storage.js";

describe("CLI to API integration", () => {
  const roots: string[] = [];

  afterEach(async () => {
    await Promise.all(roots.splice(0).map((root) => rm(root, { force: true, recursive: true })));
  });

  it("uploads, lists, moves, downloads, and deletes through the complete client stack", async () => {
    const root = await mkdtemp(join(tmpdir(), "zo-drive-e2e-"));
    roots.push(root);
    const source = join(root, "report.txt");
    const destination = join(root, "downloaded-report.txt");
    await writeFile(source, "complete flow");

    const app = createApp({
      storage: new LocalDriveStorage({ root: join(root, "data") }),
      resolveUserId: (request) => request.headers.get("x-test-user-id")
    });
    const client = new ZoDriveClient({
      baseUrl: "http://zo-drive.test",
      headers: { "x-test-user-id": "owner" },
      fetcher: async (input, init) => await app.request(input, init)
    });
    const output: string[] = [];
    const dependencies = { client, write: (message: string) => output.push(message) };

    await expect(runCli(["upload", source, "--path", "Reports"], dependencies)).resolves.toBe(0);
    await expect(runCli(["ls", "Reports", "--json"], dependencies)).resolves.toBe(0);
    await expect(runCli(["exists", "Reports/report.txt"], dependencies)).resolves.toBe(0);
    await expect(runCli(["mv", "Reports/report.txt", "Archive/report.txt"], dependencies)).resolves.toBe(0);
    await expect(runCli(["download", "Archive/report.txt", "--output", destination], dependencies)).resolves.toBe(0);
    await expect(readFile(destination, "utf8")).resolves.toBe("complete flow");
    await expect(runCli(["rm", "Archive/report.txt"], dependencies)).resolves.toBe(0);
    await expect(client.list()).resolves.toEqual([]);

    expect(output).toContain("Uploaded Reports/report.txt (13 B)\n");
    expect(output).toContain("Found Reports/report.txt\n");
    expect(output).toContain("Moved Reports/report.txt to Archive/report.txt\n");
    expect(output).toContain("Downloaded Archive/report.txt to " + destination + "\n");
    expect(output).toContain("Moved Archive/report.txt to Trash\n");
  });
});
