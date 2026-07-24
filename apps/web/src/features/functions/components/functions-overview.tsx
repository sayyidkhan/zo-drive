import { Plus, Terminal } from "lucide-react";

import type { DriveFunction } from "@zo-drive/types";
import type { FunctionsWorkspaceModel } from "../use-functions-workspace.js";

export function FunctionsHero() {
  return (
    <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 px-7 py-8 text-white shadow-sm md:px-9">
      <div className="absolute -right-20 -top-28 size-72 rounded-full bg-cyan-300/15 blur-3xl" />
      <div className="relative">
        <span className="inline-flex items-center gap-2 rounded-full border border-cyan-200/20 bg-cyan-200/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-100">
          <Terminal size={14} /> Serverless code, in your Drive
        </span>
        <h2 className="mt-4 text-3xl font-semibold tracking-tight md:text-4xl">
          Run small jobs without another service.
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
          Store JavaScript or Python handlers, run them privately, expose an invocation endpoint when needed,
          and schedule enabled functions with UTC cron.
        </p>
      </div>
    </section>
  );
}

export function FunctionsSidebar({
  search,
  workspace
}: {
  search: string;
  workspace: FunctionsWorkspaceModel;
}) {
  return (
    <aside className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 p-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Functions</p>
          <p className="mt-1 text-sm font-semibold text-slate-900">
            {workspace.normalizedSearch
              ? `${workspace.functions.length} matching`
              : `${workspace.allFunctions.length} saved`}
          </p>
        </div>
        <button
          aria-label="New function"
          className="grid size-9 place-items-center rounded-lg bg-blue-600 text-white hover:bg-blue-700"
          onClick={workspace.newFunction}
        >
          <Plus size={18} />
        </button>
      </div>
      {workspace.functionsQuery.isPending
        ? <p className="p-5 text-sm text-slate-500">Loading functions…</p>
        : workspace.allFunctions.length === 0
          ? <p className="p-5 text-sm leading-6 text-slate-500">Create a function to get started.</p>
          : workspace.functions.length === 0
            ? <p className="p-5 text-sm leading-6 text-slate-500">No functions match “{search.trim()}”.</p>
            : (
              <div className="p-2">
                {workspace.functions.map((fn) => (
                  <FunctionListItem
                    active={fn.id === workspace.selectedId}
                    fn={fn}
                    key={fn.id}
                    onSelect={workspace.loadFunction}
                  />
                ))}
              </div>
            )}
    </aside>
  );
}

function FunctionListItem({
  active,
  fn,
  onSelect
}: {
  active: boolean;
  fn: DriveFunction;
  onSelect: (fn: DriveFunction) => void;
}) {
  return (
    <button
      className={`mb-1 flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left ${
        active ? "bg-blue-600 text-white shadow-sm" : "text-slate-700 hover:bg-slate-50"
      }`}
      onClick={() => onSelect(fn)}
    >
      <span className={`grid size-9 place-items-center rounded-lg ${active ? "bg-white/15" : "bg-slate-100 text-slate-500"}`}>
        <Terminal size={17} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold">{fn.name}</span>
        <span className={`mt-0.5 block text-xs ${active ? "text-blue-100" : "text-slate-400"}`}>
          {fn.runtime} · {fn.enabled ? "enabled" : "paused"}
        </span>
      </span>
    </button>
  );
}

export function NoMatchingFunctions() {
  return (
    <section className="grid min-h-72 place-items-center rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
      <div>
        <Terminal className="mx-auto text-slate-300" size={28} />
        <h2 className="mt-4 text-lg font-semibold text-slate-900">No matching functions</h2>
        <p className="mt-2 text-sm text-slate-500">
          Try a function name, runtime, status, schedule, or source-code term.
        </p>
      </div>
    </section>
  );
}
