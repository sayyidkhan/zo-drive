import { randomUUID } from "node:crypto";
import { mkdir, readdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { spawn } from "node:child_process";

export type FunctionRuntime = "javascript" | "python";
export type FunctionVisibility = "private" | "public";
export type FunctionStatus = "success" | "error" | "timeout";
export type FunctionTrigger = "manual" | "public" | "schedule";

export type DriveFunction = {
  id: string;
  name: string;
  runtime: FunctionRuntime;
  source: string;
  visibility: FunctionVisibility;
  cron: string | null;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  lastRunAt: string | null;
  lastRunStatus: FunctionStatus | null;
};

export type DriveFunctionRun = {
  id: string;
  functionId: string;
  startedAt: string;
  finishedAt: string;
  status: FunctionStatus;
  output: unknown | null;
  logs: string;
  trigger: FunctionTrigger;
};

type StoredFunctions = { functions: DriveFunction[]; runs: DriveFunctionRun[] };
const MAX_RUNS = 30;
const MAX_OUTPUT_BYTES = 256 * 1024;
const RUN_TIMEOUT_MS = 5_000;

export class LocalFunctionStore {
  constructor(private readonly root: string) {}

  async list(ownerUserId: string): Promise<DriveFunction[]> {
    return (await this.read(ownerUserId)).functions.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }

  async create({ ownerUserId, name, runtime, source, visibility, cron, enabled }: Omit<DriveFunction, "id" | "createdAt" | "updatedAt" | "lastRunAt" | "lastRunStatus"> & { ownerUserId: string }): Promise<DriveFunction> {
    const stored = await this.read(ownerUserId);
    const now = new Date().toISOString();
    const fn: DriveFunction = { id: randomUUID(), name, runtime, source, visibility, cron, enabled, createdAt: now, updatedAt: now, lastRunAt: null, lastRunStatus: null };
    stored.functions.push(fn);
    await this.write(ownerUserId, stored);
    return fn;
  }

  async update({ ownerUserId, id, changes }: { ownerUserId: string; id: string; changes: Partial<Pick<DriveFunction, "name" | "runtime" | "source" | "visibility" | "cron" | "enabled">> }): Promise<DriveFunction | null> {
    const stored = await this.read(ownerUserId);
    const fn = stored.functions.find((candidate) => candidate.id === id);
    if (!fn) return null;
    Object.assign(fn, changes, { updatedAt: new Date().toISOString() });
    await this.write(ownerUserId, stored);
    return fn;
  }

  async remove({ ownerUserId, id }: { ownerUserId: string; id: string }): Promise<boolean> {
    const stored = await this.read(ownerUserId);
    const index = stored.functions.findIndex((candidate) => candidate.id === id);
    if (index === -1) return false;
    stored.functions.splice(index, 1);
    stored.runs = stored.runs.filter((run) => run.functionId !== id);
    await this.write(ownerUserId, stored);
    return true;
  }

  async find({ ownerUserId, id }: { ownerUserId: string; id: string }): Promise<DriveFunction | null> {
    return (await this.read(ownerUserId)).functions.find((candidate) => candidate.id === id) ?? null;
  }

  async findPublic(id: string): Promise<{ ownerUserId: string; fn: DriveFunction } | null> {
    for (const ownerUserId of await this.ownerIds()) {
      const fn = (await this.read(ownerUserId)).functions.find((candidate) => candidate.id === id && candidate.visibility === "public" && candidate.enabled);
      if (fn) return { ownerUserId, fn };
    }
    return null;
  }

  async listRuns({ ownerUserId, functionId }: { ownerUserId: string; functionId: string }): Promise<DriveFunctionRun[]> {
    return (await this.read(ownerUserId)).runs.filter((run) => run.functionId === functionId).sort((left, right) => right.startedAt.localeCompare(left.startedAt));
  }

  async run({ ownerUserId, id, input, trigger }: { ownerUserId: string; id: string; input: unknown; trigger: FunctionTrigger }): Promise<DriveFunctionRun | null> {
    const stored = await this.read(ownerUserId);
    const fn = stored.functions.find((candidate) => candidate.id === id);
    if (!fn) return null;
    const run = await executeFunction(fn, input, trigger);
    stored.runs = [run, ...stored.runs].slice(0, MAX_RUNS);
    fn.lastRunAt = run.finishedAt;
    fn.lastRunStatus = run.status;
    fn.updatedAt = run.finishedAt;
    await this.write(ownerUserId, stored);
    return run;
  }

  async runDue(now = new Date()): Promise<void> {
    for (const ownerUserId of await this.ownerIds()) {
      const stored = await this.read(ownerUserId);
      const due = stored.functions.filter((fn) => fn.enabled && fn.cron && cronMatches(fn.cron, now) && fn.lastRunAt?.slice(0, 16) !== now.toISOString().slice(0, 16));
      for (const fn of due) await this.run({ ownerUserId, id: fn.id, input: { scheduledAt: now.toISOString() }, trigger: "schedule" });
    }
  }

  async renameOwner({ fromUserId, toUserId }: { fromUserId: string; toUserId: string }): Promise<void> {
    try { await mkdir(join(this.root, "v1", "functions"), { recursive: true }); await rename(this.ownerDirectory(fromUserId), this.ownerDirectory(toUserId)); } catch (error: unknown) { if (!(typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT")) throw error; }
  }

  async removeByOwner(ownerUserId: string): Promise<void> {
    const { rm } = await import("node:fs/promises");
    await rm(this.ownerDirectory(ownerUserId), { force: true, recursive: true });
  }

  private ownerDirectory(ownerUserId: string): string { return join(this.root, "v1", "functions", ownerUserId); }
  private registryPath(ownerUserId: string): string { return join(this.ownerDirectory(ownerUserId), "functions.json"); }

  private async ownerIds(): Promise<string[]> {
    try { return (await readdir(join(this.root, "v1", "functions"), { withFileTypes: true })).filter((entry) => entry.isDirectory()).map((entry) => entry.name); } catch (error: unknown) { if (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT") return []; throw error; }
  }

  private async read(ownerUserId: string): Promise<StoredFunctions> {
    try {
      const parsed = JSON.parse(await readFile(this.registryPath(ownerUserId), "utf8")) as Partial<StoredFunctions>;
      return { functions: Array.isArray(parsed.functions) ? parsed.functions : [], runs: Array.isArray(parsed.runs) ? parsed.runs : [] };
    } catch (error: unknown) {
      if (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT") return { functions: [], runs: [] };
      throw error;
    }
  }

  private async write(ownerUserId: string, stored: StoredFunctions): Promise<void> {
    const path = this.registryPath(ownerUserId);
    await mkdir(this.ownerDirectory(ownerUserId), { recursive: true });
    const temporary = `${path}.${randomUUID()}.tmp`;
    await writeFile(temporary, JSON.stringify(stored, null, 2), { encoding: "utf8", mode: 0o600 });
    await rename(temporary, path);
  }
}

async function executeFunction(fn: DriveFunction, input: unknown, trigger: FunctionTrigger): Promise<DriveFunctionRun> {
  const startedAt = new Date().toISOString();
  const command = fn.runtime === "javascript" ? process.execPath : "python3";
  const script = fn.runtime === "javascript" ? javascriptRunner(fn.source) : pythonRunner(fn.source);
  const result = await runProcess(command, fn.runtime === "javascript" ? ["--input-type=module", "-e", script] : ["-c", script], JSON.stringify(input ?? {}));
  const finishedAt = new Date().toISOString();
  let output: unknown = null;
  if (result.status === "success") {
    try { output = JSON.parse(result.stdout); } catch { return { id: randomUUID(), functionId: fn.id, startedAt, finishedAt, status: "error", output: null, logs: `${result.logs}\nFunction must return JSON-serialisable data.`.trim(), trigger }; }
  }
  return { id: randomUUID(), functionId: fn.id, startedAt, finishedAt, status: result.status, output, logs: result.logs, trigger };
}

function javascriptRunner(source: string): string {
  return `const source = ${JSON.stringify(source)}; const mod = await import("data:text/javascript;base64," + Buffer.from(source).toString("base64")); const handler = mod.default ?? mod.handler; if (typeof handler !== "function") throw new Error("Export a default async function or named handler"); const input = JSON.parse(await new Response(process.stdin).text() || "{}"); process.stdout.write(JSON.stringify(await handler(input)));`;
}

function pythonRunner(source: string): string {
  return `import json,sys\nsource=${JSON.stringify(source)}\nns={}\nexec(compile(source, '<zo-function>', 'exec'), ns)\nhandler=ns.get('handler')\nif not callable(handler): raise RuntimeError('Define handler(input)')\nprint(json.dumps(handler(json.load(sys.stdin)), default=str))`;
}

function runProcess(command: string, args: string[], input: string): Promise<{ status: FunctionStatus; stdout: string; logs: string }> {
  return new Promise((resolve) => {
    const child = spawn(command, args, { cwd: "/tmp", env: { HOME: "/tmp", LANG: "C.UTF-8", PATH: "/usr/local/bin:/usr/bin:/bin", PYTHONDONTWRITEBYTECODE: "1" }, stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; child.kill("SIGKILL"); }, RUN_TIMEOUT_MS);
    child.stdout.on("data", (chunk: Buffer) => { if (Buffer.byteLength(stdout) < MAX_OUTPUT_BYTES) stdout += chunk.toString(); });
    child.stderr.on("data", (chunk: Buffer) => { if (Buffer.byteLength(stderr) < MAX_OUTPUT_BYTES) stderr += chunk.toString(); });
    child.on("error", (error) => { clearTimeout(timer); resolve({ status: "error", stdout, logs: error.message }); });
    child.on("close", (code) => { clearTimeout(timer); resolve({ status: timedOut ? "timeout" : code === 0 ? "success" : "error", stdout, logs: stderr.trim() }); });
    child.stdin.end(input);
  });
}

export function validCron(expression: string): boolean {
  const fields = expression.trim().split(/\s+/);
  return fields.length === 5 && fields.every((field, index) => field.split(",").every((part) => validCronPart(part, [60, 24, 31, 12, 7][index]!, index === 2 ? 1 : 0)));
}

export function cronMatches(expression: string, date: Date): boolean {
  if (!validCron(expression)) return false;
  const values = [date.getUTCMinutes(), date.getUTCHours(), date.getUTCDate(), date.getUTCMonth() + 1, date.getUTCDay()];
  return expression.trim().split(/\s+/).every((field, index) => cronFieldMatches(field, values[index]!, [60, 24, 31, 12, 7][index]!, index === 2 ? 1 : 0));
}

function validCronPart(part: string, maximum: number, minimum: number): boolean {
  const [range = "", step] = part.split("/");
  if (step && (!/^\d+$/.test(step) || Number(step) < 1 || Number(step) > maximum)) return false;
  if (range === "*") return true;
  const match = range.match(/^(\d+)(?:-(\d+))?$/);
  return Boolean(match && Number(match[1]) >= minimum && Number(match[1]) < maximum && (!match[2] || Number(match[2]) >= Number(match[1]) && Number(match[2]) < maximum));
}

function cronFieldMatches(field: string, value: number, maximum: number, minimum: number): boolean {
  return field.split(",").some((part) => {
    const [range = "", rawStep] = part.split("/");
    const step = rawStep ? Number(rawStep) : 1;
    if (range === "*") return (value - minimum) % step === 0;
    const match = range.match(/^(\d+)(?:-(\d+))?$/);
    if (!match) return false;
    const start = Number(match[1]); const end = match[2] ? Number(match[2]) : start;
    return value >= start && value <= end && (value - start) % step === 0;
  });
}
