import { useState } from "react";

import type { DriveFunctionRun } from "@zo-drive/types";
import { formatDate } from "../../../drive-formatting.js";

function runStatusClass(status: DriveFunctionRun["status"]): string {
  if (status === "success") return "bg-emerald-50 text-emerald-700";
  if (status === "timeout") return "bg-amber-50 text-amber-700";
  return "bg-red-50 text-red-700";
}

function runStatusDotClass(status: DriveFunctionRun["status"]): string {
  if (status === "success") return "bg-emerald-500";
  if (status === "timeout") return "bg-amber-500";
  return "bg-red-500";
}

export function FunctionRunRow({ run }: { run: DriveFunctionRun }) {
  const source = run.trigger === "manual"
    ? "Manual run"
    : run.trigger === "public"
      ? "Public endpoint"
      : "UTC cron schedule";

  return (
    <article className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-3">
      <span className={`size-2 shrink-0 rounded-full ${runStatusDotClass(run.status)}`} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-semibold text-slate-700">{source}</span>
        <span className="mt-0.5 block text-xs text-slate-400">{formatDate(run.finishedAt)}</span>
      </span>
      <span className={`rounded-full px-2 py-1 text-[11px] font-bold ${runStatusClass(run.status)}`}>
        {run.status}
      </span>
    </article>
  );
}

export function FunctionLogs({
  isLoading,
  runs
}: {
  isLoading: boolean;
  runs: DriveFunctionRun[];
}) {
  return (
    <section aria-label="Function logs" className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50 px-5 py-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-600">Logs</p>
          <h3 className="mt-1 font-semibold text-slate-900">Invocation timeline</h3>
          <p className="mt-1 text-xs text-slate-500">
            Manual tests, public calls, and UTC schedules are retained here with their execution details.
          </p>
        </div>
        <span className="rounded-full bg-slate-200 px-2.5 py-1 text-xs font-bold text-slate-600">
          Last 30 runs
        </span>
      </header>
      <div className="p-5">
        {isLoading
          ? <p className="text-sm text-slate-500">Loading invocation logs…</p>
          : runs.length === 0
            ? (
              <p className="rounded-xl border border-dashed border-slate-300 p-5 text-sm text-slate-500">
                No invocations yet. Run the function, call its public endpoint, or wait for its schedule.
              </p>
            )
            : <div className="space-y-3">{runs.map((run) => <FunctionLogEntry key={run.id} run={run} />)}</div>}
      </div>
    </section>
  );
}

function FunctionLogEntry({ run }: { run: DriveFunctionRun }) {
  const [open, setOpen] = useState(false);
  const source = run.trigger === "manual"
    ? "Run now from Zo Drive"
    : run.trigger === "public"
      ? "Public endpoint"
      : "UTC cron schedule";
  const durationMs = Math.max(0, Date.parse(run.finishedAt) - Date.parse(run.startedAt));
  const duration = durationMs < 1_000
    ? `${durationMs} ms`
    : `${(durationMs / 1_000).toFixed(2)} s`;
  const result = run.output === null ? "No output" : JSON.stringify(run.output);

  return (
    <article className="rounded-xl border border-slate-200 bg-white">
      <button
        aria-expanded={open}
        className="flex w-full items-center gap-3 p-4 text-left hover:bg-slate-50"
        onClick={() => setOpen((value) => !value)}
      >
        <span className={`size-2.5 rounded-full ${runStatusDotClass(run.status)}`} />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-slate-800">{source}</span>
          <span className="mt-0.5 block text-xs text-slate-500">
            {formatDate(run.startedAt)} · Took {duration}
          </span>
          <span className="mt-1 block truncate font-mono text-xs text-slate-600">Result: {result}</span>
        </span>
        <span className={`rounded-full px-2 py-1 text-xs font-bold ${runStatusClass(run.status)}`}>
          {run.status}
        </span>
      </button>
      {open && (
        <div className="grid gap-4 border-t border-slate-100 p-4 lg:grid-cols-2">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Function output</p>
            <pre className="mt-2 max-h-56 overflow-auto rounded-lg bg-slate-950 p-3 text-xs leading-5 text-slate-100">
              <code>{run.output === null ? "No output" : JSON.stringify(run.output, null, 2)}</code>
            </pre>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Runtime logs</p>
            <pre className="mt-2 max-h-56 overflow-auto rounded-lg bg-slate-950 p-3 text-xs leading-5 text-slate-100">
              <code>{run.logs || "No runtime log output."}</code>
            </pre>
          </div>
        </div>
      )}
    </article>
  );
}
