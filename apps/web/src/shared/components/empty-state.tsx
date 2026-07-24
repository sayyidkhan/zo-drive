import { Cloud } from "lucide-react";

export function EmptyState({ title, description, action, onAction }: { title: string; description?: string; action: string; onAction: () => void }) {
  return <div className="grid min-h-72 place-items-center rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center"><div><span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-blue-50 text-blue-600"><Cloud size={24} /></span><h2 className="mt-4 font-semibold text-slate-800">{title}</h2>{description && <p className="mt-2 max-w-sm text-sm text-slate-500">{description}</p>}<button className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700" onClick={onAction}>{action}</button></div></div>;
}
