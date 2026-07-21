import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import { executeRuntime, initialiseRuntime, runtimeRequestIsWrite, stopRuntime, type RuntimeRequest } from "./engine-runtimes.js";

export type DriveDatabase = {
  id: string;
  name: string;
  engine: DatabaseEngineId;
  createdAt: string;
  updatedAt: string;
  sizeBytes: number;
};

export type DatabaseTable = {
  name: string;
  schema: string;
};

export type DatabaseRows = {
  columns: string[];
  rows: Array<Record<string, unknown>>;
  total: number;
};

export type DatabaseQueryResult = {
  columns: string[];
  rows: Array<Record<string, unknown>>;
  changes: number;
  lastInsertRowid: number | null;
};

type StoredDatabase = Omit<DriveDatabase, "sizeBytes">;
type StoredDatabases = { databases: StoredDatabase[] };

export class DatabaseQueryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DatabaseQueryError";
  }
}

export class DatabaseImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DatabaseImportError";
  }
}

export const DEFAULT_DATABASE_IMPORT_LIMIT_BYTES = 100 * 1024 * 1024;
export const MIN_DATABASE_IMPORT_LIMIT_BYTES = 1 * 1024 * 1024;

export type DatabaseImportSettings = {
  importLimitBytes: number;
  minImportLimitBytes: number;
  maxImportLimitBytes: number;
};

export const databaseEngineDefinitions = [
  { engine: "sqlite", name: "SQLite", packageName: "better-sqlite3", availableVersion: "12.11.1", protocol: "sql", workspaceAvailable: true },
  { engine: "duckdb", name: "DuckDB", packageName: "@duckdb/node-api", availableVersion: "1.5.4-r.1", protocol: "sql", workspaceAvailable: true },
  { engine: "libsql", name: "libSQL", packageName: "@libsql/client", availableVersion: "0.17.4", protocol: "sql", workspaceAvailable: true },
  { engine: "pglite", name: "PGlite", packageName: "@electric-sql/pglite", availableVersion: "0.5.4", protocol: "sql", workspaceAvailable: true },
  { engine: "lancedb", name: "LanceDB", packageName: "@lancedb/lancedb", availableVersion: "0.31.0", protocol: "vector", workspaceAvailable: true },
  { engine: "leveldb", name: "LevelDB", packageName: "classic-level", availableVersion: "3.0.0", protocol: "key-value", workspaceAvailable: true },
  { engine: "redis", name: "Redis", packageName: "redis + redis-server", availableVersion: "7.0.15", protocol: "redis", workspaceAvailable: true },
  { engine: "kuzu", name: "Kuzu", packageName: "kuzu", availableVersion: "0.11.3", protocol: "cypher", workspaceAvailable: true }
] as const;

export type DatabaseEngineId = typeof databaseEngineDefinitions[number]["engine"];

export function isDatabaseEngineId(value: string): value is DatabaseEngineId {
  return databaseEngineDefinitions.some((engine) => engine.engine === value);
}

export type DatabaseEngineInstallation = {
  engine: DatabaseEngineId;
  name: string;
  installed: boolean;
  installedAt: string | null;
  installedVersion: string | null;
  updatedAt: string | null;
  updateAvailable: boolean;
  workspaceAvailable: boolean;
};

type StoredDatabaseEngines = Partial<Record<DatabaseEngineId, { installedAt: string; installedVersion?: string; updatedAt?: string }>>;

export class DatabaseEngineNotInstalledError extends Error {
  constructor(engine: DatabaseEngineId = "sqlite") {
    const name = databaseEngineDefinitions.find((candidate) => candidate.engine === engine)?.name ?? engine;
    super(`Install ${name} before creating or using databases`);
    this.name = "DatabaseEngineNotInstalledError";
  }
}

export class LocalDatabaseStore {
  constructor(private readonly root: string, private readonly verifyRuntimes = process.env.NODE_ENV !== "test") {}

  async listEngines(ownerUserId: string): Promise<DatabaseEngineInstallation[]> {
    const stored = await this.readEngines(ownerUserId);
    const sqliteInstalledAt = await this.sqliteInstalledAt(ownerUserId);
    return databaseEngineDefinitions.map((definition) => {
      const installedAt = definition.engine === "sqlite" ? stored.sqlite?.installedAt ?? sqliteInstalledAt : stored[definition.engine]?.installedAt ?? null;
      const metadata = stored[definition.engine];
      const installedVersion = installedAt ? metadata?.installedVersion ?? null : null;
      return { ...definition, installed: Boolean(installedAt), installedAt, installedVersion, updatedAt: installedAt ? metadata?.updatedAt ?? installedAt : null, updateAvailable: Boolean(installedAt && installedVersion !== definition.availableVersion) };
    });
  }

  async installEngine({ ownerUserId, engine }: { ownerUserId: string; engine: DatabaseEngineId }): Promise<DatabaseEngineInstallation> {
    const definition = databaseEngineDefinitions.find((candidate) => candidate.engine === engine);
    if (!definition) throw new Error("Unsupported database engine");
    const engines = await this.readEngines(ownerUserId);
    const installedAt = engines[engine]?.installedAt ?? new Date().toISOString();
    const updatedAt = new Date().toISOString();
    if (this.verifyRuntimes) await this.verifyRuntime(ownerUserId, engine);
    await this.writeEngines(ownerUserId, { ...engines, [engine]: { installedAt, installedVersion: definition.availableVersion, updatedAt } });
    return { ...definition, installed: true, installedAt, installedVersion: definition.availableVersion, updatedAt, updateAvailable: false };
  }

  async updateEngine({ ownerUserId, engine }: { ownerUserId: string; engine: DatabaseEngineId }): Promise<DatabaseEngineInstallation> {
    if (!(await this.listEngines(ownerUserId)).some((candidate) => candidate.engine === engine && candidate.installed)) throw new DatabaseEngineNotInstalledError(engine);
    return this.installEngine({ ownerUserId, engine });
  }

  async requireEngineInstalled(ownerUserId: string, engine: DatabaseEngineId = "sqlite"): Promise<void> {
    if (!(await this.listEngines(ownerUserId)).some((candidate) => candidate.engine === engine && candidate.installed)) throw new DatabaseEngineNotInstalledError(engine);
  }

  async list(ownerUserId: string): Promise<DriveDatabase[]> {
    const stored = await this.read(ownerUserId);
    return Promise.all(stored.databases
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
      .map(async (database) => ({ ...database, sizeBytes: await this.sizeBytes(ownerUserId, database) })));
  }

  async create({ ownerUserId, name, engine = "sqlite" }: { ownerUserId: string; name: string; engine?: DatabaseEngineId }): Promise<DriveDatabase> {
    await this.requireEngineInstalled(ownerUserId, engine);
    const stored = await this.read(ownerUserId);
    if (stored.databases.some((database) => database.name.toLocaleLowerCase() === name.toLocaleLowerCase())) {
      throw Object.assign(new Error("A database with this name already exists"), { code: "EEXIST" });
    }
    const now = new Date().toISOString();
    const database: StoredDatabase = { id: randomUUID(), name, engine, createdAt: now, updatedAt: now };
    const filePath = this.databasePath(ownerUserId, database);
    await mkdir(dirname(filePath), { recursive: true });
    if (engine === "sqlite") {
      const sqlite = new Database(filePath);
      try { sqlite.pragma("journal_mode = WAL"); sqlite.pragma("foreign_keys = ON"); } finally { sqlite.close(); }
    } else await initialiseRuntime(engine, filePath);
    stored.databases.push(database);
    await this.write(ownerUserId, stored);
    return { ...database, sizeBytes: await this.sizeBytes(ownerUserId, database) };
  }

  async getImportSettings({ ownerUserId, maxImportLimitBytes }: { ownerUserId: string; maxImportLimitBytes: number }): Promise<DatabaseImportSettings> {
    const maximum = Math.max(MIN_DATABASE_IMPORT_LIMIT_BYTES, maxImportLimitBytes);
    const stored = await this.readImportSettings(ownerUserId);
    return {
      importLimitBytes: Math.min(stored?.importLimitBytes ?? DEFAULT_DATABASE_IMPORT_LIMIT_BYTES, maximum),
      minImportLimitBytes: MIN_DATABASE_IMPORT_LIMIT_BYTES,
      maxImportLimitBytes: maximum
    };
  }

  async setImportLimit({ ownerUserId, importLimitBytes, maxImportLimitBytes }: { ownerUserId: string; importLimitBytes: number; maxImportLimitBytes: number }): Promise<DatabaseImportSettings> {
    const maximum = Math.max(MIN_DATABASE_IMPORT_LIMIT_BYTES, maxImportLimitBytes);
    if (!Number.isSafeInteger(importLimitBytes) || importLimitBytes < MIN_DATABASE_IMPORT_LIMIT_BYTES || importLimitBytes > maximum) {
      throw new DatabaseImportError(`Import limit must be between ${MIN_DATABASE_IMPORT_LIMIT_BYTES} and ${maximum} bytes`);
    }
    await this.writeImportSettings(ownerUserId, { importLimitBytes });
    return { importLimitBytes, minImportLimitBytes: MIN_DATABASE_IMPORT_LIMIT_BYTES, maxImportLimitBytes: maximum };
  }

  async import({ ownerUserId, name, bytes, importLimitBytes }: { ownerUserId: string; name: string; bytes: Uint8Array; importLimitBytes: number }): Promise<DriveDatabase> {
    await this.requireEngineInstalled(ownerUserId);
    if (bytes.byteLength === 0) throw new DatabaseImportError("Choose a SQLite database file to import");
    if (bytes.byteLength > importLimitBytes) throw new DatabaseImportError("This SQLite file exceeds your configured import limit");
    const stored = await this.read(ownerUserId);
    if (stored.databases.some((database) => database.name.toLocaleLowerCase() === name.toLocaleLowerCase())) {
      throw Object.assign(new Error("A database with this name already exists"), { code: "EEXIST" });
    }
    const now = new Date().toISOString();
    const database: StoredDatabase = { id: randomUUID(), name, engine: "sqlite", createdAt: now, updatedAt: now };
    const filePath = this.databasePath(ownerUserId, database);
    const temporaryPath = `${filePath}.${randomUUID()}.import`;
    await mkdir(dirname(filePath), { recursive: true });
    try {
      await writeFile(temporaryPath, bytes, { mode: 0o600 });
      const sqlite = new Database(temporaryPath, { fileMustExist: true, readonly: true });
      try {
        if (sqlite.pragma("quick_check(1)", { simple: true }) !== "ok") throw new DatabaseImportError("The file is not a valid SQLite database");
      } catch (error) {
        if (error instanceof DatabaseImportError) throw error;
        throw new DatabaseImportError("The file is not a valid SQLite database");
      } finally {
        sqlite.close();
      }
      await rename(temporaryPath, filePath);
      stored.databases.push(database);
      await this.write(ownerUserId, stored);
      return { ...database, sizeBytes: await this.sizeBytes(ownerUserId, database) };
    } catch (error) {
      await rm(temporaryPath, { force: true });
      throw error;
    }
  }

  async export({ ownerUserId, id }: { ownerUserId: string; id: string }): Promise<{ bytes: Uint8Array; database: DriveDatabase }> {
    const stored = await this.read(ownerUserId);
    const database = stored.databases.find((candidate) => candidate.id === id);
    if (!database) throw Object.assign(new Error("Database not found"), { code: "ENOENT" });
    if (database.engine !== "sqlite") throw new DatabaseQueryError("Only SQLite databases can be exported as .sqlite files");
    const filePath = this.databasePath(ownerUserId, database);
    const sqlite = new Database(filePath, { fileMustExist: true });
    try {
      sqlite.pragma("wal_checkpoint(TRUNCATE)");
    } finally {
      sqlite.close();
    }
    return { bytes: await readFile(filePath), database: { ...database, sizeBytes: await this.sizeBytes(ownerUserId, database) } };
  }

  async remove({ ownerUserId, id }: { ownerUserId: string; id: string }): Promise<boolean> {
    const stored = await this.read(ownerUserId);
    const index = stored.databases.findIndex((database) => database.id === id);
    if (index === -1) return false;
    const [database] = stored.databases.splice(index, 1);
    if (!database) return false;
    await this.write(ownerUserId, stored);
    const filePath = this.databasePath(ownerUserId, database);
    await stopRuntime(database.engine, filePath);
    await Promise.all([rm(filePath, { force: true, recursive: true }), rm(`${filePath}-wal`, { force: true }), rm(`${filePath}-shm`, { force: true })]);
    return true;
  }

  async listTables({ ownerUserId, id }: { ownerUserId: string; id: string }): Promise<DatabaseTable[]> {
    return this.withDatabase(ownerUserId, id, (sqlite) => sqlite.prepare("SELECT name, COALESCE(sql, '') AS schema FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all() as DatabaseTable[]);
  }

  async listRows({ ownerUserId, id, table, limit, offset }: { ownerUserId: string; id: string; table: string; limit: number; offset: number }): Promise<DatabaseRows> {
    return this.withDatabase(ownerUserId, id, (sqlite) => {
      this.requireTable(sqlite, table);
      const quotedTable = quoteIdentifier(table);
      const rows = sqlite.prepare(`SELECT * FROM ${quotedTable} LIMIT ? OFFSET ?`).all(limit, offset) as Array<Record<string, unknown>>;
      const total = (sqlite.prepare(`SELECT COUNT(*) AS total FROM ${quotedTable}`).get() as { total: number }).total;
      const columns = rows[0] ? Object.keys(rows[0]) : (sqlite.prepare(`PRAGMA table_info(${quotedTable})`).all() as Array<{ name: string }>).map((column) => column.name);
      return { columns, rows, total };
    });
  }

  async query({ ownerUserId, id, sql, params }: { ownerUserId: string; id: string; sql: string; params: Array<string | number | boolean | null> }): Promise<DatabaseQueryResult> {
    const normalizedSql = validateSql(sql);
    return this.withDatabase(ownerUserId, id, (sqlite) => {
      const statement = sqlite.prepare(normalizedSql);
      if (statement.reader) {
        const rows = statement.all(...params) as Array<Record<string, unknown>>;
        return { columns: rows[0] ? Object.keys(rows[0]) : statement.columns().map((column) => column.name), rows: rows.slice(0, 1_000), changes: 0, lastInsertRowid: null };
      }
      const result = statement.run(...params);
      return { columns: [], rows: [], changes: result.changes, lastInsertRowid: result.lastInsertRowid === 0 ? null : Number(result.lastInsertRowid) };
    }, true);
  }

  async execute({ ownerUserId, id, request }: { ownerUserId: string; id: string; request: RuntimeRequest }): Promise<{ engine: DatabaseEngineId; result: unknown }> {
    const stored = await this.read(ownerUserId);
    const database = stored.databases.find((candidate) => candidate.id === id);
    if (!database) throw Object.assign(new Error("Database not found"), { code: "ENOENT" });
    await this.requireEngineInstalled(ownerUserId, database.engine);
    let result: unknown;
    try { result = await executeRuntime(database.engine, this.databasePath(ownerUserId, database), request); }
    catch (error) { throw new DatabaseQueryError(error instanceof Error ? error.message : "The database request failed"); }
    if (runtimeRequestIsWrite(database.engine, request)) {
      database.updatedAt = new Date().toISOString();
      await this.write(ownerUserId, stored);
    }
    return { engine: database.engine, result };
  }

  async get({ ownerUserId, id }: { ownerUserId: string; id: string }): Promise<DriveDatabase> {
    const database = (await this.read(ownerUserId)).databases.find((candidate) => candidate.id === id);
    if (!database) throw Object.assign(new Error("Database not found"), { code: "ENOENT" });
    return { ...database, sizeBytes: await this.sizeBytes(ownerUserId, database) };
  }

  async renameOwner({ fromUserId, toUserId }: { fromUserId: string; toUserId: string }): Promise<void> {
    const from = this.ownerDirectory(fromUserId);
    const to = this.ownerDirectory(toUserId);
    try {
      await this.stopOwnerRuntimes(fromUserId);
      await mkdir(dirname(to), { recursive: true });
      await rename(from, to);
    } catch (error: unknown) {
      if (!(typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT")) throw error;
    }
  }

  async removeByOwner(ownerUserId: string): Promise<void> {
    await this.stopOwnerRuntimes(ownerUserId);
    await rm(this.ownerDirectory(ownerUserId), { force: true, recursive: true });
  }

  private async stopOwnerRuntimes(ownerUserId: string): Promise<void> {
    const stored = await this.read(ownerUserId);
    await Promise.all(stored.databases.map((database) => stopRuntime(database.engine, this.databasePath(ownerUserId, database))));
  }

  private async withDatabase<T>(ownerUserId: string, id: string, action: (sqlite: Database.Database) => T, changed = false): Promise<T> {
    const stored = await this.read(ownerUserId);
    const database = stored.databases.find((candidate) => candidate.id === id);
    if (!database) throw Object.assign(new Error("Database not found"), { code: "ENOENT" });
    if (database.engine !== "sqlite") throw new DatabaseQueryError("The table workspace is available only for SQLite databases");
    await this.requireEngineInstalled(ownerUserId, "sqlite");
    const sqlite = new Database(this.databasePath(ownerUserId, database));
    try {
      sqlite.pragma("foreign_keys = ON");
      const result = action(sqlite);
      if (changed) {
        database.updatedAt = new Date().toISOString();
        await this.write(ownerUserId, stored);
      }
      return result;
    } finally {
      sqlite.close();
    }
  }

  private requireTable(sqlite: Database.Database, table: string): void {
    const result = sqlite.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(table);
    if (!result) throw Object.assign(new Error("Table not found"), { code: "ENOENT" });
  }

  private async read(ownerUserId: string): Promise<StoredDatabases> {
    try {
      const parsed = JSON.parse(await readFile(this.registryPath(ownerUserId), "utf8")) as StoredDatabases;
      return Array.isArray(parsed.databases) ? parsed : { databases: [] };
    } catch (error: unknown) {
      if (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT") return { databases: [] };
      throw error;
    }
  }

  private async write(ownerUserId: string, data: StoredDatabases): Promise<void> {
    const path = this.registryPath(ownerUserId);
    await mkdir(dirname(path), { recursive: true });
    const temporary = `${path}.${randomUUID()}.tmp`;
    await writeFile(temporary, JSON.stringify(data, null, 2), { encoding: "utf8", mode: 0o600 });
    await rename(temporary, path);
  }

  private async sizeBytes(ownerUserId: string, database: StoredDatabase): Promise<number> {
    const filePath = this.databasePath(ownerUserId, database);
    return (await Promise.all([filePath, `${filePath}-wal`].map((path) => directorySize(path)))).reduce((total, size) => total + size, 0);
  }

  private ownerDirectory(ownerUserId: string): string {
    return join(this.root, "v1", "databases", ownerUserId);
  }

  private registryPath(ownerUserId: string): string {
    return join(this.ownerDirectory(ownerUserId), "databases.json");
  }

  private importSettingsPath(ownerUserId: string): string {
    return join(this.ownerDirectory(ownerUserId), "settings.json");
  }

  private enginesPath(ownerUserId: string): string {
    return join(this.ownerDirectory(ownerUserId), "engines.json");
  }

  private async sqliteInstalledAt(ownerUserId: string): Promise<string | null> {
    const engines = await this.readEngines(ownerUserId);
    if (engines.sqlite?.installedAt) return engines.sqlite.installedAt;
    const databases = await this.read(ownerUserId);
    return databases.databases.find((database) => database.engine === "sqlite")?.createdAt ?? null;
  }

  private async readEngines(ownerUserId: string): Promise<StoredDatabaseEngines> {
    try {
      const parsed = JSON.parse(await readFile(this.enginesPath(ownerUserId), "utf8")) as StoredDatabaseEngines;
      return Object.fromEntries(Object.entries(parsed).filter(([engine, value]) => isDatabaseEngineId(engine) && typeof value?.installedAt === "string")) as StoredDatabaseEngines;
    } catch (error: unknown) {
      if (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT") return {};
      throw error;
    }
  }

  private async writeEngines(ownerUserId: string, engines: StoredDatabaseEngines): Promise<void> {
    const path = this.enginesPath(ownerUserId);
    await mkdir(dirname(path), { recursive: true });
    const temporary = `${path}.${randomUUID()}.tmp`;
    await writeFile(temporary, JSON.stringify(engines, null, 2), { encoding: "utf8", mode: 0o600 });
    await rename(temporary, path);
  }

  private async readImportSettings(ownerUserId: string): Promise<{ importLimitBytes: number } | null> {
    try {
      const parsed = JSON.parse(await readFile(this.importSettingsPath(ownerUserId), "utf8")) as { importLimitBytes?: unknown };
      return typeof parsed.importLimitBytes === "number" && Number.isSafeInteger(parsed.importLimitBytes) && parsed.importLimitBytes >= MIN_DATABASE_IMPORT_LIMIT_BYTES ? { importLimitBytes: parsed.importLimitBytes } : null;
    } catch (error: unknown) {
      if (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT") return null;
      throw error;
    }
  }

  private async writeImportSettings(ownerUserId: string, settings: { importLimitBytes: number }): Promise<void> {
    const path = this.importSettingsPath(ownerUserId);
    await mkdir(dirname(path), { recursive: true });
    const temporary = `${path}.${randomUUID()}.tmp`;
    await writeFile(temporary, JSON.stringify(settings), { encoding: "utf8", mode: 0o600 });
    await rename(temporary, path);
  }

  private databasePath(ownerUserId: string, database: Pick<StoredDatabase, "engine" | "id">): string {
    if (database.engine === "sqlite") return join(this.ownerDirectory(ownerUserId), `${database.id}.sqlite`);
    const extension: Record<DatabaseEngineId, string> = { sqlite: ".sqlite", duckdb: ".duckdb", libsql: ".libsql", pglite: ".pglite", lancedb: ".lancedb", leveldb: ".leveldb", redis: ".redis", kuzu: ".kuzu" };
    return join(this.ownerDirectory(ownerUserId), "instances", `${database.id}${extension[database.engine]}`);
  }

  private async verifyRuntime(ownerUserId: string, engine: DatabaseEngineId): Promise<void> {
    const database = { id: `_runtime-${engine}`, engine };
    const path = this.databasePath(ownerUserId, database);
    await rm(path, { force: true, recursive: true });
    try {
      if (engine === "sqlite") {
        await mkdir(dirname(path), { recursive: true });
        const sqlite = new Database(path);
        try { sqlite.prepare("SELECT 1").get(); } finally { sqlite.close(); }
      } else await initialiseRuntime(engine, path);
    } finally {
      await stopRuntime(engine, path);
      await Promise.all([rm(path, { force: true, recursive: true }), rm(`${path}-wal`, { force: true }), rm(`${path}-shm`, { force: true })]);
    }
  }
}

async function directorySize(path: string): Promise<number> {
  try {
    const info = await stat(path);
    if (info.isFile()) return info.size;
    if (!info.isDirectory()) return 0;
    const entries = await readdir(path, { withFileTypes: true });
    return (await Promise.all(entries.map((entry) => directorySize(join(path, entry.name))))).reduce((total, size) => total + size, 0);
  } catch (error: unknown) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT") return 0;
    throw error;
  }
}

function quoteIdentifier(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

function validateSql(sql: string): string {
  const normalized = sql.trim().replace(/;\s*$/, "");
  if (!normalized) throw new DatabaseQueryError("Enter a SQL statement");
  if (normalized.length > 50_000) throw new DatabaseQueryError("SQL statements are limited to 50,000 characters");
  if (normalized.includes(";")) throw new DatabaseQueryError("Run one SQL statement at a time");
  if (/^\s*(attach|detach|pragma|vacuum|load_extension|begin|commit|rollback)\b/i.test(normalized)) {
    throw new DatabaseQueryError("This SQL command is not supported through Zo Drive");
  }
  return normalized;
}
