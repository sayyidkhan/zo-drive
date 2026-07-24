import { Check, Info } from "lucide-react";

export function ZominAiCheck({ label, result }: { label: string; result: { detail: string; ready: boolean } }) {
  return <div className={`flex items-start gap-3 rounded-xl border p-4 ${result.ready ? "border-emerald-200 bg-emerald-50/60" : "border-amber-200 bg-amber-50/70"}`}><span className={`mt-0.5 grid size-7 shrink-0 place-items-center rounded-full ${result.ready ? "bg-emerald-600 text-white" : "bg-amber-100 text-amber-700"}`}>{result.ready ? <Check size={16} /> : <Info size={16} />}</span><div><p className="text-sm font-semibold text-slate-900">{label}</p><p className="mt-0.5 text-sm leading-5 text-slate-600">{result.detail}</p></div></div>;
}
