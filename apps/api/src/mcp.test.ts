import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { createApp } from "./app.js";
import { LocalApiKeyStore } from "./auth/local-api-key-store.js";
import { LocalDriveStorage } from "./storage/local-drive-storage.js";

describe("Zo Drive MCP", () => {
  const roots: string[] = [];

  afterEach(async () => {
    await Promise.all(roots.splice(0).map((root) => rm(root, { force: true, recursive: true })));
  });

  it("exposes Drive tools through authenticated stateless Streamable HTTP", async () => {
    const root = await mkdtemp(join(tmpdir(), "zo-drive-mcp-"));
    roots.push(root);
    const storage = new LocalDriveStorage({ root });
    const apiKeys = new LocalApiKeyStore({ root });
    const app = createApp({
      storage,
      apiKeys,
      resolveUserId: (request) => apiKeys.userIdFromRequest(request)
    });
    await storage.write({ userId: "owner", key: "Notes/brief.md", content: Buffer.from("Private launch brief"), contentType: "text/markdown" });
    const readKey = await apiKeys.create({ ownerUserId: "owner", name: "Read-only agent", scopes: ["read"], expiresAt: null });
    const writeKey = await apiKeys.create({ ownerUserId: "owner", name: "Write agent", scopes: ["read", "write"], expiresAt: null });

    expect((await callMcp(app, null, "tools/list")).status).toBe(401);

    const initialize = await callMcp(app, readKey.apiKey, "initialize", {
      protocolVersion: "2025-11-25",
      capabilities: {},
      clientInfo: { name: "zo-drive-test", version: "1.0.0" }
    });
    expect(initialize.status).toBe(200);
    await expect(initialize.json()).resolves.toMatchObject({ result: { serverInfo: { name: "zo-drive", version: "0.14.0" } } });

    const listedTools = await callMcp(app, readKey.apiKey, "tools/list");
    const listedToolsBody = await listedTools.json() as { result: { tools: Array<{ name: string }> } };
    expect(listedToolsBody.result.tools.map((tool) => tool.name)).toEqual(expect.arrayContaining(["list_files", "read_file", "write_text_file", "trash_file"]));

    const listed = await callTool(app, readKey.apiKey, "list_files", {});
    expect(toolText(listed)).toContain("Notes/brief.md");

    const blockedWrite = await callTool(app, readKey.apiKey, "write_text_file", { key: "Notes/blocked.md", content: "blocked" });
    expect(blockedWrite.result.isError).toBe(true);
    expect(toolText(blockedWrite)).toContain("read and write scopes");

    const written = await callTool(app, writeKey.apiKey, "write_text_file", { key: "Notes/agent.md", content: "Created through MCP", content_type: "text/markdown" });
    expect(written.result.isError).not.toBe(true);
    expect(toolText(written)).toContain("Notes/agent.md");

    const read = await callTool(app, readKey.apiKey, "read_file", { key: "Notes/agent.md" });
    expect(toolText(read)).toContain("Created through MCP");

    const trashed = await callTool(app, writeKey.apiKey, "trash_file", { key: "Notes/agent.md" });
    expect(toolText(trashed)).toContain("Notes/agent.md");
    await expect(storage.list({ userId: "owner" })).resolves.toHaveLength(1);
    await expect(storage.listTrash({ userId: "owner" })).resolves.toEqual([expect.objectContaining({ originalKey: "Notes/agent.md" })]);
  });
});

async function callMcp(app: ReturnType<typeof createApp>, apiKey: string | null, method: string, params: Record<string, unknown> = {}) {
  return app.request("http://localhost/mcp", {
    method: "POST",
    headers: {
      accept: "application/json, text/event-stream",
      ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}),
      "content-type": "application/json",
      "mcp-protocol-version": "2025-11-25"
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params })
  });
}

async function callTool(app: ReturnType<typeof createApp>, apiKey: string, name: string, args: Record<string, unknown>) {
  const response = await callMcp(app, apiKey, "tools/call", { name, arguments: args });
  expect(response.status).toBe(200);
  return await response.json() as { result: { content: Array<{ text: string; type: string }>; isError?: boolean } };
}

function toolText(response: { result: { content: Array<{ text: string }> } }): string {
  return response.result.content.map((item) => item.text).join("\n");
}
