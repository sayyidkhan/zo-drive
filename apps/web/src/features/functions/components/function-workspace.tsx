import { ArrowUpRight } from "lucide-react";

import type { FunctionRuntime } from "@zo-drive/types";
import { copyText } from "../../../shared/lib/copy-text.js";
import type { FunctionsWorkspaceModel } from "../use-functions-workspace.js";
import { FunctionLogs, FunctionRunRow } from "./function-run-history.js";
import { FunctionWorkspaceTabs } from "./function-workspace-tabs.js";

export function FunctionLogsPanel({
  workspace
}: {
  workspace: FunctionsWorkspaceModel;
}) {
  if (workspace.workspaceTab !== "logs" || !workspace.selectedId) return null;
  return (
    <div id="function-logs-panel" role="tabpanel">
      <FunctionLogs isLoading={workspace.runsQuery.isPending} runs={workspace.runs} />
    </div>
  );
}

export function FunctionWorkspace({
  workspace
}: {
  workspace: FunctionsWorkspaceModel;
}) {
  const title = workspace.workspaceTab === "editor"
    ? workspace.selected ? "Function editor" : "New function"
    : workspace.workspaceTab === "runs"
      ? "Function runs"
      : "Invocation logs";
  const description = workspace.workspaceTab === "editor"
    ? "Handlers receive JSON input and must return JSON-serialisable data."
    : workspace.workspaceTab === "runs"
      ? "Test the saved function and review its recent activity."
      : "Inspect output and runtime logs for the last 30 invocations.";

  return (
    <section className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50 px-5 py-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-600">{title}</p>
          <p className="mt-1 text-sm text-slate-500">{description}</p>
        </div>
      </div>
      <FunctionWorkspaceTabs
        activeTab={workspace.workspaceTab}
        disabled={!workspace.selectedId}
        onChange={workspace.setWorkspaceTab}
      />
      <FunctionEditor workspace={workspace} />
      {workspace.workspaceTab === "runs" && workspace.selectedId && (
        <FunctionRuns workspace={workspace} />
      )}
    </section>
  );
}

function FunctionEditor({ workspace }: { workspace: FunctionsWorkspaceModel }) {
  return (
    <div
      className={workspace.workspaceTab === "editor" ? "block" : "hidden"}
      id="function-editor-panel"
      role="tabpanel"
    >
      <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_17rem]">
        <div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-semibold text-slate-700">
              Name
              <input
                aria-label="Function name"
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                maxLength={80}
                value={workspace.name}
                onChange={(event) => workspace.setName(event.target.value)}
              />
            </label>
            <label className="text-sm font-semibold text-slate-700">
              Runtime
              <select
                aria-label="Function runtime"
                className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                value={workspace.runtime}
                onChange={(event) => workspace.changeRuntime(event.target.value as FunctionRuntime)}
              >
                <option value="javascript">JavaScript</option>
                <option value="python">Python</option>
              </select>
            </label>
          </div>
          <label className="mt-4 block text-sm font-semibold text-slate-700">
            Source code
            <textarea
              aria-label="Function source code"
              className="mt-1.5 min-h-80 w-full resize-y rounded-xl border border-slate-800 bg-slate-950 p-4 font-mono text-xs leading-6 text-slate-100 outline-none focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100"
              spellCheck={false}
              value={workspace.source}
              onChange={(event) => workspace.setSource(event.target.value)}
            />
          </label>
        </div>
        <FunctionSettings workspace={workspace} />
      </div>
      <footer
        aria-label="Function editor actions"
        className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50 px-5 py-4"
        role="group"
      >
        <button
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-white disabled:text-slate-400"
          disabled={!workspace.selectedId || workspace.deleteMutation.isPending}
          onClick={() => {
            if (window.confirm(`Delete ${workspace.name}?`)) workspace.deleteMutation.mutate();
          }}
        >
          Delete
        </button>
        <button
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:bg-slate-300"
          disabled={!workspace.name.trim() || !workspace.source.trim() || workspace.saveMutation.isPending}
          onClick={() => workspace.saveMutation.mutate()}
        >
          {workspace.saveMutation.isPending ? "Saving…" : workspace.selected ? "Save changes" : "Create function"}
        </button>
      </footer>
    </div>
  );
}

function FunctionSettings({ workspace }: { workspace: FunctionsWorkspaceModel }) {
  return (
    <div className="space-y-4">
      <fieldset>
        <legend className="text-sm font-semibold text-slate-700">Invocation</legend>
        <div className="mt-2 grid gap-2">
          <button
            className={`rounded-lg border p-3 text-left text-sm ${
              workspace.visibility === "private"
                ? "border-blue-500 bg-blue-50 text-blue-800"
                : "border-slate-200 text-slate-600"
            }`}
            onClick={() => workspace.setVisibility("private")}
            type="button"
          >
            <strong className="block">Private</strong>
            <span className="mt-1 block text-xs">Only your Drive session can run it.</span>
          </button>
          <button
            className={`rounded-lg border p-3 text-left text-sm ${
              workspace.visibility === "public"
                ? "border-blue-500 bg-blue-50 text-blue-800"
                : "border-slate-200 text-slate-600"
            }`}
            onClick={() => workspace.setVisibility("public")}
            type="button"
          >
            <strong className="block">Public endpoint</strong>
            <span className="mt-1 block text-xs">Anyone can invoke it; source stays private.</span>
          </button>
        </div>
      </fieldset>
      {workspace.visibility === "public" && <PublicInvocation workspace={workspace} />}
      <label className="block text-sm font-semibold text-slate-700">
        <span className="flex items-center justify-between gap-2">
          UTC cron (optional)
          <a
            aria-label="Open crontab.guru cron helper"
            className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:text-blue-900"
            href="https://crontab.guru/"
            rel="noreferrer"
            target="_blank"
          >
            Cron helper <ArrowUpRight size={13} />
          </a>
        </span>
        <input
          aria-label="Function cron schedule"
          className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-mono text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
          placeholder="0 9 * * 1-5"
          value={workspace.cron}
          onChange={(event) => workspace.setCron(event.target.value)}
        />
        <span className="mt-1 block text-xs font-normal leading-5 text-slate-500">
          Five fields: minute hour day month weekday. Example: weekdays at 09:00 UTC.
        </span>
      </label>
      <label className="flex cursor-pointer items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-semibold text-slate-700">
        Enabled
        <input
          aria-label="Function enabled"
          checked={workspace.enabled}
          className="size-4 accent-blue-600"
          type="checkbox"
          onChange={(event) => workspace.setEnabled(event.target.checked)}
        />
      </label>
    </div>
  );
}

function PublicInvocation({ workspace }: { workspace: FunctionsWorkspaceModel }) {
  return (
    <div className="rounded-xl border border-cyan-200 bg-cyan-50 p-3">
      <p className="text-xs font-bold uppercase tracking-wide text-cyan-800">Public invocation</p>
      {workspace.endpoint
        ? (
          <>
            <code className="mt-2 block break-all text-xs leading-5 text-cyan-950">
              POST {workspace.endpoint}
            </code>
            <p className="mt-2 text-xs leading-5 text-cyan-900">
              {workspace.selected?.visibility === "public"
                ? "This endpoint is live while the function stays enabled."
                : "Save changes to activate this endpoint publicly."}
            </p>
            <button
              aria-label="Copy public endpoint"
              className="mt-2 text-xs font-semibold text-cyan-800 hover:text-cyan-950"
              onClick={() => void copyText(workspace.endpoint!, "Public function endpoint copied")}
            >
              Copy endpoint
            </button>
          </>
        )
        : (
          <p className="mt-2 text-xs leading-5 text-cyan-900">
            Create this function to assign its permanent public POST URL.
          </p>
        )}
      <p className="mt-4 text-xs font-bold uppercase tracking-wide text-cyan-800">Request body</p>
      <pre
        aria-label="Public function request body"
        className="mt-2 overflow-x-auto rounded-lg bg-slate-950 p-3 text-xs leading-5 text-slate-100"
      >
        <code>{`{\n  "input": ${workspace.input}\n}`}</code>
      </pre>
      <p className="mt-2 text-xs leading-5 text-cyan-900">
        Send parameters inside <code>input</code>. Your handler receives that value directly, for example{" "}
        <code>input.name</code> in JavaScript.
      </p>
    </div>
  );
}

function FunctionRuns({ workspace }: { workspace: FunctionsWorkspaceModel }) {
  return (
    <div
      aria-labelledby="function-runs-tab"
      className="grid gap-5 bg-slate-50 p-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"
      id="function-runs-panel"
      role="tabpanel"
    >
      <div>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-slate-900">Test run</h3>
            <p className="mt-1 text-xs text-slate-500">Run the saved function with any JSON value.</p>
          </div>
          <button
            className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:bg-slate-300"
            disabled={workspace.runMutation.isPending}
            onClick={() => workspace.runMutation.mutate()}
          >
            {workspace.runMutation.isPending ? "Running…" : "Run now"}
          </button>
        </div>
        <textarea
          aria-label="Function input JSON"
          className="mt-3 min-h-32 w-full rounded-xl border border-slate-700 bg-slate-950 p-3 font-mono text-xs leading-6 text-slate-100 outline-none focus:border-cyan-400"
          spellCheck={false}
          value={workspace.input}
          onChange={(event) => workspace.setInput(event.target.value)}
        />
      </div>
      <div>
        <h3 className="font-semibold text-slate-900">Recent runs</h3>
        <p className="mt-1 text-xs text-slate-500">Last 30 runs, including scheduled and public invocations.</p>
        <div className="mt-3 max-h-72 space-y-2 overflow-auto">
          {workspace.runsQuery.isPending
            ? <p className="text-sm text-slate-500">Loading runs…</p>
            : workspace.runs.length === 0
              ? <p className="text-sm text-slate-500">No runs yet.</p>
              : workspace.runs.map((run) => <FunctionRunRow key={run.id} run={run} />)}
        </div>
      </div>
    </div>
  );
}
