import { readFile } from "node:fs/promises";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { z } from "zod/v4";

import type { LocalDriveStorage } from "./storage/local-drive-storage.js";

type ZoDriveMcpOptions = {
  onFileMoved?: (fromKey: string, toKey: string) => Promise<void>;
  onFileTrashed?: (key: string) => Promise<void>;
  onMutation?: (toolName: string) => Promise<void>;
  readUserId: string;
  request: Request;
  requireWriteUser: () => Promise<string | null>;
  storage: LocalDriveStorage;
};

const fileTypeSchema = z.enum(["document", "spreadsheet", "presentation", "form", "paste", "image", "video", "audio", "pdf", "other"]);

export async function handleZoDriveMcpRequest(options: ZoDriveMcpOptions): Promise<Response> {
  const server = createZoDriveMcpServer(options);
  const transport = new WebStandardStreamableHTTPServerTransport({
    enableJsonResponse: true,
    sessionIdGenerator: undefined
  });

  await server.connect(transport);
  try {
    return await transport.handleRequest(options.request);
  } finally {
    await server.close();
  }
}

function createZoDriveMcpServer(options: ZoDriveMcpOptions): McpServer {
  const server = new McpServer({ name: "zo-drive", version: "0.14.0" });
  const readUserId = options.readUserId;

  server.registerTool("list_files", {
    description: "List files in Zo Drive. Returns metadata only and never changes Drive data.",
    inputSchema: {
      limit: z.number().int().min(1).max(200).default(100),
      prefix: z.string().max(1024).optional(),
      type: fileTypeSchema.optional()
    },
    annotations: { readOnlyHint: true }
  }, async ({ limit, prefix, type }) => toolResult(async () => {
    const files = await options.storage.list({ userId: readUserId, prefix, type });
    return { files: files.slice(0, limit).map(fileSummary), shown: Math.min(files.length, limit), total: files.length };
  }));

  server.registerTool("search_files", {
    description: "Search Zo Drive by file name or supported text content. Returns metadata only.",
    inputSchema: {
      content_query: z.string().max(500).optional(),
      limit: z.number().int().min(1).max(200).default(50),
      prefix: z.string().max(1024).optional(),
      query: z.string().max(500).optional(),
      type: fileTypeSchema.optional()
    },
    annotations: { readOnlyHint: true }
  }, async ({ content_query, limit, prefix, query, type }) => toolResult(async () => {
    if (!query?.trim() && !content_query?.trim()) throw new Error("Provide a file-name query or content query.");
    const files = await options.storage.list({ userId: readUserId, prefix, query, contentQuery: content_query, type });
    return { files: files.slice(0, limit).map(fileSummary), shown: Math.min(files.length, limit), total: files.length };
  }));

  server.registerTool("list_folders", {
    description: "List folders directly below a Zo Drive path.",
    inputSchema: { prefix: z.string().max(1024).optional() },
    annotations: { readOnlyHint: true }
  }, async ({ prefix }) => toolResult(async () => ({ folders: await options.storage.listFolders({ userId: readUserId, prefix }) })));

  server.registerTool("read_file", {
    description: "Read a text, JSON, or Zo-native file from Zo Drive. Binary files return metadata without their content.",
    inputSchema: {
      key: z.string().min(1).max(2048),
      max_bytes: z.number().int().min(1).max(1_000_000).default(120_000)
    },
    annotations: { readOnlyHint: true }
  }, async ({ key, max_bytes }) => toolResult(async () => {
    const file = await options.storage.read({ userId: readUserId, key });
    const metadata = fileSummary(file);
    if (!isReadableText(file.contentType)) return { file: metadata, readable: false, reason: "Binary content is not returned through MCP." };
    if (file.size > max_bytes) return { file: metadata, readable: false, reason: `File exceeds the ${max_bytes}-byte MCP read limit.` };
    return { content: await readFile(file.filePath, "utf8"), file: metadata, readable: true };
  }));

  server.registerTool("get_storage_usage", {
    description: "Return Zo Drive quota, available space, file count, and category usage.",
    annotations: { readOnlyHint: true }
  }, async () => toolResult(async () => options.storage.getUsage({ userId: readUserId })));

  server.registerTool("create_folder", {
    description: "Create a folder in Zo Drive. Use only when the user has requested a Drive change.",
    inputSchema: { path: z.string().min(1).max(1024) },
    annotations: { idempotentHint: true, readOnlyHint: false }
  }, async ({ path }) => toolResult(async () => {
    const userId = await requireWriteUser(options);
    const folder = await options.storage.createFolder({ userId, key: path });
    await options.onMutation?.("create_folder");
    return folder;
  }));

  server.registerTool("write_text_file", {
    description: "Create or explicitly overwrite a text file in Zo Drive. Existing files are protected unless overwrite is true.",
    inputSchema: {
      content: z.string().max(1_000_000),
      content_type: z.enum(["application/json", "text/csv", "text/markdown", "text/plain"]).default("text/plain"),
      key: z.string().min(1).max(2048),
      overwrite: z.boolean().default(false)
    },
    annotations: { idempotentHint: true, readOnlyHint: false }
  }, async ({ content, content_type, key, overwrite }) => toolResult(async () => {
    const userId = await requireWriteUser(options);
    if (!overwrite && await fileExists(options.storage, userId, key)) throw new Error("A file already exists at this key. Set overwrite to true only with explicit user approval.");
    const file = await options.storage.write({ userId, key, content: Buffer.from(content, "utf8"), contentType: content_type });
    await options.onMutation?.("write_text_file");
    return file;
  }));

  server.registerTool("move_file", {
    description: "Move a Zo Drive file to a new key. Existing destinations are not overwritten.",
    inputSchema: { destination: z.string().min(1).max(2048), key: z.string().min(1).max(2048) },
    annotations: { idempotentHint: false, readOnlyHint: false }
  }, async ({ destination, key }) => toolResult(async () => {
    const userId = await requireWriteUser(options);
    const file = await options.storage.moveFile({ userId, key, destination });
    await options.onFileMoved?.(key, file.key);
    await options.onMutation?.("move_file");
    return file;
  }));

  server.registerTool("copy_file", {
    description: "Copy a Zo Drive file. Existing destinations are protected unless overwrite is true.",
    inputSchema: {
      destination: z.string().min(1).max(2048),
      key: z.string().min(1).max(2048),
      overwrite: z.boolean().default(false)
    },
    annotations: { idempotentHint: true, readOnlyHint: false }
  }, async ({ destination, key, overwrite }) => toolResult(async () => {
    const userId = await requireWriteUser(options);
    const file = await options.storage.copyFile({ userId, key, destination, overwrite });
    await options.onMutation?.("copy_file");
    return file;
  }));

  server.registerTool("trash_file", {
    description: "Move a file to Zo Drive Trash. This is reversible; permanent deletion is not exposed through MCP.",
    inputSchema: { key: z.string().min(1).max(2048) },
    annotations: { destructiveHint: true, idempotentHint: false, readOnlyHint: false }
  }, async ({ key }) => toolResult(async () => {
    const userId = await requireWriteUser(options);
    const item = await options.storage.trash({ userId, key });
    await options.onFileTrashed?.(key);
    await options.onMutation?.("trash_file");
    return item;
  }));

  return server;
}

async function requireWriteUser(options: ZoDriveMcpOptions): Promise<string> {
  const userId = await options.requireWriteUser();
  if (!userId || userId !== options.readUserId) throw new Error("This MCP operation requires a Zo Drive device key with read and write scopes.");
  return userId;
}

async function fileExists(storage: LocalDriveStorage, userId: string, key: string): Promise<boolean> {
  try {
    await storage.read({ userId, key });
    return true;
  } catch (error) {
    if (isErrorCode(error, "ENOENT")) return false;
    throw error;
  }
}

function fileSummary(file: { contentType: string; key: string; name: string; nativeType?: string; size: number; starred: boolean; updatedAt: string }) {
  return {
    contentType: file.contentType,
    key: file.key,
    name: file.name,
    nativeType: file.nativeType,
    size: file.size,
    starred: file.starred,
    updatedAt: file.updatedAt
  };
}

function isReadableText(contentType: string): boolean {
  return contentType.startsWith("text/") || contentType === "application/json" || contentType.endsWith("+json");
}

async function toolResult(operation: () => Promise<unknown>) {
  try {
    const value = await operation();
    return { content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }] };
  } catch (error) {
    throw new Error(publicErrorMessage(error));
  }
}

function publicErrorMessage(error: unknown): string {
  if (isErrorCode(error, "ENOENT")) return "The requested Zo Drive file or folder was not found.";
  if (isErrorCode(error, "EEXIST")) return "A Zo Drive file or folder already exists at the destination.";
  if (error instanceof Error && !error.message.includes("/home/")) return error.message;
  return "The Zo Drive operation failed.";
}

function isErrorCode(error: unknown, code: string): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === code;
}
