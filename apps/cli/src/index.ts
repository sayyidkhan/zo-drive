#!/usr/bin/env node

import { realpathSync } from "node:fs";
import { basename } from "node:path";
import { fileURLToPath } from "node:url";
import { readFile as readFileFromDisk, stat as statFileFromDisk, writeFile as writeFileToDisk } from "node:fs/promises";
import { createInterface } from "node:readline/promises";

import { DriveApiError, ZoDriveClient } from "@zo-drive/sdk";
import type { DatabaseEngineId, DriveFolder, DriveObject, FunctionRuntime, FunctionVisibility, StorageUsage } from "@zo-drive/types";

import { readLocalConfig, writeLocalConfig } from "./config.js";

const CLI_VERSION = "1.3.0";
const PROGRESS_BAR_MIN_BYTES = 1_024 ** 2;

export const ZO_DRIVE_LOGO = [
  " ______       ____       _",
  "|__  /___    |  _ \\ _ __(*)*   _____",
  "  / // _ \\   | | | | '__| \\ \\ / / _ \\",
  " / /| (*) |  | |*| | |  | |\\ V /  __/",
  "/____\\___/   |____/|*|  |*| \\_/ \\___|"
].join("\n");

export const ZO_DRIVE_COMPACT_PEGASUS_CLOUD_LOGO = [
  "                 __/\\__",
  "        /\\      /  -  \\      /\\",
  "       /  \\____/ /\\   \\____/  \\",
  "      /      _/ /  \\_       \\  \\",
  " ____/      /  _    \\_       \\__\\",
  "/___/\\_____/  / \\     \\_____/___\\",
  "        \\      (o o)      /",
  "         \\_____/\\_____ _/",
  "   ~~~~~~~~~~~~\\___/~~~~~~~~~~~~",
  " .~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~.",
  "(                                  )",
  " '._                            _.'",
  "",
  ZO_DRIVE_LOGO
].join("\n");

export const ZO_DRIVE_PEGASUS_CLOUD_LOGO = String.raw`
                                 @@                    @@
                            @@@@@@@@@@@@            @@@@@@@@@@@@@@@@@@@@@@@@@@
                            @@@@@@@@@@@@@@      @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
                           @@@@@@@@@@@@@@@@@   @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
                           @@@@@@@@@@@@@@@@@@  @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
                          @@@@@@@@@@@@@@@@@@@@ @@@@@@@@@@@@@@@@@@@@@@@@@@@@@
                          @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
                          @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
                         @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
                         @@@@@@@  @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
                          @@@@@    @@@@@@@@@@@@@@@@@@@@@@@@@@@
                                   @@@@@@@@@@@@@@@@@@@@@@@@@@
                          @@@@@   @@@@@@@@@@@@@@@@@@@@@@@@@@
                          @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
                         @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
                         @@@@ @@@@@@@@@@@@@@@@@@@@@@@@@@
                        @@@@@ @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
                       @@@@@ @@@@@ @@@@@@@@@@@@@@@@@@@@@@@@@@@@   @@
                       @@@@@@@@@@    @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
                       @@@@@@@@@@    @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
                        @@@ @@@@@       @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
                            @@@@@@        @@@@@@@@@@@@@@@@@@@@@@@@ @@@@@@@
                            @@@@@@         @@@@@@@@@@@@@@@@@@@@@@@ @@@@@@@
                             @@@          @@@@@@@@@@@@@@@@@@@@@@@  @@@@@@
                                         @@@@@@@@@@@@@@@@@@@@@@@   @@@@@@
                                        @@@@@@@@@@@@@@@@@@@@@@@    @@@@@@
                                        @@@@@@@@@@@@@@@@@@@       @@@@@@@
                                         @@@@@@@@@@@@@@@@@@       @@@@@@
                                           @@@@@@@#+*@@@@@#--=*%  @@@@@@
                                    ###++=++#@@@@@=:::=%@@@%::::-*@@@@@@@
                                 *+-:::::::=%@@%+:::::+%@@%+::::::-*@@@@@@
                               %=::::::::+%@@@*:::::*@@@@+::::::::::-%@@@@@
                              +::::::::-@@@@%-::::*@@@@#:::::::::::::=#  %
                         %*++*:::::::-*@@@@*::::=%@@@%=:::::::::::-==-::::-=+#
                      %*-:::=-::::::#@@@@#+:::=%@@@@*:::::::::::+-::::::::::::=%
                     %=:::::+::::::=##*##*-::#@@@@@=::::::::::--::::::::::::::::+
                    #:::::::=::::::::::::--:::::::::::::::::::=:::::::::::::::::-*
                   %-:::::::+:::::::::::::=::::::::::::::::::=:::::::::::::::::::=@
                   *-:::::::=-::::::::::::=::::::::::::::::::=:::::::::::::::::::-@
                 %*+-::::::::=:::::::::::::=:::::::::::::::::=:::::::::::::::::::=*%
               %+:::=:::::::::=:::::::::::::=::::::::::::::::-=::::::::::::::::::=:-+
               #=:::--:::::::::=-::::::::::::=-:::::::::::::::=-::::::::::::::::-:::=
                @*-:::--:::-------:::::::::::::=:::::::::::::::-::::------::::--::-*%
                   #*+====-:::::-=-::========-::::-==-::::::-==:::==:::::::-=+++*%
                          @##+=::::::::::::::::::::::::::::::::::::::-+#%@@
                                   %@@%####*+++++++++++++**###%@@@

${ZO_DRIVE_LOGO}`.slice(1).trimEnd().replace(/^ {15}/gm, "");

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

type CliClient = Partial<Pick<ZoDriveClient,
  "copy" | "createClusterFolder" | "createClusterInvitation" | "createClusterMount" | "createDatabase" | "createDatabaseApiKey" | "createFolder" | "createFunction" | "createNativeFile" | "createShare" | "delete" | "deleteClusterInvitation" | "deleteClusterMount" | "deleteClusterObject" | "deleteClusterPeer" | "deleteDatabase" | "deleteFunction" | "download" | "downloadClusterObject" | "executeDatabase" | "exportDatabase" | "getDatabaseImportSettings" | "getHealth" | "getUsage" | "importDatabase" | "installDatabaseEngine" | "list" | "listClusterInvitations" | "listClusterMounts" | "listClusterObjects" | "listClusterPeers" | "listDatabaseApiKeys" | "listDatabaseEngines" | "listDatabaseRows" | "listDatabaseTables" | "listDatabases" | "listFolders" | "listFunctionRuns" | "listFunctions" | "listShares" | "move" | "queryDatabase" | "renameClusterObject" | "revokeDatabaseApiKey" | "revokeShare" | "runFunction" | "saveNativeFile" | "setDatabaseImportLimit" | "updateClusterPeerRole" | "updateDatabaseEngine" | "updateFunction" | "updateSharePasscode" | "upload" | "uploadClusterObject">>;

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
      case "paste":
        return await runPasteCommand(commandArgs, { client: dependencies.client, error, readFile, write });
      case "transfer":
        return await runTransferCommand(commandArgs, { client: dependencies.client, readFile, write });
      case "shared":
        return await runSharedCommand(commandArgs, { client: dependencies.client, readFile, write, writeFile });
      case "database":
      case "db":
        return await runDatabaseCommand(commandArgs, { client: dependencies.client, readFile, write, writeFile });
      case "function":
      case "fn":
        return await runFunctionCommand(commandArgs, { client: dependencies.client, readFile, write });
      case "logo": {
        const { positionals } = parseArguments(commandArgs, []);
        if (positionals.length > 0) {
          throw new CliUsageError("Usage: zo-drive logo");
        }
        write(`${ZO_DRIVE_PEGASUS_CLOUD_LOGO}\n`);
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

type OriginalCommandDependencies = Pick<CliDependencies, "client" | "readFile" | "writeFile"> & { write: (message: string) => void; error?: (message: string) => void };

async function runPasteCommand(args: string[], dependencies: OriginalCommandDependencies): Promise<number> {
  const [action, ...rest] = args;
  const readFile = dependencies.readFile ?? readFileFromDisk;
  const write = dependencies.write;
  if (action === "list") {
    const { options } = parseArguments(rest, [], ["json"]);
    const pastes = (await requireMethod(dependencies.client, "list")()).filter((item) => item.nativeType === "paste");
    write(options.json ? `${JSON.stringify(pastes)}\n` : formatRecords(pastes, ["key", "name", "updatedAt"]));
    return 0;
  }
  if (action === "create" || action === "update") {
    const { positionals, options } = parseArguments(rest, ["path", "text", "file", "language", "tags"]);
    if ((action === "create" && positionals.length !== 1) || (action === "update" && positionals.length !== 1)) throw new CliUsageError(`Usage: zo-drive paste ${action} <${action === "create" ? "name" : "key"}> [--text <text> | --file <file>] [--language <language>] [--tags <a,b>]${action === "create" ? " [--path <folder>]" : ""}`);
    const key = positionals[0]!;
    let current = { language: "plaintext", tags: [] as string[], text: "" };
    if (action === "update") current = await readPaste(dependencies.client, key);
    const text = typeof options.text === "string" ? options.text : typeof options.file === "string" ? await readFile(options.file, "utf8") : current.text;
    if (action === "create" && typeof options.text !== "string" && typeof options.file !== "string") throw new CliUsageError("Provide paste content with --text or --file.");
    const content = pasteContent({ language: typeof options.language === "string" ? options.language : current.language, tags: typeof options.tags === "string" ? splitCsv(options.tags) : current.tags, text });
    if (action === "create") {
      const created = await requireMethod(dependencies.client, "createNativeFile")({ name: key, path: typeof options.path === "string" ? options.path : undefined, type: "paste" });
      await requireMethod(dependencies.client, "saveNativeFile")(created.key, content);
      write(`Created paste ${created.key}\n`);
    } else {
      await requireMethod(dependencies.client, "saveNativeFile")(key, content);
      write(`Updated paste ${key}\n`);
    }
    return 0;
  }
  if (action === "show") {
    const { positionals, options } = parseArguments(rest, [], ["json"]);
    if (positionals.length !== 1) throw new CliUsageError("Usage: zo-drive paste show <key> [--json]");
    const paste = await readPaste(dependencies.client, positionals[0]!);
    write(options.json ? `${JSON.stringify(paste)}\n` : `${paste.text}${paste.text.endsWith("\n") ? "" : "\n"}`);
    return 0;
  }
  if (action === "share") {
    const { positionals, options } = parseArguments(rest, ["access", "passcode", "expires"], ["editable", "json"]);
    if (positionals.length !== 1) throw new CliUsageError("Usage: zo-drive paste share <key> --access <public|passcode> [--passcode <code>] [--editable] [--expires <ISO date|1d|7d|30d|never>]");
    const access = shareAccess(options.access);
    const share = await requireMethod(dependencies.client, "createShare")({ key: positionals[0]!, access, editable: options.editable === true, passcode: typeof options.passcode === "string" ? options.passcode : undefined, expiresAt: parseExpiry(options.expires) });
    write(options.json ? `${JSON.stringify(share)}\n` : `Created paste link ${share.id}\n`);
    return 0;
  }
  if (action === "delete") {
    const { positionals } = parseArguments(rest, []);
    if (positionals.length !== 1) throw new CliUsageError("Usage: zo-drive paste delete <key>");
    await requireMethod(dependencies.client, "delete")(positionals[0]!);
    write(`Moved paste ${positionals[0]} to Trash\n`);
    return 0;
  }
  throw new CliUsageError(pasteHelpText());
}

async function runTransferCommand(args: string[], dependencies: OriginalCommandDependencies): Promise<number> {
  const [action, ...rest] = args;
  const readFile = dependencies.readFile ?? readFileFromDisk;
  const write = dependencies.write;
  if (action === "list") {
    const { options } = parseArguments(rest, [], ["json"]);
    const transfers = (await requireMethod(dependencies.client, "listShares")()).filter((item) => item.kind === "transfer");
    write(options.json ? `${JSON.stringify(transfers)}\n` : formatRecords(transfers, ["id", "name", "access", "expiresAt"]));
    return 0;
  }
  if (action === "create" || action === "upload") {
    const { positionals, options } = parseArguments(rest, ["access", "passcode", "expires", "path"], ["json"]);
    if (positionals.length !== 1) throw new CliUsageError(`Usage: zo-drive transfer ${action} <${action === "create" ? "key" : "file"}> --access <public|passcode> [--passcode <code>] [--expires <ISO date|1d|7d|30d|never>]${action === "upload" ? " [--path <folder>]" : ""}`);
    const key = action === "upload"
      ? (await requireMethod(dependencies.client, "upload")({ file: new Blob([await readFile(positionals[0]!)]), fileName: basename(positionals[0]!), path: typeof options.path === "string" ? options.path : undefined })).key
      : positionals[0]!;
    const share = await createTransfer(dependencies.client, key, options);
    write(options.json ? `${JSON.stringify(share)}\n` : `Created transfer ${share.id} for ${key}\n`);
    return 0;
  }
  if (action === "revoke") {
    const { positionals } = parseArguments(rest, []);
    if (positionals.length !== 1) throw new CliUsageError("Usage: zo-drive transfer revoke <id>");
    await requireMethod(dependencies.client, "revokeShare")(positionals[0]!);
    write(`Revoked transfer ${positionals[0]}\n`);
    return 0;
  }
  if (action === "passcode") {
    const { positionals, options } = parseArguments(rest, ["value"]);
    if (positionals.length !== 1 || typeof options.value !== "string") throw new CliUsageError("Usage: zo-drive transfer passcode <id> --value <new-passcode>");
    await requireMethod(dependencies.client, "updateSharePasscode")({ id: positionals[0]!, passcode: options.value });
    write(`Updated transfer passcode ${positionals[0]}\n`);
    return 0;
  }
  throw new CliUsageError(transferHelpText());
}

async function runSharedCommand(args: string[], dependencies: OriginalCommandDependencies): Promise<number> {
  const [area, action, ...rest] = args;
  const readFile = dependencies.readFile ?? readFileFromDisk;
  const writeFile = dependencies.writeFile ?? writeFileToDisk;
  const write = dependencies.write;
  if (area === "invite") {
    if (action === "list") { const { options } = parseArguments(rest, [], ["json"]); const items = await requireMethod(dependencies.client, "listClusterInvitations")(); write(options.json ? `${JSON.stringify(items)}\n` : formatRecords(items, ["id", "folder", "role", "recipient", "expiresAt"])); return 0; }
    if (action === "create") { const { positionals, options } = parseArguments(rest, ["role", "recipient"], ["json"]); if (positionals.length !== 1) throw new CliUsageError("Usage: zo-drive shared invite create <folder> [--role <viewer|editor>] [--recipient <name>]"); const item = await requireMethod(dependencies.client, "createClusterInvitation")({ folder: positionals[0]!, role: clusterRole(options.role), recipient: typeof options.recipient === "string" ? options.recipient : null }); write(options.json ? `${JSON.stringify(item)}\n` : `Created invitation ${item.id}\nToken: ${item.token}\n`); return 0; }
    if (action === "revoke") { const { positionals } = parseArguments(rest, []); if (positionals.length !== 1) throw new CliUsageError("Usage: zo-drive shared invite revoke <id>"); await requireMethod(dependencies.client, "deleteClusterInvitation")(positionals[0]!); write(`Revoked invitation ${positionals[0]}\n`); return 0; }
  }
  if (area === "mount") {
    if (action === "list") { const { options } = parseArguments(rest, [], ["json"]); const items = await requireMethod(dependencies.client, "listClusterMounts")(); write(options.json ? `${JSON.stringify(items)}\n` : formatRecords(items, ["id", "folder", "role", "remoteUrl", "author"])); return 0; }
    if (action === "add") { const { positionals, options } = parseArguments(rest, ["url", "token"], ["json"]); if (positionals.length !== 0 || typeof options.url !== "string" || typeof options.token !== "string") throw new CliUsageError("Usage: zo-drive shared mount add --url <remote-drive-url> --token <invitation-token>"); const mount = await requireMethod(dependencies.client, "createClusterMount")({ remoteUrl: options.url, inviteToken: options.token }); write(options.json ? `${JSON.stringify(mount)}\n` : `Mounted ${mount.folder} as ${mount.id}\n`); return 0; }
    if (action === "remove") { const { positionals } = parseArguments(rest, []); if (positionals.length !== 1) throw new CliUsageError("Usage: zo-drive shared mount remove <id>"); await requireMethod(dependencies.client, "deleteClusterMount")(positionals[0]!); write(`Removed shared mount ${positionals[0]}\n`); return 0; }
  }
  if (area === "peer") {
    if (action === "list") { const { options } = parseArguments(rest, [], ["json"]); const items = await requireMethod(dependencies.client, "listClusterPeers")(); write(options.json ? `${JSON.stringify(items)}\n` : formatRecords(items, ["id", "folder", "role", "recipient"])); return 0; }
    if (action === "role") { const { positionals, options } = parseArguments(rest, ["value"]); if (positionals.length !== 1) throw new CliUsageError("Usage: zo-drive shared peer role <id> --value <viewer|editor>"); const peer = await requireMethod(dependencies.client, "updateClusterPeerRole")({ id: positionals[0]!, role: clusterRole(options.value) }); write(`Updated peer ${peer.id} to ${peer.role}\n`); return 0; }
    if (action === "remove") { const { positionals } = parseArguments(rest, []); if (positionals.length !== 1) throw new CliUsageError("Usage: zo-drive shared peer remove <id>"); await requireMethod(dependencies.client, "deleteClusterPeer")(positionals[0]!); write(`Removed shared peer ${positionals[0]}\n`); return 0; }
  }
  if (area === "file") {
    if (action === "list") { const { positionals, options } = parseArguments(rest, [], ["json"]); if (positionals.length !== 1) throw new CliUsageError("Usage: zo-drive shared file list <mount-id> [--json]"); const items = await requireMethod(dependencies.client, "listClusterObjects")(positionals[0]!); write(options.json ? `${JSON.stringify(items)}\n` : formatRecords(items, ["key", "size", "updatedAt"])); return 0; }
    if (action === "mkdir") { const { positionals } = parseArguments(rest, []); if (positionals.length !== 2) throw new CliUsageError("Usage: zo-drive shared file mkdir <mount-id> <path>"); const folder = await requireMethod(dependencies.client, "createClusterFolder")({ id: positionals[0]!, path: positionals[1]! }); write(`Created shared folder ${folder.key}\n`); return 0; }
    if (action === "upload") { const { positionals, options } = parseArguments(rest, ["path"]); if (positionals.length !== 2) throw new CliUsageError("Usage: zo-drive shared file upload <mount-id> <file> [--path <folder>]"); const object = await requireMethod(dependencies.client, "uploadClusterObject")({ id: positionals[0]!, file: new Blob([await readFile(positionals[1]!)]), fileName: basename(positionals[1]!), path: typeof options.path === "string" ? options.path : undefined }); write(`Uploaded shared file ${object.key}\n`); return 0; }
    if (action === "download") { const { positionals, options } = parseArguments(rest, ["output"]); if (positionals.length !== 2) throw new CliUsageError("Usage: zo-drive shared file download <mount-id> <key> [--output <file>]"); const target = typeof options.output === "string" ? options.output : basename(positionals[1]!); const response = await requireMethod(dependencies.client, "downloadClusterObject")({ id: positionals[0]!, key: positionals[1]! }); await writeFile(target, Buffer.from(await response.arrayBuffer())); write(`Downloaded shared file ${positionals[1]} to ${target}\n`); return 0; }
    if (action === "rename") { const { positionals, options } = parseArguments(rest, ["name"]); if (positionals.length !== 2 || typeof options.name !== "string") throw new CliUsageError("Usage: zo-drive shared file rename <mount-id> <key> --name <name>"); const object = await requireMethod(dependencies.client, "renameClusterObject")({ id: positionals[0]!, key: positionals[1]!, name: options.name }); write(`Renamed shared file to ${object.key}\n`); return 0; }
    if (action === "delete") { const { positionals } = parseArguments(rest, []); if (positionals.length !== 2) throw new CliUsageError("Usage: zo-drive shared file delete <mount-id> <key>"); await requireMethod(dependencies.client, "deleteClusterObject")({ id: positionals[0]!, key: positionals[1]! }); write(`Deleted shared file ${positionals[1]}\n`); return 0; }
  }
  throw new CliUsageError(sharedHelpText());
}

async function runDatabaseCommand(args: string[], dependencies: OriginalCommandDependencies): Promise<number> {
  const [action, ...rest] = args;
  const readFile = dependencies.readFile ?? readFileFromDisk;
  const writeFile = dependencies.writeFile ?? writeFileToDisk;
  const write = dependencies.write;
  if (action === "list" || action === "engines") { const { options } = parseArguments(rest, [], ["json"]); const items = action === "list" ? await requireMethod(dependencies.client, "listDatabases")() : await requireMethod(dependencies.client, "listDatabaseEngines")(); write(options.json ? `${JSON.stringify(items)}\n` : formatRecords(items, action === "list" ? ["id", "name", "engine", "sizeBytes"] : ["engine", "installed", "installedVersion", "protocol"])); return 0; }
  if (action === "create") { const { positionals, options } = parseArguments(rest, ["engine"], ["json"]); if (positionals.length !== 1) throw new CliUsageError("Usage: zo-drive database create <name> [--engine <engine>]"); const db = await requireMethod(dependencies.client, "createDatabase")(positionals[0]!, databaseEngine(options.engine)); write(options.json ? `${JSON.stringify(db)}\n` : `Created database ${db.name} (${db.id})\n`); return 0; }
  if (action === "delete") { const { positionals } = parseArguments(rest, []); if (positionals.length !== 1) throw new CliUsageError("Usage: zo-drive database delete <id>"); await requireMethod(dependencies.client, "deleteDatabase")(positionals[0]!); write(`Deleted database ${positionals[0]}\n`); return 0; }
  if (action === "engine") { const [verb, engine, ...tail] = rest; const { options } = parseArguments(tail, [], ["json"]); if (!engine || !["install", "update"].includes(verb ?? "")) throw new CliUsageError("Usage: zo-drive database engine <install|update> <engine> [--json]"); const result = verb === "install" ? await requireMethod(dependencies.client, "installDatabaseEngine")(databaseEngine(engine)) : await requireMethod(dependencies.client, "updateDatabaseEngine")(databaseEngine(engine)); write(options.json ? `${JSON.stringify(result)}\n` : `${verb === "install" ? "Installed" : "Updated"} ${result.name}\n`); return 0; }
  if (action === "import") { const { positionals, options } = parseArguments(rest, ["name"], ["json"]); if (positionals.length !== 1 || typeof options.name !== "string") throw new CliUsageError("Usage: zo-drive database import <sqlite-file> --name <name>"); const db = await requireMethod(dependencies.client, "importDatabase")({ file: new Blob([await readFile(positionals[0]!)]), name: options.name }); write(options.json ? `${JSON.stringify(db)}\n` : `Imported database ${db.name} (${db.id})\n`); return 0; }
  if (action === "export") { const { positionals, options } = parseArguments(rest, ["output"]); if (positionals.length !== 1) throw new CliUsageError("Usage: zo-drive database export <id> [--output <file>]"); const target = typeof options.output === "string" ? options.output : `${positionals[0]}.sqlite`; await writeFile(target, Buffer.from(await (await requireMethod(dependencies.client, "exportDatabase")(positionals[0]!)).arrayBuffer())); write(`Exported database ${positionals[0]} to ${target}\n`); return 0; }
  if (action === "tables") { const { positionals, options } = parseArguments(rest, [], ["json"]); if (positionals.length !== 1) throw new CliUsageError("Usage: zo-drive database tables <id> [--json]"); const items = await requireMethod(dependencies.client, "listDatabaseTables")(positionals[0]!); write(options.json ? `${JSON.stringify(items)}\n` : formatRecords(items, ["name", "schema"])); return 0; }
  if (action === "rows") { const { positionals, options } = parseArguments(rest, ["limit", "offset"], ["json"]); if (positionals.length !== 2) throw new CliUsageError("Usage: zo-drive database rows <id> <table> [--limit <1-100>] [--offset <n>] [--json]"); const rows = await requireMethod(dependencies.client, "listDatabaseRows")({ id: positionals[0]!, table: positionals[1]!, limit: integerOption(options.limit, "limit", 100), offset: integerOption(options.offset, "offset", 0) }); write(`${JSON.stringify(rows)}\n`); return 0; }
  if (action === "query") { const { positionals, options } = parseArguments(rest, ["sql", "params"], ["json"]); if (positionals.length !== 1 || typeof options.sql !== "string") throw new CliUsageError("Usage: zo-drive database query <id> --sql <statement> [--params <json-array>] [--json]"); const result = await requireMethod(dependencies.client, "queryDatabase")({ id: positionals[0]!, sql: options.sql, params: jsonArray(options.params, "--params") }); write(`${JSON.stringify(result)}\n`); return 0; }
  if (action === "execute") { const { positionals, options } = parseArguments(rest, ["request"]); if (positionals.length !== 1 || typeof options.request !== "string") throw new CliUsageError("Usage: zo-drive database execute <id> --request <json-object>"); const result = await requireMethod(dependencies.client, "executeDatabase")({ id: positionals[0]!, request: jsonObject(options.request, "--request") }); write(`${JSON.stringify(result)}\n`); return 0; }
  if (action === "settings") { const [verb, ...tail] = rest; if (verb === "get") { const { options } = parseArguments(tail, [], ["json"]); const settings = await requireMethod(dependencies.client, "getDatabaseImportSettings")(); write(options.json ? `${JSON.stringify(settings)}\n` : `Import limit: ${formatBytes(settings.importLimitBytes)}\n`); return 0; } if (verb === "set") { const { options } = parseArguments(tail, ["import-limit"]); if (typeof options["import-limit"] !== "string") throw new CliUsageError("Usage: zo-drive database settings set --import-limit <bytes>"); const settings = await requireMethod(dependencies.client, "setDatabaseImportLimit")(integerOption(options["import-limit"], "import-limit")); write(`Set database import limit to ${formatBytes(settings.importLimitBytes)}\n`); return 0; } }
  if (action === "key") { const [verb, ...tail] = rest; if (verb === "list") { const { positionals, options } = parseArguments(tail, [], ["json"]); if (positionals.length !== 1) throw new CliUsageError("Usage: zo-drive database key list <database-id> [--json]"); const keys = await requireMethod(dependencies.client, "listDatabaseApiKeys")(positionals[0]!); write(options.json ? `${JSON.stringify(keys)}\n` : formatRecords(keys, ["id", "name", "prefix", "scopes", "expiresAt"])); return 0; } if (verb === "create") { const { positionals, options } = parseArguments(tail, ["name", "scopes", "expires"], ["json"]); if (positionals.length !== 1 || typeof options.name !== "string") throw new CliUsageError("Usage: zo-drive database key create <database-id> --name <name> [--scopes <read,write>] [--expires <ISO date|never>]"); const key = await requireMethod(dependencies.client, "createDatabaseApiKey")({ databaseId: positionals[0]!, name: options.name, scopes: databaseScopes(options.scopes), expiresAt: parseExpiry(options.expires) }); write(options.json ? `${JSON.stringify(key)}\n` : `Created database key ${key.id}\nKey (shown once): ${key.apiKey}\n`); return 0; } if (verb === "revoke") { const { positionals } = parseArguments(tail, []); if (positionals.length !== 2) throw new CliUsageError("Usage: zo-drive database key revoke <database-id> <key-id>"); await requireMethod(dependencies.client, "revokeDatabaseApiKey")({ databaseId: positionals[0]!, keyId: positionals[1]! }); write(`Revoked database key ${positionals[1]}\n`); return 0; } }
  throw new CliUsageError(databaseHelpText());
}

async function runFunctionCommand(args: string[], dependencies: OriginalCommandDependencies): Promise<number> {
  const [action, ...rest] = args;
  const readFile = dependencies.readFile ?? readFileFromDisk;
  const write = dependencies.write;
  if (action === "list") { const { options } = parseArguments(rest, [], ["json"]); const items = await requireMethod(dependencies.client, "listFunctions")(); write(options.json ? `${JSON.stringify(items)}\n` : formatRecords(items, ["id", "name", "runtime", "visibility", "cron", "enabled", "lastRunStatus"])); return 0; }
  if (action === "create" || action === "update") { const { positionals, options } = parseArguments(rest, ["name", "runtime", "source", "source-file", "visibility", "cron"], ["enabled", "disabled", "json"]); if ((action === "create" && typeof options.name !== "string") || (action === "update" && positionals.length !== 1)) throw new CliUsageError(`Usage: zo-drive function ${action}${action === "create" ? " --name <name>" : " <id>"} [--runtime <javascript|python>] [--source <code> | --source-file <file>] [--visibility <private|public>] [--cron <UTC cron>] [--enabled|--disabled]`); const source = typeof options.source === "string" ? options.source : typeof options["source-file"] === "string" ? await readFile(options["source-file"], "utf8") : undefined; if (action === "create" && !source) throw new CliUsageError("Provide function code with --source or --source-file."); const changes = { name: typeof options.name === "string" ? options.name : undefined, runtime: functionRuntime(options.runtime), source, visibility: functionVisibility(options.visibility), cron: typeof options.cron === "string" ? options.cron : undefined, enabled: options.enabled === true ? true : options.disabled === true ? false : undefined }; const fn = action === "create" ? await requireMethod(dependencies.client, "createFunction")({ name: changes.name!, runtime: changes.runtime ?? "javascript", source: changes.source!, visibility: changes.visibility ?? "private", cron: changes.cron ?? null, enabled: changes.enabled ?? true }) : await requireMethod(dependencies.client, "updateFunction")({ id: positionals[0]!, ...changes }); write(options.json ? `${JSON.stringify(fn)}\n` : `${action === "create" ? "Created" : "Updated"} function ${fn.name} (${fn.id})\n`); return 0; }
  if (action === "delete") { const { positionals } = parseArguments(rest, []); if (positionals.length !== 1) throw new CliUsageError("Usage: zo-drive function delete <id>"); await requireMethod(dependencies.client, "deleteFunction")(positionals[0]!); write(`Deleted function ${positionals[0]}\n`); return 0; }
  if (action === "run") { const { positionals, options } = parseArguments(rest, ["input", "input-file"], ["json"]); if (positionals.length !== 1) throw new CliUsageError("Usage: zo-drive function run <id> [--input <json>] [--input-file <file>] [--json]"); const input = typeof options.input === "string" ? jsonValue(options.input, "--input") : typeof options["input-file"] === "string" ? jsonValue(await readFile(options["input-file"], "utf8"), "--input-file") : {}; const run = await requireMethod(dependencies.client, "runFunction")(positionals[0]!, input); write(`${JSON.stringify(run)}\n`); return 0; }
  if (action === "runs") { const { positionals, options } = parseArguments(rest, [], ["json"]); if (positionals.length !== 1) throw new CliUsageError("Usage: zo-drive function runs <id> [--json]"); const runs = await requireMethod(dependencies.client, "listFunctionRuns")(positionals[0]!); write(options.json ? `${JSON.stringify(runs)}\n` : formatRecords(runs, ["id", "status", "trigger", "startedAt", "finishedAt"])); return 0; }
  throw new CliUsageError(functionHelpText());
}

function pasteContent({ language, tags, text }: { language: string; tags: string[]; text: string }) { return { format: "zo-native" as const, type: "paste" as const, version: 1 as const, language, tags, text }; }
async function readPaste(client: CliClient, key: string): Promise<{ language: string; tags: string[]; text: string }> { const response = await requireMethod(client, "download")(key); const value = jsonObject(await response.text(), `paste ${key}`); if (value.type !== "paste" || typeof value.text !== "string" || typeof value.language !== "string" || !Array.isArray(value.tags)) throw new CliUsageError(`${key} is not a Zo Paste.`); return { language: value.language, tags: value.tags.filter((item): item is string => typeof item === "string"), text: value.text }; }
function createTransfer(client: CliClient, key: string, options: Record<string, string | boolean | undefined>) { return requireMethod(client, "createShare")({ key, access: shareAccess(options.access), kind: "transfer", passcode: typeof options.passcode === "string" ? options.passcode : undefined, expiresAt: parseExpiry(options.expires) }); }
function shareAccess(value: unknown): "public" | "passcode" { if (value === "public" || value === "passcode") return value; throw new CliUsageError("Set --access to public or passcode."); }
function clusterRole(value: unknown): "viewer" | "editor" { if (value === undefined) return "editor"; if (value === "viewer" || value === "editor") return value; throw new CliUsageError("Role must be viewer or editor."); }
function databaseEngine(value: unknown): DatabaseEngineId { const engines: DatabaseEngineId[] = ["sqlite", "duckdb", "libsql", "pglite", "lancedb", "leveldb", "redis", "kuzu"]; if (value === undefined) return "sqlite"; if (typeof value === "string" && engines.includes(value as DatabaseEngineId)) return value as DatabaseEngineId; throw new CliUsageError(`Unsupported database engine: ${String(value)}`); }
function functionRuntime(value: unknown): FunctionRuntime | undefined { if (value === undefined) return undefined; if (value === "javascript" || value === "python") return value; throw new CliUsageError("Runtime must be javascript or python."); }
function functionVisibility(value: unknown): FunctionVisibility | undefined { if (value === undefined) return undefined; if (value === "private" || value === "public") return value; throw new CliUsageError("Visibility must be private or public."); }
function databaseScopes(value: unknown): Array<"read" | "write"> { if (value === undefined) return ["read", "write"]; const scopes = splitCsv(String(value)); if (!scopes.length || scopes.some((scope) => scope !== "read" && scope !== "write")) throw new CliUsageError("Scopes must be read, write, or read,write."); return [...new Set(scopes)] as Array<"read" | "write">; }
function parseExpiry(value: unknown): string | null { if (value === undefined || value === "never") return null; if (value === "1d" || value === "7d" || value === "30d") return new Date(Date.now() + { "1d": 86_400_000, "7d": 604_800_000, "30d": 2_592_000_000 }[value]).toISOString(); const date = new Date(String(value)); if (Number.isNaN(date.getTime()) || date.getTime() <= Date.now()) throw new CliUsageError("Expiry must be a future ISO date, 1d, 7d, 30d, or never."); return date.toISOString(); }
function splitCsv(value: string): string[] { return value.split(",").map((item) => item.trim()).filter(Boolean); }
function integerOption(value: unknown, name: string, fallback?: number): number { if (value === undefined && fallback !== undefined) return fallback; const parsed = Number(value); if (!Number.isInteger(parsed) || parsed < 0) throw new CliUsageError(`--${name} must be a non-negative whole number.`); return parsed; }
function jsonValue(value: string, name: string): unknown { try { return JSON.parse(value); } catch { throw new CliUsageError(`${name} must be valid JSON.`); } }
function jsonObject(value: string, name: string): Record<string, unknown> { const parsed = jsonValue(value, name); if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") throw new CliUsageError(`${name} must be a JSON object.`); return parsed as Record<string, unknown>; }
function jsonArray(value: unknown, name: string): Array<string | number | boolean | null> { if (value === undefined) return []; const parsed = jsonValue(String(value), name); if (!Array.isArray(parsed) || parsed.some((item) => !["string", "number", "boolean"].includes(typeof item) && item !== null)) throw new CliUsageError(`${name} must be a JSON array of strings, numbers, booleans, or null.`); return parsed as Array<string | number | boolean | null>; }
function formatRecords(records: Array<Record<string, unknown>>, fields: string[]): string { if (!records.length) return "No results.\n"; return `${fields.join("\t")}\n${records.map((record) => fields.map((field) => stringifyRecordValue(record[field])).join("\t")).join("\n")}\n`; }
function stringifyRecordValue(value: unknown): string { return value === null || value === undefined ? "-" : Array.isArray(value) ? value.join(",") : String(value); }
function pasteHelpText() { return "Usage: zo-drive paste <list|create|show|update|share|delete>\n"; }
function transferHelpText() { return "Usage: zo-drive transfer <list|create|upload|passcode|revoke>\n"; }
function sharedHelpText() { return "Usage: zo-drive shared <invite|mount|peer|file> <action>\n"; }
function databaseHelpText() { return "Usage: zo-drive database <list|engines|engine|create|delete|import|export|tables|rows|query|execute|settings|key>\n"; }
function functionHelpText() { return "Usage: zo-drive function <list|create|update|delete|run|runs>\n"; }

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
  return { positionals, options: options as Record<string, string | boolean | undefined> & { force?: boolean; json?: boolean; "dry-run"?: boolean; password?: string; path?: string; output?: string; username?: string } };
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
    "  paste <list|create|show|update|share|delete>",
    "  transfer <list|create|upload|passcode|revoke>",
    "  shared <invite|mount|peer|file> <action>",
    "  database, db <list|engines|engine|create|delete|import|export|tables|rows|query|execute|settings|key>",
    "  function, fn <list|create|update|delete|run|runs>",
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
