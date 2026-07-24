import { File, LoaderCircle } from "lucide-react";
import { useEffect, useState } from "react";

import { formatBytes, formatDuration } from "../../drive-formatting.js";
import type { UploadTask } from "./upload-types.js";

export function UploadProgress({ uploads }: { uploads: UploadTask[] }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(interval);
  }, []);
  const totalSize = uploads.reduce((total, upload) => total + upload.size, 0);
  const totalLoaded = uploads.reduce((total, upload) => total + upload.loaded, 0);
  const percentage = totalSize > 0 ? Math.min(100, Math.round((totalLoaded / totalSize) * 100)) : 100;
  const totalRate = uploads.reduce((total, upload) => total + uploadRate(upload, now), 0);
  const secondsRemaining = totalRate > 0 ? Math.ceil(Math.max(0, totalSize - totalLoaded) / totalRate) : null;
  return <div className="fixed bottom-5 right-5 z-50 w-[min(calc(100vw-2.5rem),30rem)] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/15" role="status" aria-live="polite"><div className="border-b border-slate-100 bg-gradient-to-r from-blue-600 to-sky-500 px-5 py-4 text-white"><div className="flex items-center justify-between gap-4"><span className="flex items-center gap-2 text-sm font-semibold"><LoaderCircle className="animate-spin" size={18} /> Uploading {uploads.length} file{uploads.length === 1 ? "" : "s"}</span><span className="text-sm font-bold tabular-nums">{percentage}%</span></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-white/25"><div className="h-full rounded-full bg-white transition-[width] duration-300" style={{ width: `${percentage}%` }} /></div><p className="mt-2 text-xs text-blue-50">{formatBytes(totalLoaded)} of {formatBytes(totalSize)}{secondsRemaining === null ? " · Preparing estimate…" : ` · About ${formatDuration(secondsRemaining)} left`}</p></div><div className="max-h-72 divide-y divide-slate-100 overflow-y-auto">{uploads.map((upload) => { const filePercentage = upload.size > 0 ? Math.min(100, Math.round((upload.loaded / upload.size) * 100)) : 100; const rate = uploadRate(upload, now); const remaining = rate > 0 ? Math.ceil(Math.max(0, upload.size - upload.loaded) / rate) : null; return <div className="px-5 py-4" key={upload.id}><div className="flex items-start gap-3"><span className="mt-0.5 rounded-lg bg-blue-50 p-2 text-blue-600"><File size={17} /></span><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-3"><p className="truncate text-sm font-semibold text-slate-800">{upload.name}</p><span className="shrink-0 text-xs font-semibold tabular-nums text-slate-500">{filePercentage}%</span></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-blue-600 transition-[width] duration-300" style={{ width: `${filePercentage}%` }} /></div><p className="mt-2 text-xs tabular-nums text-slate-500">{formatBytes(upload.loaded)} of {formatBytes(upload.size)}{rate > 0 ? ` · ${formatBytes(rate)}/s` : " · Starting…"}{remaining === null ? "" : ` · ${formatDuration(remaining)} left`}</p></div></div></div>; })}</div></div>;
}

function uploadRate(upload: UploadTask, now: number): number {
  if (upload.loaded === 0) return 0;
  return upload.loaded / Math.max((now - upload.startedAt) / 1_000, 0.25);
}
