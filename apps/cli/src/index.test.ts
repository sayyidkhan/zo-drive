import { mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it, vi } from "vitest";
import { DriveApiError } from "@zo-drive/sdk";

import { collectConfiguration, CONFIGURATION_GUIDE, CONFIGURATION_VERIFICATION_GUIDE, formatLatency, isMainModule, runCli, ZO_DRIVE_LOGO } from "./index.js";

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

  it("lists direct Drive entries with familiar long, sort, and folder flags", async () => {
    const write = vi.fn();
    const client = {
      list: vi.fn().mockResolvedValue([
        { key: ".secret", name: ".secret", size: 1, contentType: "text/plain", updatedAt: "2026-01-01T00:00:00.000Z" },
        { key: "Photos/nested.jpg", name: "nested.jpg", size: 4, contentType: "image/jpeg", updatedAt: "2026-01-03T00:00:00.000Z" },
        { key: "report.pdf", name: "report.pdf", size: 2 * 1_024, contentType: "application/pdf", updatedAt: "2026-01-02T00:00:00.000Z" }
      ]),
      listFolders: vi.fn().mockResolvedValue([{ key: "Photos", name: "Photos", updatedAt: "2026-01-03T00:00:00.000Z" }])
    };

    await expect(runCli(["ls", "-lF"], { client, write })).resolves.toBe(0);

    const output = write.mock.calls[0]?.[0] as string;
    expect(output).toContain("Photos/");
    expect(output).toContain("report.pdf");
    expect(output).not.toContain(".secret");
    expect(output).not.toContain("nested.jpg");

    await expect(runCli(["ls", "-a", "-S"], { client, write })).resolves.toBe(0);
    expect(write.mock.calls[1]?.[0]).toContain(".secret");
  });

  it("uses clean terminal columns by default and one item per line with -1", async () => {
    const write = vi.fn();
    const client = {
      list: vi.fn().mockResolvedValue([
        { key: "alpha.txt", name: "alpha.txt", size: 1, contentType: "text/plain", updatedAt: "2026-01-01T00:00:00.000Z" },
        { key: "beta.txt", name: "beta.txt", size: 1, contentType: "text/plain", updatedAt: "2026-01-01T00:00:00.000Z" },
        { key: "gamma.txt", name: "gamma.txt", size: 1, contentType: "text/plain", updatedAt: "2026-01-01T00:00:00.000Z" }
      ]),
      listFolders: vi.fn().mockResolvedValue([])
    };

    await expect(runCli(["ls"], { client, terminalColumns: 22, write })).resolves.toBe(0);
    await expect(runCli(["ls", "-1"], { client, terminalColumns: 22, write })).resolves.toBe(0);

    expect(write).toHaveBeenNthCalledWith(1, "alpha.txt  beta.txt\ngamma.txt\n");
    expect(write).toHaveBeenNthCalledWith(2, "alpha.txt\nbeta.txt\ngamma.txt\n");
  });

  it("lists nested folders only with recursive ls", async () => {
    const write = vi.fn();
    const client = {
      list: vi.fn().mockResolvedValue([
        { key: "root.txt", name: "root.txt", size: 1, contentType: "text/plain", updatedAt: "2026-01-01T00:00:00.000Z" },
        { key: "Photos/pic.jpg", name: "pic.jpg", size: 2, contentType: "image/jpeg", updatedAt: "2026-01-02T00:00:00.000Z" }
      ]),
      listFolders: vi.fn().mockImplementation((prefix?: string) => Promise.resolve(prefix === "Photos" ? [] : [{ key: "Photos", name: "Photos", updatedAt: "2026-01-02T00:00:00.000Z" }]))
    };

    await expect(runCli(["ls", "-R"], { client, write })).resolves.toBe(0);

    expect(write).toHaveBeenCalledWith(expect.stringContaining(".:\n"));
    expect(write).toHaveBeenCalledWith(expect.stringContaining("Photos:\n"));
    expect(write).toHaveBeenCalledWith(expect.stringContaining("pic.jpg"));
  });

  it("shows Drive-compatible ls options", async () => {
    const write = vi.fn();

    await expect(runCli(["ls", "--help"], { client: {}, write })).resolves.toBe(0);

    expect(write).toHaveBeenCalledWith(expect.stringContaining("-l, --long"));
    expect(write).toHaveBeenCalledWith(expect.stringContaining("-R, --recursive"));
  });

  it("supports Bash-style ls option shorthand before the command", async () => {
    const write = vi.fn();
    const client = {
      list: vi.fn().mockResolvedValue([{ key: "report.txt", name: "report.txt", size: 1, contentType: "text/plain", updatedAt: "2026-01-01T00:00:00.000Z" }]),
      listFolders: vi.fn().mockResolvedValue([])
    };

    await expect(runCli(["-lrt"], { client, write })).resolves.toBe(0);
    await expect(runCli(["help", "ls"], { client: {}, write })).resolves.toBe(0);

    expect(write).toHaveBeenCalledWith(expect.stringContaining("FILE"));
    expect(write).toHaveBeenCalledWith(expect.stringContaining("Usage: zo-drive ls [path] [options]"));
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

  it("shows a progress bar for large interactive uploads", async () => {
    const progress = vi.fn();
    const contents = Buffer.alloc(2 * 1_024 ** 2);
    const client = {
      upload: vi.fn(async ({ onProgress }) => {
        onProgress?.({ loaded: 0, total: contents.byteLength });
        onProgress?.({ loaded: contents.byteLength, total: contents.byteLength });
        return { key: "movie.mov", name: "movie.mov", size: contents.byteLength, contentType: "video/quicktime", starred: false, updatedAt: "2026-01-01T00:00:00.000Z" };
      })
    };

    await expect(runCli(["upload", "/tmp/movie.mov"], { client, isInteractive: true, progress, readFile: vi.fn().mockResolvedValue(contents), write: vi.fn() })).resolves.toBe(0);

    expect(progress).toHaveBeenCalledWith("\rUploading [--------------------] 0% (0 B / 2.0 MB)");
    expect(progress).toHaveBeenCalledWith("\rUploading [####################] 100% (2.0 MB / 2.0 MB)");
    expect(progress).toHaveBeenLastCalledWith("\n");
  });

  it("dry-runs uploads without reading or transferring the local file", async () => {
    const write = vi.fn();
    const readFile = vi.fn();
    const upload = vi.fn();
    const getUsage = vi.fn().mockResolvedValue({ quotaAvailableBytes: 10 * 1_024 ** 2 });
    const statFile = vi.fn().mockResolvedValue({ isFile: () => true, size: 2 * 1_024 ** 2 });

    await expect(runCli(["upload", "/tmp/plan.pdf", "--path", "Plans", "--dry-run"], { client: { getUsage, upload }, readFile, statFile, write })).resolves.toBe(0);

    expect(getUsage).toHaveBeenCalledOnce();
    expect(statFile).toHaveBeenCalledWith("/tmp/plan.pdf");
    expect(readFile).not.toHaveBeenCalled();
    expect(upload).not.toHaveBeenCalled();
    expect(write).toHaveBeenCalledWith("Dry run passed. Ready to upload /tmp/plan.pdf (2.0 MB) to Plans/plan.pdf. Nothing was uploaded.\nZo Drive will create the folder Plans if it does not exist.\n");
  });

  it("creates an empty folder through the shared SDK", async () => {
    const write = vi.fn();
    const client = { createFolder: vi.fn().mockResolvedValue({ key: "Projects", name: "Projects", updatedAt: "2026-01-01T00:00:00.000Z" }) };

    const code = await runCli(["mkdir", "Projects"], { client, write });

    expect(code).toBe(0);
    expect(client.createFolder).toHaveBeenCalledWith("Projects");
    expect(write).toHaveBeenCalledWith("Created folder Projects\n");
  });

  it("dry-runs downloads without downloading or writing the target", async () => {
    const write = vi.fn();
    const writeFile = vi.fn();
    const download = vi.fn();
    const list = vi.fn().mockResolvedValue([{ key: "Plans/plan.pdf", name: "plan.pdf", size: 2 * 1_024 ** 2, contentType: "application/pdf", updatedAt: "2026-01-01T00:00:00.000Z" }]);

    await expect(runCli(["download", "Plans/plan.pdf", "--output", "./plan.pdf", "--dry-run"], { client: { download, list }, write, writeFile })).resolves.toBe(0);

    expect(list).toHaveBeenCalledWith({ prefix: "Plans/plan.pdf" });
    expect(download).not.toHaveBeenCalled();
    expect(writeFile).not.toHaveBeenCalled();
    expect(write).toHaveBeenCalledWith("Dry run passed. Ready to download Plans/plan.pdf (2.0 MB) to ./plan.pdf. Nothing was downloaded.\n");
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
    expect(write).toHaveBeenCalledWith("zo-drive 1.2.0\n");
  });

  it("moves files, sends rm targets to Trash, and checks whether files exist", async () => {
    const write = vi.fn();
    const error = vi.fn();
    const client = {
      delete: vi.fn().mockResolvedValue(undefined),
      list: vi.fn().mockResolvedValue([{ key: "Projects/plan.txt", name: "plan.txt", size: 4, contentType: "text/plain", updatedAt: "2026-01-01T00:00:00.000Z" }]),
      move: vi.fn().mockResolvedValue({ key: "Archive/plan.txt", name: "plan.txt", size: 4, contentType: "text/plain", updatedAt: "2026-01-01T00:00:00.000Z" })
    };

    await expect(runCli(["mv", "Projects/plan.txt", "Archive/plan.txt"], { client, write })).resolves.toBe(0);
    await expect(runCli(["rm", "Archive/plan.txt"], { client, write })).resolves.toBe(0);
    await expect(runCli(["exists", "Projects/plan.txt"], { client, write, error })).resolves.toBe(0);

    expect(client.move).toHaveBeenCalledWith("Projects/plan.txt", "Archive/plan.txt");
    expect(client.delete).toHaveBeenCalledWith("Archive/plan.txt");
    expect(client.list).toHaveBeenCalledWith({ prefix: "Projects/plan.txt" });
    expect(write).toHaveBeenCalledWith("Moved Projects/plan.txt to Archive/plan.txt\n");
    expect(write).toHaveBeenCalledWith("Moved Archive/plan.txt to Trash\n");
    expect(write).toHaveBeenCalledWith("Found Projects/plan.txt\n");
    expect(error).not.toHaveBeenCalled();
  });

  it("copies a Drive file and only overwrites with --force", async () => {
    const write = vi.fn();
    const copy = vi.fn().mockResolvedValue({ key: "Archive/plan copy.txt", name: "plan copy.txt", size: 4, contentType: "text/plain", starred: false, updatedAt: "2026-01-01T00:00:00.000Z" });

    await expect(runCli(["cp", "Plans/plan.txt", "Archive/plan copy.txt", "--force"], { client: { copy }, write })).resolves.toBe(0);

    expect(copy).toHaveBeenCalledWith("Plans/plan.txt", "Archive/plan copy.txt", { overwrite: true });
    expect(write).toHaveBeenCalledWith("Copied Plans/plan.txt to Archive/plan copy.txt\n");
  });

  it("explains how to replace an existing copy destination", async () => {
    const error = vi.fn();
    const copy = vi.fn().mockRejectedValue(new DriveApiError({ code: "ALREADY_EXISTS", message: "A file with this name already exists", status: 409 }));

    await expect(runCli(["cp", "Plans/plan.txt", "Archive/plan.txt"], { client: { copy }, error })).resolves.toBe(1);

    expect(error).toHaveBeenCalledWith("The destination already exists. Add --force to replace it.\n");
  });

  it("prints file metadata in text or JSON", async () => {
    const write = vi.fn();
    const object = { key: "Projects/plan.txt", name: "plan.txt", size: 1_024, contentType: "text/plain", updatedAt: "2026-01-01T00:00:00.000Z", starred: true };
    const client = { list: vi.fn().mockResolvedValue([object]) };

    await expect(runCli(["stat", "Projects/plan.txt"], { client, write })).resolves.toBe(0);
    await expect(runCli(["stat", "Projects/plan.txt", "--json"], { client, write })).resolves.toBe(0);

    expect(write).toHaveBeenCalledWith("Key: Projects/plan.txt\nName: plan.txt\nSize: 1.0 KB\nContent type: text/plain\nUpdated: 2026-01-01T00:00:00.000Z\nStarred: yes\n");
    expect(write).toHaveBeenCalledWith(`${JSON.stringify(object)}\n`);
  });

  it("prints the Zo Drive logo without requiring configuration", async () => {
    const write = vi.fn();

    const code = await runCli(["logo"], { client: {}, write });

    expect(code).toBe(0);
    expect(ZO_DRIVE_LOGO).toContain("\n");
    expect(ZO_DRIVE_LOGO).toContain("_ __(*)*");
    expect(write).toHaveBeenCalledWith(`${ZO_DRIVE_LOGO}\n`);
  });

  it("shows the logo and help aliases in CLI help", async () => {
    const write = vi.fn();

    const code = await runCli(["help"], { client: {}, write });

    expect(code).toBe(0);
    expect(write).toHaveBeenCalledWith(expect.stringContaining(ZO_DRIVE_LOGO));
    expect(write).toHaveBeenCalledWith(expect.stringContaining("help, --help, -h"));
    expect(write).toHaveBeenCalledWith(expect.stringContaining("zo-drive ls --help"));
  });

  it("shows the logo and storage status for the configured Drive", async () => {
    const write = vi.fn();
    const client = { getUsage: vi.fn().mockResolvedValue({ fileCount: 2, usedBytes: 1_024, quotaBytes: 10_240 }) };

    const code = await runCli(["status"], { client, write });

    expect(code).toBe(0);
    expect(client.getUsage).toHaveBeenCalledOnce();
    expect(write).toHaveBeenCalledWith("Zo Drive\n--------\nStatus: connected\nStorage: 2 files, 1.0 KB / 10.0 KB (10%)\n");
  });

  it("uses natural storage and latency units", async () => {
    const write = vi.fn();
    const client = { getUsage: vi.fn().mockResolvedValue({ fileCount: 2, usedBytes: 9 * 1_024 ** 2, quotaBytes: 100 * 1_024 ** 2 }) };

    await expect(runCli(["status"], { client, write })).resolves.toBe(0);

    expect(write).toHaveBeenCalledWith("Zo Drive\n--------\nStatus: connected\nStorage: 2 files, 9.0 MB / 100.0 MB (9%)\n");
    expect(formatLatency(999)).toBe("999 ms");
    expect(formatLatency(1_360)).toBe("1.4 s");
  });

  it("explains how to reconnect when Zo Drive rejects the device key", async () => {
    const error = vi.fn();
    const client = {
      getHealth: vi.fn().mockResolvedValue({ status: "ok" }),
      getUsage: vi.fn().mockRejectedValue(new DriveApiError({ code: "UNAUTHORIZED", message: "Authentication is required", status: 401 }))
    };

    await expect(runCli(["health"], { client, error })).resolves.toBe(1);

    expect(error).toHaveBeenCalledWith(expect.stringContaining("Zo Drive rejected the device API key"));
    expect(error).toHaveBeenCalledWith(expect.stringContaining("zo-drive configure"));
    expect(error).not.toHaveBeenCalledWith("Authentication is required\n");
  });

  it("reports API, authentication, storage, and disk health", async () => {
    const write = vi.fn();
    const usage = { fileCount: 2, usedBytes: 1_024, quotaBytes: 10_240, availableBytes: 50 * 1_024 ** 3, totalBytes: 100 * 1_024 ** 3 };
    const client = { getHealth: vi.fn().mockResolvedValue({ status: "ok" }), getUsage: vi.fn().mockResolvedValue(usage) };

    const code = await runCli(["health"], { client, write });

    expect(code).toBe(0);
    expect(client.getHealth).toHaveBeenCalledOnce();
    expect(client.getUsage).toHaveBeenCalledOnce();
    expect(write).toHaveBeenCalledWith(expect.stringContaining("API: ok ("));
    expect(write).toHaveBeenCalledWith(expect.stringContaining("Authentication: ok"));
    expect(write).toHaveBeenCalledWith(expect.stringContaining("Disk: 50.0 GB available of 100.0 GB"));
  });

  it("recognizes an npm-linked executable as the main module", async () => {
    const directory = await mkdtemp(join(tmpdir(), "zo-drive-cli-"));
    const executable = join(directory, "index.js");
    const linkedExecutable = join(directory, "zo-drive");

    try {
      await writeFile(executable, "#!/usr/bin/env node\n");
      await symlink(executable, linkedExecutable);

      expect(isMainModule(linkedExecutable, pathToFileURL(executable).href)).toBe(true);
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });

  it("collects a Drive URL and device key for interactive configuration", async () => {
    const prompts = { askApiKey: vi.fn().mockResolvedValue("zdk_example_key"), askUrl: vi.fn().mockResolvedValue("https://drive.example/drive/") };

    await expect(collectConfiguration({ prompts })).resolves.toEqual({ apiKey: "zdk_example_key", apiUrl: "https://drive.example/drive" });
    expect(prompts.askUrl).toHaveBeenCalledOnce();
    expect(prompts.askApiKey).toHaveBeenCalledOnce();
  });

  it("includes the device-key and URL guidance shown before configuration", () => {
    expect(CONFIGURATION_GUIDE).toContain("API Keys");
    expect(CONFIGURATION_GUIDE).toContain("https://your-drive.example/drive");
    expect(CONFIGURATION_GUIDE).toContain("hidden and saved only on this machine");
  });

  it("tells the user how to verify a saved connection", () => {
    expect(CONFIGURATION_VERIFICATION_GUIDE).toContain("zo-drive status");
    expect(CONFIGURATION_VERIFICATION_GUIDE).toContain("zo-drive health");
  });

  it("uses environment values for non-interactive automation without prompting", async () => {
    const prompts = { askApiKey: vi.fn(), askUrl: vi.fn() };

    await expect(collectConfiguration({ apiKey: "zdk_example_key", apiUrl: "https://drive.example/drive", prompts })).resolves.toEqual({ apiKey: "zdk_example_key", apiUrl: "https://drive.example/drive" });
    expect(prompts.askUrl).not.toHaveBeenCalled();
    expect(prompts.askApiKey).not.toHaveBeenCalled();
  });

  it("rejects unsafe URLs and invalid API keys before writing a configuration", async () => {
    const prompts = { askApiKey: vi.fn().mockResolvedValue("not-a-device-key"), askUrl: vi.fn().mockResolvedValue("https://drive.example/drive?token=secret") };

    await expect(collectConfiguration({ prompts })).rejects.toThrow("plain HTTP(S) Zo Drive URL");
  });

  it("returns a non-zero result and a useful error for invalid commands", async () => {
    const error = vi.fn();

    const code = await runCli(["unknown"], { client: {}, error });

    expect(code).toBe(1);
    expect(error).toHaveBeenCalledWith(expect.stringContaining("Unknown command"));
  });
});
