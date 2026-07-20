#!/usr/bin/env node

import { basename } from "node:path";
import { pathToFileURL } from "node:url";
import { readFile as readFileFromDisk, writeFile as writeFileToDisk } from "node:fs/promises";

import { ZoDriveClient } from "@zo-drive/sdk";
import type { DriveObject, StorageUsage } from "@zo-drive/types";

import { readLocalConfig, writeLocalConfig } from "./config.js";

const CLI_VERSION = "1.0.0";

type CliClient = Partial<Pick<ZoDriveClient, "createFolder" | "delete" | "download" | "getUsage" | "list" | "upload">>;

type CliDependencies = {
  client: CliClient;
  write?: (message: string) => void;
  error?: (message: string) => void;
  readFile?: typeof readFileFromDisk;
  writeFile?: typeof writeFileToDisk;
};

export async function runCli(args: string[], dependencies: CliDependencies): Promise<number> {
  const write = dependencies.write ?? ((message) => process.stdout.write(message));
  const error = dependencies.error ?? ((message) => process.stderr.write(message));
  const readFile = dependencies.readFile ?? readFileFromDisk;
  const writeFile = dependencies.writeFile ?? writeFileToDisk;
  const [command, ...commandArgs] = args;

  try {
    switch (command) {
      case "ls": {
        const { positionals, options } = parseArguments(commandArgs, ["json"]);
        if (positionals.length > 1) {
          throw new CliUsageError("Usage: zo-drive ls [path] [--json]");
        }
        const objects = await requireMethod(dependencies.client, "list")({ prefix: positionals[0] });
        write(options.json ? `${JSON.stringify(objects)}\n` : formatObjects(objects));
        return 0;
      }
      case "upload": {
        const { positionals, options } = parseArguments(commandArgs, ["path"]);
        if (positionals.length !== 1) {
          throw new CliUsageError("Usage: zo-drive upload <file> [--path <folder>]");
        }
        const localPath = positionals[0]!;
        const contents = await readFile(localPath);
        const object = await requireMethod(dependencies.client, "upload")({
          file: new Blob([contents]),
          fileName: basename(localPath),
          path: options.path
        });
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
        const { positionals, options } = parseArguments(commandArgs, ["output"]);
        if (positionals.length !== 1) {
          throw new CliUsageError("Usage: zo-drive download <key> [--output <file>]");
        }
        const key = positionals[0]!;
        const response = await requireMethod(dependencies.client, "download")(key);
        const target = options.output ?? basename(key);
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
      case "usage": {
        const { options } = parseArguments(commandArgs, ["json"]);
        const usage = await requireMethod(dependencies.client, "getUsage")();
        write(options.json ? `${JSON.stringify(usage)}\n` : formatUsage(usage));
        return 0;
      }
      case "help":
      case "--help":
      case "-h":
      case undefined:
        write(helpText());
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
    const message = caught instanceof Error ? caught.message : "Unexpected CLI error";
    error(`${message}\n`);
    return 1;
  }
}

class CliUsageError extends Error {}

function parseArguments(args: string[], valueOptions: string[]) {
  const positionals: string[] = [];
  const options: Record<string, string | boolean | undefined> = {};
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index]!;
    if (!argument.startsWith("--")) {
      positionals.push(argument);
      continue;
    }
    const option = argument.slice(2);
    if (!valueOptions.includes(option)) {
      throw new CliUsageError(`Unknown option: ${argument}`);
    }
    if (option === "json") {
      options.json = true;
      continue;
    }
    const value = args[index + 1];
    if (!value || value.startsWith("--")) {
      throw new CliUsageError(`Option ${argument} requires a value`);
    }
    options[option] = value;
    index += 1;
  }
  return { positionals, options: options as { json?: boolean; password?: string; path?: string; output?: string; username?: string } };
}

function requireMethod<T extends keyof CliClient>(client: CliClient, method: T): NonNullable<CliClient[T]> {
  const implementation = client[method];
  if (!implementation) {
    throw new Error(`CLI client does not implement ${method}`);
  }
  return implementation.bind(client) as NonNullable<CliClient[T]>;
}

function formatObjects(objects: DriveObject[]): string {
  if (objects.length === 0) {
    return "No files found.\n";
  }
  return `${objects.map((object) => `${object.key}\t${formatBytes(object.size)}\t${object.updatedAt}`).join("\n")}\n`;
}

function formatUsage(usage: StorageUsage): string {
  return `${usage.fileCount} file${usage.fileCount === 1 ? "" : "s"}, ${formatBytes(usage.usedBytes)} used\n`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1_024) {
    return `${bytes} B`;
  }
  return `${(bytes / 1_024).toFixed(1)} KB`;
}

function helpText(): string {
  return [
    "Usage: zo-drive <command>",
    "",
    "Commands:",
    "  configure (saves ZO_DRIVE_API_URL and ZO_DRIVE_API_KEY for this machine)",
    "  upload <file> [--path <folder>]",
    "  mkdir <path>",
    "  ls [path] [--json]",
    "  download <key> [--output <file>]",
    "  delete <key>",
    "  usage [--json]",
    "  version"
  ].join("\n").concat("\n");
}

async function main() {
  const args = process.argv.slice(2);
  if (["help", "--help", "-h", "version", "--version", "-v"].includes(args[0] ?? "")) {
    process.exitCode = await runCli(args, { client: {} });
    return;
  }
  if (args[0] === "configure") {
    const apiUrl = process.env.ZO_DRIVE_API_URL;
    const apiKey = process.env.ZO_DRIVE_API_KEY;
    if (!apiUrl || !apiKey) {
      process.stderr.write("Set ZO_DRIVE_API_URL and ZO_DRIVE_API_KEY before running zo-drive configure.\n");
      process.exitCode = 1;
      return;
    }
    await writeLocalConfig({ apiKey, apiUrl });
    process.stdout.write("Zo Drive is configured for this machine.\n");
    return;
  }
  const storedConfig = await readLocalConfig();
  const baseUrl = process.env.ZO_DRIVE_API_URL ?? storedConfig?.apiUrl;
  if (!baseUrl) {
    process.stderr.write("Zo Drive is not configured. Set ZO_DRIVE_API_URL and ZO_DRIVE_API_KEY, then run zo-drive configure.\n");
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

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main();
}
