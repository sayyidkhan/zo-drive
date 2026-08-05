import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, FlaskConical, HardDrive, LoaderCircle, LogOut, RotateCcw, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import type { DemoModeStatus } from "@zo-drive/types";
import { formatBytes } from "../../drive-formatting.js";

export type DemoModeClient = {
  getDemoMode(): Promise<DemoModeStatus>;
  setDemoMode(enabled: boolean): Promise<DemoModeStatus>;
  resetDemoSandbox(): Promise<DemoModeStatus>;
  endDemoSessions(): Promise<void>;
};

const demoQuotaBytes = 1024 * 1024 * 1024;

export function DemoModeScreen({ client }: { client: DemoModeClient }) {
  const queryClient = useQueryClient();
  const statusQuery = useQuery({ queryKey: ["demo-mode"], queryFn: () => client.getDemoMode() });
  const mutation = useMutation({
    mutationFn: (enabled: boolean) => client.setDemoMode(enabled),
    onSuccess: async (status) => {
      queryClient.setQueryData(["demo-mode"], status);
      await queryClient.invalidateQueries({ queryKey: ["usage"] });
      toast.success(status.enabled ? "Demo Mode enabled" : "Demo Mode disabled");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not update Demo Mode")
  });
  const resetMutation = useMutation({
    mutationFn: () => client.resetDemoSandbox(),
    onSuccess: (status) => {
      queryClient.setQueryData(["demo-mode"], status);
      toast.success("Demo data reset");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not reset demo data")
  });
  const sessionsMutation = useMutation({
    mutationFn: () => client.endDemoSessions(),
    onSuccess: () => toast.success("All demo sessions ended"),
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not end demo sessions")
  });

  if (statusQuery.isPending) {
    return <div className="grid h-64 place-items-center text-sm text-slate-500"><LoaderCircle className="mr-2 animate-spin" size={20} /> Loading Demo Mode…</div>;
  }
  if (!statusQuery.data || statusQuery.isError) {
    return <div className="rounded-2xl border border-red-100 bg-red-50 p-5 text-sm text-red-700">Could not load Demo Mode. <button className="font-semibold underline" onClick={() => void statusQuery.refetch()}>Try again</button></div>;
  }

  const status = statusQuery.data;
  const activatingBlocked = !status.enabled && (!status.demoAccountExists || status.sandboxUsedBytes > demoQuotaBytes);

  return <div className="w-full space-y-6">
    <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="relative overflow-hidden bg-[#082f49] px-6 py-9 text-white sm:px-8">
        <div className="absolute -right-20 -top-20 size-64 rounded-full border border-cyan-200/20" />
        <div className="absolute right-16 top-20 size-24 rounded-full bg-cyan-300/10 blur-xl" />
        <div className="relative max-w-2xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-cyan-200/25 bg-cyan-100/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-cyan-100"><FlaskConical size={14} /> Super-admin control</span>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">A safe, bounded Drive for demonstrations.</h2>
          <p className="mt-3 max-w-xl text-sm leading-6 text-cyan-50/80">Demo Mode opens a writable, isolated 1 GB sandbox. Production files and storage limits stay untouched.</p>
        </div>
      </div>

      <div className="grid gap-5 p-5 sm:p-7 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="rounded-2xl border border-slate-200 p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <span className={`grid size-11 shrink-0 place-items-center rounded-xl ${status.enabled ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}><FlaskConical size={21} /></span>
              <div><h3 className="font-semibold text-slate-900">Demo Mode</h3><p className="mt-1 text-sm text-slate-500">{status.enabled ? "The 1 GB cap is active." : "Normal Drive limits are active."}</p></div>
            </div>
            <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.12em] ${status.enabled ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{status.enabled ? "On" : "Off"}</span>
          </div>

          <button
            aria-label={status.enabled ? "Turn Demo Mode off" : "Turn Demo Mode on"}
            aria-pressed={status.enabled}
            className={`mt-6 flex w-full items-center justify-between rounded-xl border p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-50 ${status.enabled ? "border-emerald-300 bg-emerald-50" : "border-slate-200 bg-slate-50 hover:border-cyan-300 hover:bg-cyan-50"}`}
            disabled={mutation.isPending || activatingBlocked}
            onClick={() => mutation.mutate(!status.enabled)}
            type="button"
          >
            <span><span className="block text-sm font-semibold text-slate-900">{mutation.isPending ? "Updating…" : status.enabled ? "Disable Demo Mode" : "Enable Demo Mode"}</span><span className="mt-1 block text-xs leading-5 text-slate-500">{status.enabled ? `Restore the previous ${formatBytes(status.normalQuotaBytes)} limit.` : "Temporarily cap this Drive at 1 GB."}</span></span>
            <span className={`relative h-7 w-12 shrink-0 rounded-full transition ${status.enabled ? "bg-emerald-600" : "bg-slate-300"}`}><span className={`absolute top-1 grid size-5 place-items-center rounded-full bg-white shadow transition ${status.enabled ? "left-6" : "left-1"}`}>{status.enabled && <Check size={13} className="text-emerald-600" />}</span></span>
          </button>

          {activatingBlocked && <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm leading-5 text-amber-800" role="alert">{!status.demoAccountExists ? "Create a demo account in User access before enabling Demo Mode." : `The demo sandbox uses ${formatBytes(status.sandboxUsedBytes)}. Reset it or reduce usage to 1 GB before enabling Demo Mode.`}</p>}
        </div>

        <aside className="space-y-3">
          <div className="rounded-2xl border border-cyan-100 bg-cyan-50 p-5"><HardDrive className="text-cyan-700" size={20} /><p className="mt-4 text-xs font-bold uppercase tracking-[0.14em] text-cyan-700">Demo storage</p><p className="mt-1 text-3xl font-semibold tracking-tight text-slate-900">1 GB</p><p className="mt-2 text-xs leading-5 text-slate-500">Uploads stop cleanly when the account reaches the cap.</p></div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5"><ShieldCheck className="text-slate-600" size={20} /><p className="mt-3 text-sm font-semibold text-slate-800">Server enforced</p><p className="mt-1 text-xs leading-5 text-slate-500">Browser and command-line clients cannot bypass the limit.</p></div>
        </aside>
      </div>
    </section>

    <section className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><RotateCcw className="text-blue-700" size={21} /><h3 className="mt-4 font-semibold text-slate-900">Reset demo data</h3><p className="mt-1 text-sm leading-6 text-slate-500">Manually remove only sandbox files, databases, functions, shares, and Trash, then restore synthetic examples. This never runs automatically.</p><button className="mt-5 rounded-lg border border-blue-200 px-4 py-2.5 text-sm font-semibold text-blue-700 hover:bg-blue-50 disabled:opacity-50" disabled={!status.demoAccountExists || resetMutation.isPending} onClick={() => { if (window.confirm("Reset all demo data? Production data will not be changed.")) resetMutation.mutate(); }} type="button">{resetMutation.isPending ? "Resetting…" : "Reset demo data"}</button></div>
      <div className="rounded-2xl border border-red-100 bg-white p-5 shadow-sm"><LogOut className="text-red-600" size={21} /><h3 className="mt-4 font-semibold text-slate-900">Emergency session kill switch</h3><p className="mt-1 text-sm leading-6 text-slate-500">Immediately sign out every active demo visitor. Regular user sessions are not affected and Demo Mode stays on.</p><button className="mt-5 rounded-lg border border-red-200 px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50" disabled={!status.demoAccountExists || sessionsMutation.isPending} onClick={() => { if (window.confirm("End every active demo session now?")) sessionsMutation.mutate(); }} type="button">{sessionsMutation.isPending ? "Ending sessions…" : "End all demo sessions"}</button></div>
    </section>
  </div>;
}
