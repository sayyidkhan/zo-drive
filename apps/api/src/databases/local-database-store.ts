import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

export type DriveDatabase = {
  id: string;
  name: string;
  engine: "sqlite";
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

export const MAX_DATABASE_IMPORT_BYTES = 100 * 1024 * 1024;

export class LocalDatabaseStore {
  constructor(private readonly root: string) {}

  async list(ownerUserId: string): Promise<DriveDatabase[]> {
    const stored = await this.read(ownerUserId);
    return Promise.all(stored.databases
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
      .map(async (database) => ({ ...database, sizeBytes: await this.sizeBytes(ownerUserId, database.id) })));
  }

  async create({ ownerUserId, name }: { ownerUserId: string; name: string }): Promise<DriveDatabase> {
    const stored = await this.read(ownerUserId);
    if (stored.databases.some((database) => database.name.toLocaleLowerCase() === name.toLocaleLowerCase())) {
      throw Object.assign(new Error("A database with this name already exists"), { code: "EEXIST" });
    }
    const now = new Date().toISOString();
    const database: StoredDatabase = { id: randomUUID(), name, engine: "sqlite", createdAt: now, updatedAt: now };
    const filePath = this.databasePath(ownerUserId, database.id);
    await mkdir(dirname(filePath), { recursive: true });
    const sqlite = new Database(filePath);
    try {
      sqlite.pragma("journal_mode = WAL");
      sqlite.pragma("foreign_keys = ON");
    } finally {
      sqlite.close();
    }
    stored.databases.push(database);
    await this.write(ownerUserId, stored);
    return { ...database, sizeBytes: await this.sizeBytes(ownerUserId, database.id) };
  }

  async import({ ownerUserId, name, bytes }: { ownerUserId: string; name: string; bytes: Uint8Array }): Promise<DriveDatabase> {
    if (bytes.byteLength === 0) throw new DatabaseImportError("Choose a SQLite database file to import");
    if (bytes.byteLength > MAX_DATABASE_IMPORT_BYTES) throw new DatabaseImportError("SQLite imports are limited to 100 MB");
    const stored = await this.read(ownerUserId);
    if (stored.databases.some((database) => database.name.toLocaleLowerCase() === name.toLocaleLowerCase())) {
      throw Object.assign(new Error("A database with this name already exists"), { code: "EEXIST" });
    }
    const now = new Date().toISOString();
    const database: StoredDatabase = { id: randomUUID(), name, engine: "sqlite", createdAt: now, updatedAt: now };
    const filePath = this.databasePath(ownerUserId, database.id);
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
      return { ...database, sizeBytes: await this.sizeBytes(ownerUserId, database.id) };
    } catch (error) {
      await rm(temporaryPath, { force: true });
      throw error;
    }
  }

  async export({ ownerUserId, id }: { ownerUserId: string; id: string }): Promise<{ bytes: Uint8Array; database: DriveDatabase }> {
    const stored = await this.read(ownerUserId);
    const database = stored.databases.find((candidate) => candidate.id === id);
    if (!database) throw Object.assign(new Error("Database not found"), { code: "ENOENT" });
    const filePath = this.databasePath(ownerUserId, id);
    const sqlite = new Database(filePath, { fileMustExist: true });
    try {
      sqlite.pragma("wal_checkpoint(TRUNCATE)");
    } finally {
      sqlite.close();
    }
    return { bytes: await readFile(filePath), database: { ...database, sizeBytes: await this.sizeBytes(ownerUserId, id) } };
  }

  async remove({ ownerUserId, id }: { ownerUserId: string; id: string }): Promise<boolean> {
    const stored = await this.read(ownerUserId);
    const index = stored.databases.findIndex((database) => database.id === id);
    if (index === -1) return false;
    stored.databases.splice(index, 1);
    await this.write(ownerUserId, stored);
    const filePath = this.databasePath(ownerUserId, id);
    await Promise.all([rm(filePath, { force: true }), rm(`${filePath}-wal`, { force: true }), rm(`${filePath}-shm`, { force: true })]);
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

  async renameOwner({ fromUserId, toUserId }: { fromUserId: string; toUserId: string }): Promise<void> {
    const from = this.ownerDirectory(fromUserId);
    const to = this.ownerDirectory(toUserId);
    try {
      await mkdir(dirname(to), { recursive: true });
      await rename(from, to);
    } catch (error: unknown) {
      if (!(typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT")) throw error;
    }
  }

  async removeByOwner(ownerUserId: string): Promise<void> {
    await rm(this.ownerDirectory(ownerUserId), { force: true, recursive: true });
  }

  private async withDatabase<T>(ownerUserId: string, id: string, action: (sqlite: Database.Database) => T, changed = false): Promise<T> {
    const stored = await this.read(ownerUserId);
    const database = stored.databases.find((candidate) => candidate.id === id);
    if (!database) throw Object.assign(new Error("Database not found"), { code: "ENOENT" });
    const sqlite = new Database(this.databasePath(ownerUserId, id));
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

  private async sizeBytes(ownerUserId: string, id: string): Promise<number> {
    const filePath = this.databasePath(ownerUserId, id);
    const files = [filePath, `${filePath}-wal`];
    const sizes = await Promise.all(files.map(async (file) => {
      try { return (await stat(file)).size; } catch { return 0; }
    }));
    return sizes.reduce((total, size) => total + size, 0);
  }

  private ownerDirectory(ownerUserId: string): string {
    return join(this.root, "v1", "databases", ownerUserId);
  }

  private registryPath(ownerUserId: string): string {
    return join(this.ownerDirectory(ownerUserId), "databases.json");
  }

  private databasePath(ownerUserId: string, id: string): string {
    return join(this.ownerDirectory(ownerUserId), `${id}.sqlite`);
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
