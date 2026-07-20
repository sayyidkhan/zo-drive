#!/usr/bin/env node

import { realpathSync } from "node:fs";
import { basename } from "node:path";
import { fileURLToPath } from "node:url";
import { readFile as readFileFromDisk, stat as statFileFromDisk, writeFile as writeFileToDisk } from "node:fs/promises";
import { createInterface } from "node:readline/promises";

import { DriveApiError, ZoDriveClient } from "@zo-drive/sdk";
import type { DriveFolder, DriveObject, StorageUsage } from "@zo-drive/types";

import { readLocalConfig, writeLocalConfig } from "./config.js";

const CLI_VERSION = "1.2.0";
const PROGRESS_BAR_MIN_BYTES = 1_024 ** 2;

export const ZO_DRIVE_LOGO = [
  " ______       ____       _",
  "|__  /___    |  _ \\ _ __(*)*   _____",
  "  / // _ \\   | | | | '__| \\ \\ / / _ \\",
  " / /| (*) |  | |*| | |  | |\\ V /  __/",
  "/____\\___/   |____/|*|  |*| \\_/ \\___|"
].join("\n");

export const CONFIGURATION_GUIDE = [
  "Connect this machine to Zo Drive",
  "1. Open Zo Drive in your browser and go to API Keys.",
  "2. Create a device key with read access (and write access if you will upload or manage files).",
  "3. Enter the public Zo Drive URL, including /drive (for example https://your-drive.example/drive).",
  "4. Paste the zdk_ device key below. It is hidden and saved only on this machine."
].join("\n");

export const CONFIGURATION_VERIFICATION_GUIDE = [
  "Configuration saved at ~/.config/zo-drive/config.json.",
  "Verify that Zo Drive accepts this device key:",
  "  zo-drive status",
  "For a fuller connection check, run:",
  "  zo-drive health"
].join("\n");

type CliClient = Partial<Pick<ZoDriveClient, "copy" | "createFolder" | "delete" | "download" | "getHealth" | "getUsage" | "list" | "listFolders" | "move" | "upload">>;

type CliDependencies = {
  client: CliClient;
  write?: (message: string) => void;
  error?: (message: string) => void;
  readFile?: typeof readFileFromDisk;
  isInteractive?: boolean;
  progress?: (message: string) => void;
  statFile?: (path: string) => Promise<{ isFile: () => boolean; size: number }>;
  terminalColumns?: number;
  writeFile?: typeof writeFileToDisk;
};

export async function runCli(args: string[], dependencies: CliDependencies): Promise<number> {
  const write = dependencies.write ?? ((message) => process.stdout.write(message));
  const error = dependencies.error ?? ((message) => process.stderr.write(message));
  const readFile = dependencies.readFile ?? readFileFromDisk;
  const progress = dependencies.progress ?? ((message) => process.stderr.write(message));
  const statFile = dependencies.statFile ?? statFileFromDisk;
  const terminalColumns = dependencies.terminalColumns ?? process.stdout.columns;
  const writeFile = dependencies.writeFile ?? writeFileToDisk;
  const [command, ...commandArgs] = args;

  if (isLsShorthand(command)) return runCli(["ls", ...args], dependencies);

  try {
    switch (command) {
      case "ls": {
        const { path, options } = parseLsArguments(commandArgs);
        if (options.help) {
          write(lsHelpText());
          return 0;
        }
        const objects = await requireMethod(dependencies.client, "list")({ prefix: path });
        if (options.json) {
          write(`${JSON.stringify(objects)}\n`);
          return 0;
        }
        const listFolders = requireMethod(dependencies.client, "listFolders");
        const exactFile = path && objects.find((object) => object.key === path);
        if (options.directoryOnly && path) {
          const entry = exactFile
            ? fileEntry(exactFile)
            : (await listFolders(parentDriveKey(path))).find((folder) => folder.key === path);
          if (!entry) {
            error(`Not found: ${path}\n`);
            return 1;
          }
          write(formatLsEntries([isDriveFolder(entry) ? folderEntry(entry) : entry], options, terminalColumns));
          return 0;
        }
        if (exactFile) {
          write(formatLsEntries([fileEntry(exactFile)], options, terminalColumns));
          return 0;
        }
        if (options.recursive) {
          const listings = await recursiveLsListings({ folders: listFolders, objects, path });
          write(formatRecursiveLsListings(listings, options, terminalColumns));
          return 0;
        }
        const folders = await listFolders(path);
        write(formatLsEntries([...directFileEntries(objects, path), ...folders.map(folderEntry)], options, terminalColumns));
        return 0;
      }
      case "upload": {
        const { positionals, options } = parseArguments(commandArgs, ["path"], ["dry-run"]);
        if (positionals.length !== 1) {
          throw new CliUsageError("Usage: zo-drive upload <file> [--path <folder>] [--dry-run]");
        }
        const localPath = positionals[0]!;
        if (options["dry-run"]) {
          const file = await statFile(localPath);
          if (!file.isFile()) throw new CliUsageError(`Not a file: ${localPath}`);
          const usage = await requireMethod(dependencies.client, "getUsage")();
          if (file.size > usage.quotaAvailableBytes) {
            throw new CliUsageError(`Dry run failed: ${localPath} (${formatBytes(file.size)}) exceeds the remaining Drive quota of ${formatBytes(usage.quotaAvailableBytes)}.`);
          }
          write(`Dry run passed. Ready to upload ${localPath} (${formatBytes(file.size)}) to ${joinDriveKey(options.path, basename(localPath))}. Nothing was uploaded.${options.path ? `\nZo Drive will create the folder ${options.path} if it does not exist.` : ""}\n`);
          return 0;
        }
        const contents = await readFile(localPath);
        const uploadProgress = contents.byteLength >= PROGRESS_BAR_MIN_BYTES && (dependencies.isInteractive ?? process.stderr.isTTY)
          ? createUploadProgress(progress)
          : undefined;
        let object;
        try {
          object = await requireMethod(dependencies.client, "upload")({
            file: new Blob([contents]),
            fileName: basename(localPath),
            onProgress: uploadProgress?.update,
            path: options.path
          });
        } finally {
          uploadProgress?.finish();
        }
        write(`Uploaded ${object.key} (${formatBytes(object.size)})\n`);
        return 0;
      }
      case "mkdir": {
        const { positionals } = parseArguments(commandArgs, []);
        if (positionals.length !== 1) {
          throw new CliUsageError("Usage: zo-drive mkdir <path>");
        }
        const folder = await requireMethod(dependencies.client, "createFolder")(positionals[0]!);
        write(`Created folder ${folder.key}\n`);
        return 0;
      }
      case "download": {
        const { positionals, options } = parseArguments(commandArgs, ["output"], ["dry-run"]);
        if (positionals.length !== 1) {
          throw new CliUsageError("Usage: zo-drive download <key> [--output <file>] [--dry-run]");
        }
        const key = positionals[0]!;
        const target = options.output ?? basename(key);
        if (options["dry-run"]) {
          const object = (await requireMethod(dependencies.client, "list")({ prefix: key })).find((candidate) => candidate.key === key);
          if (!object) {
            error(`Not found: ${key}\n`);
            return 1;
          }
          write(`Dry run passed. Ready to download ${key} (${formatBytes(object.size)}) to ${target}. Nothing was downloaded.\n`);
          return 0;
        }
        const response = await requireMethod(dependencies.client, "download")(key);
        await writeFile(target, Buffer.from(await response.arrayBuffer()));
        write(`Downloaded ${key} to ${target}\n`);
        return 0;
      }
      case "delete": {
        const { positionals } = parseArguments(commandArgs, []);
        if (positionals.length !== 1) {
          throw new CliUsageError("Usage: zo-drive delete <key>");
        }
        await requireMethod(dependencies.client, "delete")(positionals[0]!);
        write(`Deleted ${positionals[0]}\n`);
        return 0;
      }
      case "rm": {
        const { positionals } = parseArguments(commandArgs, []);
        if (positionals.length !== 1) {
          throw new CliUsageError("Usage: zo-drive rm <key>");
        }
        await requireMethod(dependencies.client, "delete")(positionals[0]!);
        write(`Moved ${positionals[0]} to Trash\n`);
        return 0;
      }
      case "mv": {
        const { positionals } = parseArguments(commandArgs, []);
        if (positionals.length !== 2) {
          throw new CliUsageError("Usage: zo-drive mv <source> <destination>");
        }
        const object = await requireMethod(dependencies.client, "move")(positionals[0]!, positionals[1]!);
        write(`Moved ${positionals[0]} to ${object.key}\n`);
        return 0;
      }
      case "cp": {
        const { positionals, options } = parseArguments(commandArgs, [], ["force"]);
        if (positionals.length !== 2) {
          throw new CliUsageError("Usage: zo-drive cp <source> <destination> [--force]");
        }
        let object;
        try {
          object = await requireMethod(dependencies.client, "copy")(positionals[0]!, positionals[1]!, { overwrite: options.force === true });
        } catch (caught) {
          if (caught instanceof DriveApiError && caught.code === "ALREADY_EXISTS" && !options.force) {
            throw new CliUsageError("The destination already exists. Add --force to replace it.");
          }
          throw caught;
        }
        write(`Copied ${positionals[0]} to ${object.key}\n`);
        return 0;
      }
      case "exists": {
        const { positionals } = parseArguments(commandArgs, []);
        if (positionals.length !== 1) {
          throw new CliUsageError("Usage: zo-drive exists <key>");
        }
        const key = positionals[0]!;
        const objects = await requireMethod(dependencies.client, "list")({ prefix: key });
        if (objects.some((object) => object.key === key)) {
          write(`Found ${key}\n`);
          return 0;
        }
        error(`Not found: ${key}\n`);
        return 1;
      }
      case "stat": {
        const { positionals, options } = parseArguments(commandArgs, ["json"]);
        if (positionals.length !== 1) {
          throw new CliUsageError("Usage: zo-drive stat <key> [--json]");
        }
        const key = positionals[0]!;
        const object = (await requireMethod(dependencies.client, "list")({ prefix: key })).find((candidate) => candidate.key === key);
        if (!object) {
          error(`Not found: ${key}\n`);
          return 1;
        }
        write(options.json ? `${JSON.stringify(object)}\n` : formatObjectMetadata(object));
        return 0;
      }
      case "usage": {
        const { options } = parseArguments(commandArgs, ["json"]);
        const usage = await requireMethod(dependencies.client, "getUsage")();
        write(options.json ? `${JSON.stringify(usage)}\n` : formatUsage(usage));
        return 0;
      }
      case "status": {
        const { positionals } = parseArguments(commandArgs, []);
        if (positionals.length > 0) {
          throw new CliUsageError("Usage: zo-drive status");
        }
        const usage = await requireMethod(dependencies.client, "getUsage")();
        write(formatStatus(usage));
        return 0;
      }
      case "health": {
        const { options } = parseArguments(commandArgs, ["json"]);
        const startedAt = performance.now();
        const health = await requireMethod(dependencies.client, "getHealth")();
        const latencyMs = Math.round(performance.now() - startedAt);
        const usage = await requireMethod(dependencies.client, "getUsage")();
        const report = {
          api: health.status,
          latencyMs,
          storage: usage,
          disk: { availableBytes: usage.availableBytes, totalBytes: usage.totalBytes }
        };
        write(options.json ? `${JSON.stringify(report)}\n` : formatHealth(report));
        return 0;
      }
      case "logo": {
        const { positionals } = parseArguments(commandArgs, []);
        if (positionals.length > 0) {
          throw new CliUsageError("Usage: zo-drive logo");
        }
        write(`${ZO_DRIVE_LOGO}\n`);
        return 0;
      }
      case "help":
      case "--help":
      case "-h":
      case undefined:
        write(command === "help" && commandArgs[0] === "ls" ? lsHelpText() : helpText());
        return command ? 0 : 1;
      case "version":
      case "--version":
      case "-v":
        write(`zo-drive ${CLI_VERSION}\n`);
        return 0;
      default:
        throw new CliUsageError(`Unknown command: ${command}\n\n${helpText()}`);
    }
  } catch (caught) {
    error(`${formatCliError(caught)}\n`);
    return 1;
  }
}

class CliUsageError extends Error {}

function formatCliError(caught: unknown): string {
  if (caught instanceof DriveApiError && caught.status === 401) {
    return [
      "Authentication failed: Zo Drive rejected the device API key for this connection.",
      "The key may be revoked, expired, or belong to a different Drive URL.",
      "",
      "Create a new key in Zo Drive > API Keys, then run:",
      "  zo-drive configure"
    ].join("\n");
  }
  if (caught instanceof DriveApiError && caught.status === 429) {
    return "Too many invalid device API key attempts. Wait for the retry period, then run: zo-drive configure";
  }
  return caught instanceof Error ? caught.message : "Unexpected CLI error";
}

type ConfigurationPrompts = {
  askApiKey: () => Promise<string>;
  askUrl: () => Promise<string>;
};

export async function collectConfiguration({ apiKey, apiUrl, prompts }: { apiKey?: string; apiUrl?: string; prompts: ConfigurationPrompts }): Promise<{ apiKey: string; apiUrl: string }> {
  const configuredUrl = normalizeApiUrl(apiUrl?.trim() || await prompts.askUrl());
  const configuredKey = (apiKey?.trim() || await prompts.askApiKey()).trim();

  if (!/^zdk_[A-Za-z0-9_-]+$/.test(configuredKey)) {
    throw new CliUsageError("The API key must be a Zo Drive device key starting with zdk_. Create a new key in Zo Drive > API Keys and try again.");
  }

  return { apiKey: configuredKey, apiUrl: configuredUrl };
}

function normalizeApiUrl(value: string): string {
  const trimmed = value.trim().replace(/\/+$/, "");
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new CliUsageError("Enter a complete Zo Drive URL, for example https://your-drive.example/drive.");
  }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
    throw new CliUsageError("Enter a plain HTTP(S) Zo Drive URL without credentials, query parameters, or a fragment.");
  }
  return trimmed;
}

function terminalPrompts(): ConfigurationPrompts {
  return {
    askUrl: async () => {
      if (!process.stdin.isTTY) throw new CliUsageError("zo-drive configure needs an interactive terminal. For automation, set ZO_DRIVE_API_URL and ZO_DRIVE_API_KEY.");
      const readline = createInterface({ input: process.stdin, output: process.stderr });
      try {
        return await readline.question("Zo Drive URL: ");
      } finally {
        readline.close();
      }
    },
    askApiKey: () => readSecret("Zo Drive API key: ")
  };
}

function readSecret(prompt: string): Promise<string> {
  if (!process.stdin.isTTY) return Promise.reject(new CliUsageError("zo-drive configure needs an interactive terminal. For automation, set ZO_DRIVE_API_URL and ZO_DRIVE_API_KEY."));

  return new Promise((resolve, reject) => {
    let value = "";
    const input = process.stdin;
    const cleanup = () => {
      input.off("data", onData);
      input.setRawMode?.(false);
      input.pause();
    };
    const finish = () => {
      cleanup();
      process.stderr.write("\n");
      resolve(value);
    };
    const cancel = () => {
      cleanup();
      process.stderr.write("\n");
      reject(new CliUsageError("Configuration cancelled."));
    };
    const onData = (chunk: string) => {
      for (const character of chunk) {
        if (character === "\r" || character === "\n") return finish();
        if (character === "\u0003") return cancel();
        if (character === "\u0008" || character === "\u007f") {
          value = value.slice(0, -1);
        } else if (character >= " ") {
          value += character;
        }
      }
    };

    process.stderr.write(prompt);
    input.setEncoding("utf8");
    input.setRawMode?.(true);
    input.resume();
    input.on("data", onData);
  });
}

function parseArguments(args: string[], valueOptions: string[], booleanOptions = ["json"]) {
  const positionals: string[] = [];
  const options: Record<string, string | boolean | undefined> = {};
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index]!;
    if (!argument.startsWith("--")) {
      positionals.push(argument);
      continue;
    }
    const option = argument.slice(2);
    if (!valueOptions.includes(option) && !booleanOptions.includes(option)) {
      throw new CliUsageError(`Unknown option: ${argument}`);
    }
    if (booleanOptions.includes(option)) {
      options[option] = true;
      continue;
    }
    const value = args[index + 1];
    if (!value || value.startsWith("--")) {
      throw new CliUsageError(`Option ${argument} requires a value`);
    }
    options[option] = value;
    index += 1;
  }
  return { positionals, options: options as { force?: boolean; json?: boolean; "dry-run"?: boolean; password?: string; path?: string; output?: string; username?: string } };
}

function isLsShorthand(command: string | undefined): boolean {
  return Boolean(command?.startsWith("-") && !["--help", "-h", "--version", "-v"].includes(command));
}

type LsOptions = {
  all: boolean;
  classify: boolean;
  directoryOnly: boolean;
  help: boolean;
  humanReadable: boolean;
  json: boolean;
  long: boolean;
  onePerLine: boolean;
  recursive: boolean;
  reverse: boolean;
  sort: "name" | "size" | "time";
};

function parseLsArguments(args: string[]): { options: LsOptions; path?: string } {
  const options: LsOptions = { all: false, classify: false, directoryOnly: false, help: false, humanReadable: false, json: false, long: false, onePerLine: false, recursive: false, reverse: false, sort: "name" };
  const positionals: string[] = [];
  let endOfOptions = false;
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index]!;
    if (endOfOptions || !argument.startsWith("-") || argument === "-") {
      positionals.push(argument);
      continue;
    }
    if (argument === "--") {
      endOfOptions = true;
      continue;
    }
    if (argument.startsWith("--")) {
      const [name, inlineValue] = argument.slice(2).split("=", 2);
      if (name === "all" || name === "almost-all") options.all = true;
      else if (name === "classify" || name === "indicator-style" && inlineValue === "slash") options.classify = true;
      else if (name === "directory") options.directoryOnly = true;
      else if (name === "help") options.help = true;
      else if (name === "human-readable") options.humanReadable = true;
      else if (name === "json") options.json = true;
      else if (name === "long") options.long = true;
      else if (name === "one-per-line") options.onePerLine = true;
      else if (name === "recursive") options.recursive = true;
      else if (name === "reverse") options.reverse = true;
      else if (name === "sort") {
        const sort = inlineValue ?? args[++index];
        if (sort !== "name" && sort !== "size" && sort !== "time") throw new CliUsageError("--sort must be name, size, or time");
        options.sort = sort;
      } else throw new CliUsageError(`Unsupported ls option: ${argument}. Run zo-drive ls --help to see supported options.`);
      continue;
    }
    for (const option of argument.slice(1)) {
      if (option === "1") options.onePerLine = true;
      else if (option === "C") undefined;
      else if (option === "h") options.humanReadable = true;
      else if (option === "A" || option === "a") options.all = true;
      else if (option === "d") options.directoryOnly = true;
      else if (option === "F" || option === "p") options.classify = true;
      else if (option === "l") options.long = true;
      else if (option === "R") options.recursive = true;
      else if (option === "r") options.reverse = true;
      else if (option === "S") options.sort = "size";
      else if (option === "t") options.sort = "time";
      else throw new CliUsageError(`Unsupported ls option: -${option}. Run zo-drive ls --help to see supported options.`);
    }
  }
  if (positionals.length > 1) throw new CliUsageError("Usage: zo-drive ls [path] [options]");
  return { options, path: positionals[0] };
}

function requireMethod<T extends keyof CliClient>(client: CliClient, method: T): NonNullable<CliClient[T]> {
  const implementation = client[method];
  if (!implementation) {
    throw new Error(`CLI client does not implement ${method}`);
  }
  return implementation.bind(client) as NonNullable<CliClient[T]>;
}

type LsEntry = ReturnType<typeof fileEntry> | ReturnType<typeof folderEntry>;

function fileEntry(object: DriveObject) {
  return { kind: "file" as const, key: object.key, name: object.name, size: object.size, updatedAt: object.updatedAt };
}

function folderEntry(folder: DriveFolder) {
  return { kind: "folder" as const, key: folder.key, name: folder.name, size: 0, updatedAt: folder.updatedAt };
}

function isDriveFolder(entry: DriveFolder | ReturnType<typeof fileEntry>): entry is DriveFolder {
  return !("kind" in entry);
}

function directFileEntries(objects: DriveObject[], path?: string): LsEntry[] {
  const prefix = path?.replace(/\/+$/, "") ?? "";
  return objects
    .filter((object) => isDirectChild(object.key, prefix))
    .map(fileEntry);
}

function isDirectChild(key: string, prefix: string): boolean {
  if (!prefix) return !key.includes("/");
  if (key === prefix) return true;
  if (!key.startsWith(`${prefix}/`)) return false;
  return !key.slice(prefix.length + 1).includes("/");
}

async function recursiveLsListings({ folders, objects, path }: { folders: (prefix?: string) => Promise<DriveFolder[]>; objects: DriveObject[]; path?: string }): Promise<Array<{ entries: LsEntry[]; path: string }>> {
  const root = path?.replace(/\/+$/, "") ?? "";
  const listings: Array<{ entries: LsEntry[]; path: string }> = [];
  const pending = [root];
  while (pending.length > 0) {
    const current = pending.shift()!;
    const childFolders = await folders(current || undefined);
    listings.push({ entries: [...directFileEntries(objects, current), ...childFolders.map(folderEntry)], path: current });
    pending.push(...childFolders.map((folder) => folder.key));
  }
  return listings;
}

function formatRecursiveLsListings(listings: Array<{ entries: LsEntry[]; path: string }>, options: LsOptions, terminalColumns: number | undefined): string {
  if (listings.length === 0) return "No files found.\n";
  return listings.map((listing) => `${listing.path || "."}:\n${formatLsEntries(listing.entries, options, terminalColumns).trimEnd()}`).join("\n\n").concat("\n");
}

function formatLsEntries(entries: LsEntry[], options: LsOptions, terminalColumns: number | undefined): string {
  const visible = entries.filter((entry) => options.all || !entry.name.startsWith("."));
  if (visible.length === 0) return "No files found.\n";
  const sorted = visible.sort((left, right) => compareLsEntries(left, right, options));
  if (!options.long && !options.onePerLine && terminalColumns && terminalColumns > 0) {
    return formatLsColumns(sorted.map((entry) => formatLsEntry(entry, options)), terminalColumns);
  }
  return `${sorted.map((entry) => formatLsEntry(entry, options)).join("\n")}\n`;
}

function formatLsColumns(names: string[], terminalColumns: number): string {
  const cellWidth = Math.max(...names.map((name) => name.length)) + 2;
  const columns = Math.max(1, Math.floor(terminalColumns / cellWidth));
  const rows: string[] = [];
  for (let index = 0; index < names.length; index += columns) {
    rows.push(names.slice(index, index + columns).map((name, offset, row) => offset === row.length - 1 ? name : name.padEnd(cellWidth)).join(""));
  }
  return `${rows.join("\n")}\n`;
}

function compareLsEntries(left: LsEntry, right: LsEntry, options: LsOptions): number {
  const comparison = options.sort === "size"
    ? right.size - left.size || left.name.localeCompare(right.name)
    : options.sort === "time"
      ? right.updatedAt.localeCompare(left.updatedAt) || left.name.localeCompare(right.name)
      : left.name.localeCompare(right.name);
  return options.reverse ? -comparison : comparison;
}

function formatLsEntry(entry: LsEntry, options: LsOptions): string {
  const name = `${entry.key}${options.classify && entry.kind === "folder" ? "/" : ""}`;
  if (!options.long) return name;
  return `${entry.kind === "folder" ? "DIR " : "FILE"}  ${entry.kind === "folder" ? "-".padStart(9) : formatBytes(entry.size).padStart(9)}  ${entry.updatedAt}  ${name}`;
}

function parentDriveKey(key: string): string | undefined {
  const index = key.lastIndexOf("/");
  return index === -1 ? undefined : key.slice(0, index);
}

function joinDriveKey(path: string | undefined, fileName: string): string {
  return path ? `${path.replace(/\/+$/, "")}/${fileName}` : fileName;
}

function formatUsage(usage: StorageUsage): string {
  return `${usage.fileCount} file${usage.fileCount === 1 ? "" : "s"}, ${formatBytes(usage.usedBytes)} used\n`;
}

function formatStatus(usage: StorageUsage): string {
  const usagePercent = Math.min(100, Math.round((usage.usedBytes / usage.quotaBytes) * 100));
  return `Zo Drive\n--------\nStatus: connected\nStorage: ${usage.fileCount} file${usage.fileCount === 1 ? "" : "s"}, ${formatBytes(usage.usedBytes)} / ${formatBytes(usage.quotaBytes)} (${usagePercent}%)\n`;
}

function formatHealth({ api, latencyMs, storage, disk }: { api: "ok"; latencyMs: number; storage: StorageUsage; disk: { availableBytes: number; totalBytes: number } }): string {
  const usagePercent = Math.min(100, Math.round((storage.usedBytes / storage.quotaBytes) * 100));
  return `Zo Drive health\n---------------\nAPI: ${api} (${formatLatency(latencyMs)})\nAuthentication: ok\nStorage: ${storage.fileCount} file${storage.fileCount === 1 ? "" : "s"}, ${formatBytes(storage.usedBytes)} / ${formatBytes(storage.quotaBytes)} (${usagePercent}%)\nDisk: ${formatCapacity(disk.availableBytes)} available of ${formatCapacity(disk.totalBytes)}\n`;
}

function formatObjectMetadata(object: DriveObject): string {
  return [
    `Key: ${object.key}`,
    `Name: ${object.name}`,
    `Size: ${formatBytes(object.size)}`,
    `Content type: ${object.contentType}`,
    `Updated: ${object.updatedAt}`,
    `Starred: ${object.starred ? "yes" : "no"}`,
    ...(object.nativeType ? [`Native type: ${object.nativeType}`] : [])
  ].join("\n").concat("\n");
}

function formatBytes(bytes: number): string {
  if (bytes < 1_024) {
    return `${bytes} B`;
  }
  return formatCapacity(bytes);
}

function createUploadProgress(write: (message: string) => void): { finish: () => void; update: (progress: { loaded: number; total: number }) => void } {
  let rendered = false;
  let previousPercent = -1;
  return {
    update: ({ loaded, total }) => {
      const percent = total === 0 ? 100 : Math.min(100, Math.round((loaded / total) * 100));
      if (percent === previousPercent) return;
      previousPercent = percent;
      const completed = Math.round((percent / 100) * 20);
      write(`\rUploading [${"#".repeat(completed)}${"-".repeat(20 - completed)}] ${percent}% (${formatBytes(loaded)} / ${formatBytes(total)})`);
      rendered = true;
    },
    finish: () => {
      if (rendered) write("\n");
    }
  };
}

export function formatLatency(milliseconds: number): string {
  return milliseconds < 1_000 ? `${milliseconds} ms` : `${(milliseconds / 1_000).toFixed(1)} s`;
}

function formatCapacity(bytes: number): string {
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1_024 && unitIndex < units.length - 1) {
    value /= 1_024;
    unitIndex += 1;
  }
  return `${value.toFixed(1)} ${units[unitIndex]}`;
}

function helpText(): string {
  return [
    ZO_DRIVE_LOGO,
    "",
    "Usage: zo-drive <command>",
    "",
    "Commands:",
    "  help, --help, -h",
    "  configure (asks for and securely saves this machine's Drive URL and API key)",
    "  upload <file> [--path <folder>] [--dry-run]",
    "  mkdir <path>",
    "  ls [path] [options]",
    "  download <key> [--output <file>] [--dry-run]",
    "  delete <key>",
    "  rm <key> (moves a file to Trash)",
    "  mv <source> <destination>",
    "  cp <source> <destination> [--force]",
    "  exists <key>",
    "  stat <key> [--json]",
    "  usage [--json]",
    "  status",
    "  health [--json]",
    "  logo",
    "  version, --version, -v",
    "",
    "Tip: zo-drive -lrt is shorthand for zo-drive ls -lrt.",
    "Run zo-drive ls --help to see all ls options."
  ].join("\n").concat("\n");
}

function lsHelpText(): string {
  return [
    "Usage: zo-drive ls [path] [options]",
    "",
    "Options:",
    "  -l, --long                 show file type, size, time, and name",
    "  -a, -A, --all              include names beginning with a dot",
    "  -h, --human-readable       use readable sizes (the default)",
    "  -R, --recursive            list every nested folder",
    "  -r, --reverse              reverse the order",
    "  -S, --sort=size            sort by size (largest first)",
    "  -t, --sort=time            sort by modified time (newest first)",
    "  -F, -p, --classify         add / after folder names",
    "  -d, --directory            show the supplied item itself",
    "  -1, --one-per-line         show one entry per line",
    "  --json                     output the original raw file JSON"
  ].join("\n").concat("\n");
}

async function main() {
  const args = process.argv.slice(2);
  if (["help", "--help", "-h", "version", "--version", "-v", "logo"].includes(args[0] ?? "")) {
    process.exitCode = await runCli(args, { client: {} });
    return;
  }
  if (args[0] === "configure") {
    try {
      process.stdout.write(`${CONFIGURATION_GUIDE}\n\n`);
      const config = await collectConfiguration({ apiKey: process.env.ZO_DRIVE_API_KEY, apiUrl: process.env.ZO_DRIVE_API_URL, prompts: terminalPrompts() });
      await writeLocalConfig(config);
      process.stdout.write(`${CONFIGURATION_VERIFICATION_GUIDE}\n`);
    } catch (caught) {
      process.stderr.write(`${caught instanceof Error ? caught.message : "Could not configure Zo Drive."}\n`);
      process.exitCode = 1;
    }
    return;
  }
  const storedConfig = await readLocalConfig();
  const baseUrl = process.env.ZO_DRIVE_API_URL ?? storedConfig?.apiUrl;
  if (!baseUrl) {
    process.stderr.write("Zo Drive is not configured. Run zo-drive configure to save this machine's Drive URL and API key.\n");
    process.exitCode = 1;
    return;
  }
  const apiKey = process.env.ZO_DRIVE_API_KEY ?? storedConfig?.apiKey;
  if (!apiKey) {
    process.stderr.write("Zo Drive is not configured. Create a scoped key in Zo Drive > API Keys, then run zo-drive configure.\n");
    process.exitCode = 1;
    return;
  }
  const client = new ZoDriveClient({ baseUrl, headers: { authorization: `Bearer ${apiKey}` } });
  process.exitCode = await runCli(args, { client });
}

export function isMainModule(entryPath: string | undefined, moduleUrl: string): boolean {
  if (!entryPath) return false;

  try {
    return realpathSync(entryPath) === realpathSync(fileURLToPath(moduleUrl));
  } catch {
    return false;
  }
}

if (isMainModule(process.argv[1], import.meta.url)) {
  void main();
}
