import { DuckDBInstance } from "@duckdb/node-api";
import { PGlite } from "@electric-sql/pglite";
import * as lancedb from "@lancedb/lancedb";
import { createClient as createLibsqlClient } from "@libsql/client";
import { ClassicLevel } from "classic-level";
import { Connection as KuzuConnection, Database as KuzuDatabase } from "kuzu";
import { createClient as createRedisClient } from "redis";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, rm, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { promisify } from "node:util";

export type RuntimeEngineId = "sqlite" | "duckdb" | "libsql" | "pglite" | "lancedb" | "leveldb" | "redis" | "kuzu";
export type RuntimeRequest = Record<string, unknown>;

const execFileAsync = promisify(execFile);
const redisStarts = new Map<string, Promise<void>>();
const runtimeQueues = new Map<string, Promise<void>>();

const redisReadCommands = new Set(["BITCOUNT", "EXISTS", "GET", "HGET", "HGETALL", "HLEN", "HMGET", "HSCAN", "KEYS", "LLEN", "LRANGE", "MGET", "PING", "SCARD", "SCAN", "SMEMBERS", "STRLEN", "TTL", "TYPE", "XINFO", "XLEN", "XRANGE", "ZCARD", "ZRANGE", "ZSCORE"]);
const redisWriteCommands = new Set(["APPEND", "DECR", "DEL", "EXPIRE", "HDEL", "HINCRBY", "HMSET", "HSET", "INCR", "INCRBY", "LPOP", "LPUSH", "MSET", "PERSIST", "PEXPIRE", "RPOP", "RPUSH", "SADD", "SET", "SREM", "XADD", "XDEL", "ZADD", "ZREM"]);

export function runtimeRequestIsWrite(engine: RuntimeEngineId, request: RuntimeRequest): boolean {
  if (engine === "redis") return !redisReadCommands.has(requiredString(request.command, "command").toUpperCase());
  if (engine === "leveldb") return request.operation === "put" || request.operation === "delete";
  if (engine === "lancedb") return request.operation === "createTable" || request.operation === "add";
  return !queryIsReadOnly(requiredString(request.query, "query"));
}

export async function initialiseRuntime(engine: RuntimeEngineId, path: string): Promise<void> {
  await mkdir(path.endsWith(".duckdb") || path.endsWith(".libsql") || path.endsWith(".kuzu") ? dirname(path) : path, { recursive: true });
  if (engine === "sqlite") return;
  if (engine === "duckdb") {
    const instance = await DuckDBInstance.create(path, { enable_external_access: "false" });
    const connection = await instance.connect();
    try { await connection.run("SELECT 1"); } finally { connection.closeSync(); instance.closeSync(); }
    return;
  }
  if (engine === "libsql") {
    const client = createLibsqlClient({ url: `file:${path}` });
    try { await client.execute("SELECT 1"); } finally { client.close(); }
    return;
  }
  if (engine === "pglite") {
    const client = await PGlite.create(path);
    try { await client.query("SELECT 1"); } finally { await client.close(); }
    return;
  }
  if (engine === "lancedb") {
    const client = await lancedb.connect(path);
    try { await client.tableNames(); } finally { client.close(); }
    return;
  }
  if (engine === "leveldb") {
    const client = new ClassicLevel<string, string>(path, { keyEncoding: "utf8", valueEncoding: "utf8" });
    try { await client.open(); } finally { await client.close(); }
    return;
  }
  if (engine === "redis") {
    await ensureRedis(path);
    const client = createRedisClient({ socket: { path: redisSocket(path), reconnectStrategy: false } });
    client.on("error", () => undefined);
    try { await client.connect(); await client.ping(); } finally { await client.close(); }
    return;
  }
  const database = new KuzuDatabase(path);
  const connection = new KuzuConnection(database);
  try { await connection.init(); const result = await connection.query("RETURN 1 AS ready"); closeKuzuResult(result); } finally { await connection.close(); await database.close(); }
}

export async function executeRuntime(engine: RuntimeEngineId, path: string, request: RuntimeRequest): Promise<unknown> {
  return withRuntimeLock(path, async () => {
    if (engine === "sqlite") throw new Error("Use the SQLite query endpoint for SQLite databases");
    if (engine === "duckdb") return executeDuckDb(path, request);
    if (engine === "libsql") return executeLibsql(path, request);
    if (engine === "pglite") return executePGlite(path, request);
    if (engine === "lancedb") return executeLanceDb(path, request);
    if (engine === "leveldb") return executeLevelDb(path, request);
    if (engine === "redis") return executeRedis(path, request);
    return executeKuzu(path, request);
  });
}

export async function stopRuntime(engine: RuntimeEngineId, path: string): Promise<void> {
  if (engine !== "redis") return;
  try {
    const pid = Number((await readFile(redisPid(path), "utf8")).trim());
    if (Number.isSafeInteger(pid) && pid > 1) process.kill(pid, "SIGTERM");
  } catch {}
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try { await stat(redisSocket(path)); await new Promise((resolve) => setTimeout(resolve, 50)); }
    catch { break; }
  }
  await rm(redisSocket(path), { force: true });
  redisStarts.delete(path);
}

async function executeDuckDb(path: string, request: RuntimeRequest): Promise<unknown> {
  const query = safeSql(requiredString(request.query, "query"), "duckdb");
  const params = optionalArray(request.params, "params");
  const instance = await DuckDBInstance.create(path, { enable_external_access: "false" });
  const connection = await instance.connect();
  try {
    const reader = await connection.runAndReadAll(query, params as never[]);
    return normaliseJson({ columns: reader.columnNames(), rows: reader.getRowObjectsJson(), changes: reader.rowsChanged });
  } finally { connection.closeSync(); instance.closeSync(); }
}

async function executeLibsql(path: string, request: RuntimeRequest): Promise<unknown> {
  const query = safeSql(requiredString(request.query, "query"), "libsql");
  const params = optionalArray(request.params, "params");
  const client = createLibsqlClient({ url: `file:${path}` });
  try {
    const result = await client.execute({ sql: query, args: params as Array<string | number | bigint | boolean | null | Uint8Array> });
    return normaliseJson({ columns: result.columns, rows: Array.from(result.rows, (row) => Object.fromEntries(Object.entries(row))), changes: result.rowsAffected, lastInsertRowid: result.lastInsertRowid });
  } finally { client.close(); }
}

async function executePGlite(path: string, request: RuntimeRequest): Promise<unknown> {
  const query = safeSql(requiredString(request.query, "query"), "pglite");
  const params = optionalArray(request.params, "params");
  const client = await PGlite.create(path);
  try {
    const result = await client.query(query, params);
    return normaliseJson({ columns: result.fields.map((field) => field.name), rows: result.rows, changes: result.affectedRows ?? 0 });
  } finally { await client.close(); }
}

async function executeKuzu(path: string, request: RuntimeRequest): Promise<unknown> {
  const query = safeCypher(requiredString(request.query, "query"));
  const params = optionalRecord(request.params, "params");
  const database = new KuzuDatabase(path);
  const connection = new KuzuConnection(database);
  try {
    await connection.init();
    const result = Object.keys(params).length === 0 ? await connection.query(query) : await connection.execute(await connection.prepare(query), params as never);
    const first = Array.isArray(result) ? result[0] : result;
    if (!first) return { columns: [], rows: [] };
    const rows = await first.getAll();
    const columns = await first.getColumnNames();
    closeKuzuResult(result);
    return normaliseJson({ columns, rows });
  } finally { await connection.close(); await database.close(); }
}

async function executeLevelDb(path: string, request: RuntimeRequest): Promise<unknown> {
  const operation = requiredString(request.operation, "operation");
  const client = new ClassicLevel<string, string>(path, { keyEncoding: "utf8", valueEncoding: "utf8" });
  await client.open();
  try {
    if (operation === "get") return { value: await client.get(requiredString(request.key, "key")) ?? null };
    if (operation === "put") { await client.put(requiredString(request.key, "key"), requiredString(request.value, "value")); return { stored: true }; }
    if (operation === "delete") { await client.del(requiredString(request.key, "key")); return { deleted: true }; }
    if (operation === "scan") {
      const limit = boundedLimit(request.limit);
      const entries: Array<{ key: string; value: string }> = [];
      for await (const [key, value] of client.iterator({ limit })) entries.push({ key, value });
      return { entries };
    }
    throw new Error("LevelDB operation must be get, put, delete, or scan");
  } finally { await client.close(); }
}

async function executeRedis(path: string, request: RuntimeRequest): Promise<unknown> {
  const command = requiredString(request.command, "command").toUpperCase();
  if (!redisReadCommands.has(command) && !redisWriteCommands.has(command)) throw new Error("This Redis command is not enabled through Zo Drive");
  const args = optionalArray(request.args, "args").map((value) => requiredString(value, "Redis argument"));
  await ensureRedis(path);
  const client = createRedisClient({ socket: { path: redisSocket(path), reconnectStrategy: false } });
  client.on("error", () => undefined);
  try { await client.connect(); return normaliseJson(await client.sendCommand([command, ...args])); } finally { await client.close(); }
}

async function executeLanceDb(path: string, request: RuntimeRequest): Promise<unknown> {
  const operation = requiredString(request.operation, "operation");
  const client = await lancedb.connect(path);
  try {
    if (operation === "listTables") return { tables: await client.tableNames() };
    const tableName = safeIdentifier(requiredString(request.table, "table"));
    if (operation === "createTable") {
      const data = recordArray(request.data, "data");
      if (data.length === 0) throw new Error("LanceDB requires at least one row to infer a table schema");
      const table = await client.createTable(tableName, data, { mode: "create", existOk: false });
      table.close();
      return { created: true, table: tableName };
    }
    const table = await client.openTable(tableName);
    try {
      if (operation === "add") { await table.add(recordArray(request.data, "data")); return { added: recordArray(request.data, "data").length }; }
      if (operation === "search") {
        const vector = numberArray(request.vector, "vector");
        return { rows: normaliseJson(await table.vectorSearch(vector).limit(boundedLimit(request.limit)).toArray()) };
      }
      throw new Error("LanceDB operation must be listTables, createTable, add, or search");
    } finally { table.close(); }
  } finally { client.close(); }
}

function safeSql(value: string, engine: "duckdb" | "libsql" | "pglite"): string {
  const query = singleStatement(value);
  if (/^\s*(attach|detach|copy|export|import|install|load|pragma|vacuum|checkpoint|set|reset|create\s+secret|call)\b/i.test(query)) throw new Error("This SQL command is not enabled through Zo Drive");
  if (engine === "duckdb" && /\b(read_csv|read_csv_auto|read_json|read_json_auto|read_parquet|glob)\s*\(/i.test(query)) throw new Error("DuckDB filesystem readers are disabled through Zo Drive");
  return query;
}

function safeCypher(value: string): string {
  const query = singleStatement(value);
  if (/\b(attach|copy|export|import|install|load|call)\b/i.test(query)) throw new Error("This Cypher command is not enabled through Zo Drive");
  return query;
}

function queryIsReadOnly(value: string): boolean {
  const query = value.trim();
  if (/^(select|show|describe|explain|return)\b/i.test(query)) return true;
  return /^match\b/i.test(query) && !/\b(create|delete|drop|merge|remove|set)\b/i.test(query);
}

function singleStatement(value: string): string {
  const query = value.trim().replace(/;\s*$/, "");
  if (!query) throw new Error("Enter a query");
  if (query.length > 50_000) throw new Error("Queries are limited to 50,000 characters");
  if (query.includes(";")) throw new Error("Run one statement at a time");
  return query;
}

async function ensureRedis(path: string): Promise<void> {
  const existing = redisStarts.get(path);
  if (existing) return existing;
  const start = (async () => {
    await mkdir(path, { recursive: true, mode: 0o700 });
    try { await stat(redisSocket(path)); return; } catch {}
    try {
      const pid = Number((await readFile(redisPid(path), "utf8")).trim());
      if (Number.isSafeInteger(pid) && pid > 1) process.kill(pid, "SIGTERM");
    } catch {}
    await rm(redisSocket(path), { force: true });
    await execFileAsync("redis-server", ["--port", "0", "--unixsocket", redisSocket(path), "--unixsocketperm", "700", "--daemonize", "yes", "--dir", path, "--appendonly", "yes", "--pidfile", redisPid(path), "--logfile", join(path, "redis.log")]);
    for (let attempt = 0; attempt < 50; attempt += 1) {
      try { await stat(redisSocket(path)); return; } catch { await new Promise((resolve) => setTimeout(resolve, 100)); }
    }
    throw new Error("Redis did not start within five seconds");
  })();
  redisStarts.set(path, start);
  try { await start; } catch (error) { redisStarts.delete(path); throw error; }
}

function redisSocket(path: string): string { return `/dev/shm/zo-drive-redis-${createHash("sha256").update(path).digest("hex").slice(0, 24)}.sock`; }
function redisPid(path: string): string { return join(path, "redis.pid"); }

function closeKuzuResult(result: { close(): void } | Array<{ close(): void }>): void {
  if (Array.isArray(result)) result.forEach((item) => item.close()); else result.close();
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.length) throw new Error(`${field} must be a non-empty string`);
  if (value.length > 50_000) throw new Error(`${field} is too long`);
  return value;
}

function optionalArray(value: unknown, field: string): unknown[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 1_000) throw new Error(`${field} must be an array of up to 1,000 items`);
  return value;
}

function optionalRecord(value: unknown, field: string): Record<string, unknown> {
  if (value === undefined) return {};
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${field} must be an object`);
  return value as Record<string, unknown>;
}

function recordArray(value: unknown, field: string): Array<Record<string, unknown>> {
  if (!Array.isArray(value) || value.length > 10_000 || value.some((item) => !item || typeof item !== "object" || Array.isArray(item))) throw new Error(`${field} must be an array of up to 10,000 objects`);
  return value as Array<Record<string, unknown>>;
}

function numberArray(value: unknown, field: string): number[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > 8_192 || value.some((item) => typeof item !== "number" || !Number.isFinite(item))) throw new Error(`${field} must be a non-empty array of finite numbers`);
  return value as number[];
}

function safeIdentifier(value: string): string {
  if (!/^[A-Za-z][A-Za-z0-9_-]{0,79}$/.test(value)) throw new Error("table must contain only letters, numbers, underscores, and hyphens");
  return value;
}

function boundedLimit(value: unknown): number {
  if (value === undefined) return 100;
  if (!Number.isSafeInteger(value) || (value as number) < 1 || (value as number) > 1_000) throw new Error("limit must be between 1 and 1,000");
  return value as number;
}

function normaliseJson(value: unknown): unknown {
  if (typeof value === "bigint") return Number.isSafeInteger(Number(value)) ? Number(value) : value.toString();
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Uint8Array) return Buffer.from(value).toString("base64");
  if (ArrayBuffer.isView(value)) return Array.from(value as unknown as ArrayLike<number>);
  if (Array.isArray(value)) return value.map(normaliseJson);
  if (value && typeof value === "object") {
    if ("toJSON" in value && typeof value.toJSON === "function") return normaliseJson(value.toJSON());
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, normaliseJson(item)]));
  }
  return value;
}

async function withRuntimeLock<T>(path: string, action: () => Promise<T>): Promise<T> {
  const previous = runtimeQueues.get(path) ?? Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((resolve) => { release = resolve; });
  const tail = previous.then(() => current);
  runtimeQueues.set(path, tail);
  await previous;
  try { return await action(); }
  finally {
    release();
    if (runtimeQueues.get(path) === tail) runtimeQueues.delete(path);
  }
}
