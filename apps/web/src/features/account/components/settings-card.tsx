import type { ReactNode } from "react";

export function SettingsCard({ children, description, danger = false, icon, title }: { children: ReactNode; description: string; danger?: boolean; icon: ReactNode; title: string }) {
  return <section className={`rounded-xl border bg-white p-5 shadow-sm ${danger ? "border-red-200" : "border-slate-200"}`}><div className={`flex items-start gap-3 ${danger ? "text-red-600" : "text-blue-600"}`}><span className="rounded-lg bg-current/10 p-2">{icon}</span><div><h2 className="font-semibold text-slate-900">{title}</h2><p className="mt-1 text-sm leading-5 text-slate-500">{description}</p></div></div><div className="mt-5">{children}</div></section>;
}
