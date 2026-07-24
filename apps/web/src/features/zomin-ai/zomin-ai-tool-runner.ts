import type { ZoDriveClient } from "@zo-drive/sdk";
import type { DriveObject } from "@zo-drive/types";
import { formatBytes } from "../../drive-formatting.js";
import { zominAiTimeUrl } from "./zomin-ai-gateway.js";
import type { ZominAiSettings, ZominAiToolRunner } from "./zomin-ai-types.js";

export type ZominAiToolClient =
  Pick<ZoDriveClient, "download" | "getUsage" | "list">
  & Partial<Pick<ZoDriveClient, "listDatabases" | "listDatabaseTables" | "queryDatabase">>;

function zominAiJson(value: unknown): string {
  const json = JSON.stringify(value);
  return json.length > 60_000 ? `${json.slice(0, 60_000)}\n[Truncated for the local model.]` : json;
}
function zominAiArguments(argumentsJson: string): Record<string, unknown> {
  try {
    const value = JSON.parse(argumentsJson) as unknown;
    return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function zominAiString(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`Provide a valid ${label}.`);
  return value.trim();
}

function zominAiObjectSummary(object: DriveObject) {
  return { contentType: object.contentType, key: object.key, name: object.name, nativeType: object.nativeType, size: object.size, starred: object.starred, updatedAt: object.updatedAt };
}

function zominAiDriveInventorySummary(objects: DriveObject[]) {
  if (objects.length === 0) return { fileCount: 0, totalBytes: 0, totalSize: formatBytes(0) };
  const bySize = [...objects].sort((left, right) => left.size - right.size || left.key.localeCompare(right.key));
  const byUpdatedAt = [...objects].sort((left, right) => left.updatedAt.localeCompare(right.updatedAt) || left.key.localeCompare(right.key));
  const totalBytes = objects.reduce((total, object) => total + object.size, 0);
  return {
    fileCount: objects.length,
    totalBytes,
    totalSize: formatBytes(totalBytes),
    largestFile: zominAiObjectSummary(bySize.at(-1)!),
    smallestFile: zominAiObjectSummary(bySize[0]!),
    newestFile: zominAiObjectSummary(byUpdatedAt.at(-1)!),
    oldestFile: zominAiObjectSummary(byUpdatedAt[0]!)
  };
}

function isZominAiTextFile(contentType: string): boolean {
  return contentType.startsWith("text/") || /(?:json|javascript|xml|csv|yaml)/i.test(contentType);
}

function isZominAiReadOnlySql(sql: string): boolean {
  const statement = sql.replace(/--[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "").trim().toLowerCase();
  return /^(select|pragma|explain)\b/.test(statement) && !/;\s*\S/.test(statement);
}

export function createZominAiToolRunner(client: ZominAiToolClient, settings: ZominAiSettings): ZominAiToolRunner {
  return async (name, argumentsJson, signal) => {
    const args = zominAiArguments(argumentsJson);
    if (name === "get_current_time") {
      const url = zominAiTimeUrl(settings.endpoint);
      if (!url) throw new Error("The ZominAI gateway address is invalid.");
      const response = await fetch(url, { headers: { Accept: "application/json" }, signal });
      if (!response.ok) throw new Error("The Zo Computer clock is currently unavailable.");
      return zominAiJson(await response.json());
    }
    if (name === "get_storage_usage") {
      const usage = await client.getUsage();
      const machineUsedBytes = Math.max(0, usage.totalBytes - usage.availableBytes);
      return zominAiJson({
        drive: { available: formatBytes(usage.quotaAvailableBytes), fileCount: usage.fileCount, quota: formatBytes(usage.quotaBytes), quotaAvailableBytes: usage.quotaAvailableBytes, quotaBytes: usage.quotaBytes, used: formatBytes(usage.usedBytes), usedBytes: usage.usedBytes },
        machine: { available: formatBytes(usage.availableBytes), availableBytes: usage.availableBytes, total: formatBytes(usage.totalBytes), totalBytes: usage.totalBytes, used: formatBytes(machineUsedBytes), usedBytes: machineUsedBytes }
      });
    }
    if (name === "list_drive") {
      const prefix = typeof args.prefix === "string" ? args.prefix.trim() : undefined;
      const objects = await client.list({ prefix });
      const sortBy = args.sort_by === "size" || args.sort_by === "updated_at" ? args.sort_by : "name";
      const order = args.order === "desc" ? "desc" : "asc";
      const limit = typeof args.limit === "number" && Number.isInteger(args.limit) ? Math.min(100, Math.max(1, args.limit)) : 100;
      const sortedObjects = [...objects].sort((left, right) => {
        const comparison = sortBy === "size"
          ? left.size - right.size || left.key.localeCompare(right.key)
          : sortBy === "updated_at"
            ? left.updatedAt.localeCompare(right.updatedAt) || left.key.localeCompare(right.key)
            : left.key.localeCompare(right.key);
        return order === "desc" ? -comparison : comparison;
      });
      return zominAiJson({ files: sortedObjects.slice(0, limit).map(zominAiObjectSummary), shown: Math.min(objects.length, limit), summary: zominAiDriveInventorySummary(objects), total: objects.length });
    }
    if (name === "search_drive") {
      const query = zominAiString(args.query, "search query");
      const prefix = typeof args.prefix === "string" ? args.prefix.trim() : undefined;
      const [nameMatches, contentMatches] = await Promise.all([client.list({ prefix, query }), client.list({ contentQuery: query, prefix })]);
      const matches = [...nameMatches, ...contentMatches].filter((object, index, all) => all.findIndex((candidate) => candidate.key === object.key) === index);
      return zominAiJson({ files: matches.slice(0, 50).map(zominAiObjectSummary), query, shown: Math.min(matches.length, 50), total: matches.length });
    }
    if (name === "read_drive_file") {
      const key = zominAiString(args.key, "Drive file key");
      const response = await client.download(key);
      const contentType = response.headers.get("content-type") ?? "";
      const size = Number(response.headers.get("content-length") ?? 0);
      if (!isZominAiTextFile(contentType)) return zominAiJson({ error: "This file is not a supported text or Zo-native format. I can list it but cannot read its content yet.", key, contentType });
      if (Number.isFinite(size) && size > 120_000) return zominAiJson({ error: "This text file is too large to load into the local chat at once. Search it or use a smaller file.", key, size });
      const text = await response.text();
      return zominAiJson({ content: text.slice(0, 120_000), contentType, key, truncated: text.length > 120_000 });
    }
    if (name === "list_databases") {
      if (!client.listDatabases) throw new Error("Database tools are not available in this Drive client.");
      const databases = await client.listDatabases();
      return zominAiJson({ databases: databases.map((database) => ({ engine: database.engine, id: database.id, name: database.name, sizeBytes: database.sizeBytes, updatedAt: database.updatedAt })) });
    }
    if (name === "describe_database") {
      if (!client.listDatabaseTables) throw new Error("Database schema tools are not available in this Drive client.");
      const databaseId = zominAiString(args.database_id, "database id");
      return zominAiJson({ databaseId, tables: await client.listDatabaseTables(databaseId) });
    }
    if (name === "query_database") {
      if (!client.queryDatabase) throw new Error("Database query tools are not available in this Drive client.");
      const databaseId = zominAiString(args.database_id, "database id");
      const sql = zominAiString(args.sql, "SQL query");
      if (!isZominAiReadOnlySql(sql)) throw new Error("ZominAI can only run one read-only SELECT, PRAGMA, or EXPLAIN statement.");
      const result = await client.queryDatabase({ id: databaseId, sql });
      return zominAiJson({ columns: result.columns, databaseId, rows: result.rows.slice(0, 200), rowsShown: Math.min(result.rows.length, 200), truncated: result.rows.length > 200 });
    }
    throw new Error("Unknown ZominAI Drive tool.");
  };
}
