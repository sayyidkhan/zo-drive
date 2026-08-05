import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, FlaskConical, HardDrive, LoaderCircle, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import type { DemoModeStatus, StorageUsage } from "@zo-drive/types";
import { formatBytes } from "../../drive-formatting.js";

export type DemoModeClient = {
  getDemoMode(): Promise<DemoModeStatus>;
  setDemoMode(enabled: boolean): Promise<DemoModeStatus>;
};

const demoQuotaBytes = 1024 * 1024 * 1024;

export function DemoModeScreen({ client, usage }: { client: DemoModeClient; usage?: StorageUsage }) {
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

  if (statusQuery.isPending) {
    return <div className="grid h-64 place-items-center text-sm text-slate-500"><LoaderCircle className="mr-2 animate-spin" size={20} /> Loading Demo Mode…</div>;
  }
  if (!statusQuery.data || statusQuery.isError) {
    return <div className="rounded-2xl border border-red-100 bg-red-50 p-5 text-sm text-red-700">Could not load Demo Mode. <button className="font-semibold underline" onClick={() => void statusQuery.refetch()}>Try again</button></div>;
  }

  const status = statusQuery.data;
  const overDemoLimit = (usage?.usedBytes ?? 0) > demoQuotaBytes;
  const activatingBlocked = !status.enabled && overDemoLimit;

  return <div className="w-full space-y-6">
    <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="relative overflow-hidden bg-[#082f49] px-6 py-9 text-white sm:px-8">
        <div className="absolute -right-20 -top-20 size-64 rounded-full border border-cyan-200/20" />
        <div className="absolute right-16 top-20 size-24 rounded-full bg-cyan-300/10 blur-xl" />
        <div className="relative max-w-2xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-cyan-200/25 bg-cyan-100/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-cyan-100"><FlaskConical size={14} /> Super-admin control</span>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">A safe, bounded Drive for demonstrations.</h2>
          <p className="mt-3 max-w-xl text-sm leading-6 text-cyan-50/80">Demo Mode applies one account-wide storage ceiling across the browser, API, and CLI. It never deletes existing data.</p>
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

          {activatingBlocked && <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm leading-5 text-amber-800" role="alert">This Drive currently uses {formatBytes(usage?.usedBytes ?? 0)}. Reduce usage to 1 GB or less before enabling Demo Mode.</p>}
        </div>

        <aside className="space-y-3">
          <div className="rounded-2xl border border-cyan-100 bg-cyan-50 p-5"><HardDrive className="text-cyan-700" size={20} /><p className="mt-4 text-xs font-bold uppercase tracking-[0.14em] text-cyan-700">Demo storage</p><p className="mt-1 text-3xl font-semibold tracking-tight text-slate-900">1 GB</p><p className="mt-2 text-xs leading-5 text-slate-500">Uploads stop cleanly when the account reaches the cap.</p></div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5"><ShieldCheck className="text-slate-600" size={20} /><p className="mt-3 text-sm font-semibold text-slate-800">Server enforced</p><p className="mt-1 text-xs leading-5 text-slate-500">Browser and command-line clients cannot bypass the limit.</p></div>
        </aside>
      </div>
    </section>
  </div>;
}
