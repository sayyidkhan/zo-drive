import { randomUUID } from "node:crypto";
import { appendFile, mkdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";

export type AuditEvent = {
  id: string;
  actorUserId: string | null;
  action: string;
  method: string;
  path: string;
  status: number;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
};

export class LocalAuditStore {
  private readonly eventsFile: string;

  constructor({ root }: { root: string }) {
    this.eventsFile = join(root, "v1", "audit", "events.jsonl");
  }

  async record(event: Omit<AuditEvent, "id" | "createdAt">): Promise<void> {
    await mkdir(dirname(this.eventsFile), { recursive: true });
    const stored: AuditEvent = { id: randomUUID(), createdAt: new Date().toISOString(), ...event };
    await appendFile(this.eventsFile, `${JSON.stringify(stored)}\n`, { encoding: "utf8", mode: 0o600 });
  }

  async list(limit = 200): Promise<AuditEvent[]> {
    try {
      const lines = (await readFile(this.eventsFile, "utf8")).trim().split("\n").filter(Boolean);
      return lines.slice(-Math.min(Math.max(limit, 1), 500)).reverse().flatMap((line) => {
        try {
          return [JSON.parse(line) as AuditEvent];
        } catch {
          return [];
        }
      });
    } catch (error: unknown) {
      if (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT") return [];
      throw error;
    }
  }
}
