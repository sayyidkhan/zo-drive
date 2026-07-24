import { Code2 } from "lucide-react";

export function CodeBlock({ code, label }: { code: string; label: string }) {
  return <section className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950"><header className="flex items-center justify-between border-b border-white/10 px-4 py-3"><span className="text-xs font-semibold text-slate-300">{label}</span><Code2 size={16} className="text-cyan-300" /></header><pre className="overflow-x-auto p-4 text-xs leading-6 text-slate-200 sm:text-sm"><code>{code}</code></pre></section>;
}
