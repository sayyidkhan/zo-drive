import { useQuery } from "@tanstack/react-query";
import { LoaderCircle, ScrollText, ShieldCheck } from "lucide-react";

import type { AuditEvent } from "@zo-drive/types";
import { formatDate } from "../../drive-formatting.js";

export type AuditClient = { listAuditEvents(): Promise<AuditEvent[]> };

export function AuditTrailScreen({ client }: { client: AuditClient }) {
  const eventsQuery = useQuery({ queryKey: ["audit-events"], queryFn: () => client.listAuditEvents() });
  if (eventsQuery.isPending) return <div className="grid h-64 place-items-center text-sm text-slate-500"><LoaderCircle className="animate-spin" size={20} /> Loading audit trail…</div>;
  if (eventsQuery.isError) return <div className="rounded-2xl border border-red-100 bg-red-50 p-5 text-sm text-red-700">Could not load the audit trail.</div>;

  const events = eventsQuery.data ?? [];
  return <div className="max-w-6xl space-y-5">
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="bg-slate-950 px-6 py-8 text-white"><span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.15em] text-cyan-100"><ShieldCheck size={14} /> Super-admin visibility</span><h2 className="mt-4 text-3xl font-semibold tracking-tight">Account audit trail</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">Successful and failed sign-ins plus every write, update, deletion, reset, and security action across regular and demo accounts.</p></div>
      {events.length === 0 ? <div className="grid min-h-48 place-items-center p-6 text-center"><div><ScrollText className="mx-auto text-slate-300" size={30} /><p className="mt-3 text-sm text-slate-500">No audit events recorded yet.</p></div></div> : <div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3 font-semibold">Time</th><th className="px-5 py-3 font-semibold">User</th><th className="px-5 py-3 font-semibold">Action</th><th className="px-5 py-3 font-semibold">Result</th><th className="px-5 py-3 font-semibold">Source</th></tr></thead><tbody className="divide-y divide-slate-100">{events.map((event) => <AuditRow event={event} key={event.id} />)}</tbody></table></div>}
    </section>
  </div>;
}

function AuditRow({ event }: { event: AuditEvent }) {
  const succeeded = event.status < 400;
  return <tr><td className="whitespace-nowrap px-5 py-4 text-slate-500">{formatDate(event.createdAt)}</td><td className="px-5 py-4 font-mono text-xs text-slate-700">{event.actorUserId ?? "Unknown"}</td><td className="px-5 py-4"><p className="font-semibold text-slate-800">{event.action}</p><p className="mt-1 font-mono text-xs text-slate-400">{event.path}</p></td><td className="px-5 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${succeeded ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>{event.status}</span></td><td className="max-w-64 px-5 py-4 text-xs text-slate-400">{event.ipAddress ?? "Local/private"}{event.userAgent ? <span className="mt-1 block truncate" title={event.userAgent}>{event.userAgent}</span> : null}</td></tr>;
}
