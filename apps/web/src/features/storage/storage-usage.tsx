import { Info, X } from "lucide-react";
import { useState } from "react";

import type { StorageUsage } from "@zo-drive/types";
import { formatBytes } from "../../drive-formatting.js";

export function UsageCard({ usage, onOpenBreakdown }: { usage?: StorageUsage; onOpenBreakdown: () => void }) {
  const used = usage?.usedBytes ?? 0;
  const quota = usage?.quotaBytes ?? 0;
  const fileCount = activeDriveFileCount(usage);
  const percentage = quota > 0 ? Math.min(100, (used / quota) * 100) : 0;
  return (
    <div className="mt-8 rounded-xl bg-slate-50 p-4" data-storage-card data-testid="storage-card">
      <div className="flex items-center justify-between text-sm font-medium text-slate-700"><span>Storage</span><span>{fileCount} {fileCount === 1 ? "file" : "files"}</span></div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-blue-600" style={{ width: `${Math.max(percentage, used > 0 ? 1 : 0)}%` }} /></div>
      <p className="mt-2 text-xs text-slate-500">{formatBytes(used)} used of {formatBytes(quota)}</p>
      <button className="mt-3 flex items-center gap-1 text-xs font-semibold text-blue-700 hover:text-blue-800" onClick={onOpenBreakdown}><Info size={14} /> View storage breakdown</button>
    </div>
  );
}
function activeDriveFileCount(usage?: StorageUsage): number {
  const fileCategories = new Set(["photos", "videos", "documents", "audio", "archives", "other"]);
  return (usage?.categories ?? []).filter((category) => fileCategories.has(category.id)).reduce((total, category) => total + category.fileCount, 0);
}
const storageCategoryMeta = {
  photos: { color: "bg-fuchsia-500", label: "Photos", unit: "file" },
  videos: { color: "bg-orange-500", label: "Movies & video", unit: "file" },
  documents: { color: "bg-blue-600", label: "Documents", unit: "file" },
  audio: { color: "bg-emerald-500", label: "Audio", unit: "file" },
  archives: { color: "bg-amber-400", label: "Archives", unit: "file" },
  other: { color: "bg-slate-400", label: "Other files", unit: "file" },
  trash: { color: "bg-rose-500", label: "Trash", unit: "file" },
  databases: { color: "bg-cyan-600", label: "Zo Databases", unit: "item" },
  functions: { color: "bg-violet-500", label: "Zo Functions", unit: "item" },
  "zo-originals": { color: "bg-teal-500", label: "Zo Originals data", unit: "item" }
} as const;

const quotaPresetsGb = [100, 200, 250] as const;
const gigabyte = 1024 * 1024 * 1024;

export function StorageBreakdownDialog({ usage, onClose, onSetQuota }: { usage?: StorageUsage; onClose: () => void; onSetQuota: (quotaBytes: number) => Promise<StorageUsage> }) {
  const driveUsed = usage?.usedBytes ?? 0;
  const total = usage?.totalBytes ?? 0;
  const systemUsed = usage?.systemUsedBytes ?? 0;
  const available = usage?.availableBytes ?? 0;
  const quota = usage?.quotaBytes ?? 0;
  const quotaAvailable = usage?.quotaAvailableBytes ?? 0;
  const minQuota = usage?.minQuotaBytes ?? gigabyte;
  const maxQuota = usage?.maxQuotaBytes ?? Math.floor(total * 0.8);
  const otherMachineData = Math.max(0, systemUsed - driveUsed);
  const categories = (usage?.categories ?? []).filter((category) => category.bytes > 0);
  const fileCount = activeDriveFileCount(usage);
  const [customQuotaGb, setCustomQuotaGb] = useState("");
  const [quotaError, setQuotaError] = useState<string | null>(null);
  const [savingQuota, setSavingQuota] = useState(false);

  async function setQuota(quotaBytes: number) {
    if (quotaBytes < minQuota) {
      setQuotaError(`Storage limit must be at least ${formatBytes(minQuota)}.`);
      return;
    }
    if (quotaBytes > maxQuota) {
      setQuotaError(`Storage limit cannot exceed ${formatBytes(maxQuota)}, which is 80% of this machine's disk.`);
      return;
    }
    if (quotaBytes < driveUsed) {
      setQuotaError("Storage limit cannot be lower than the files currently stored in Zo Drive.");
      return;
    }
    setQuotaError(null);
    setSavingQuota(true);
    try {
      await onSetQuota(quotaBytes);
    } catch (error) {
      setQuotaError(error instanceof Error ? error.message : "Could not update the storage limit.");
    } finally {
      setSavingQuota(false);
    }
  }

  function setCustomQuota() {
    const value = Number(customQuotaGb);
    if (!Number.isFinite(value) || value <= 0) {
      setQuotaError("Enter a storage limit in GB.");
      return;
    }
    void setQuota(Math.floor(value * gigabyte));
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-slate-950/35 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Storage breakdown"
      onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      <section className="flex max-h-[calc(100dvh-2rem)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <header className="shrink-0 flex items-start justify-between border-b border-slate-100 px-6 py-5">
          <div>
            <p className="text-sm font-medium text-blue-600">Zo Drive storage</p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">Storage breakdown</h2>
            <p className="mt-1 text-sm text-slate-500">Choose how much of this machine can be used by Zo Drive.</p>
          </div>
          <button aria-label="Close storage breakdown" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" onClick={onClose}><X size={20} /></button>
        </header>
        <div aria-label="Storage breakdown content" className="min-h-0 flex-1 space-y-7 overflow-y-auto p-6" role="region">
          <section>
            <div className="flex items-baseline justify-between gap-4">
              <div><span className="text-3xl font-semibold tracking-tight text-slate-900">{formatBytes(driveUsed)}</span><span className="ml-2 text-sm text-slate-500">used of {formatBytes(quota)}</span></div>
              <span className="text-sm font-medium text-slate-600">{formatBytes(quotaAvailable)} remaining</span>
            </div>
            <div className="mt-4 flex h-4 overflow-hidden rounded-full bg-slate-100" aria-label={`${formatBytes(driveUsed)} used of ${formatBytes(quota)}`}>
              {categories.map((category) => <div className={storageCategoryMeta[category.id].color} key={category.id} style={{ width: `${quota > 0 ? (category.bytes / quota) * 100 : 0}%` }} />)}
              <div className="flex-1 bg-slate-200" />
            </div>
            <p className="mt-2 text-xs text-slate-500">Zo Drive quota, including Trash, databases, functions, and Zo Originals data.</p>
          </section>
          <section className="rounded-xl border border-blue-100 bg-blue-50/60 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold text-slate-800">Drive storage limit</h3>
                <p className="mt-1 text-sm text-slate-500">Choose a preset or enter a custom amount.</p>
              </div>
              <span className="rounded-full bg-white px-3 py-1 text-sm font-semibold text-blue-700 shadow-sm">Current: {formatBytes(quota)}</span>
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              {quotaPresetsGb.map((preset) => {
                const presetBytes = preset * gigabyte;
                const selected = quota === presetBytes;
                const unavailable = presetBytes > maxQuota;
                return <button aria-label={`Set storage limit to ${preset} GB`} className={`rounded-lg border px-3 py-2.5 text-sm font-semibold transition ${selected ? "border-blue-600 bg-blue-600 text-white" : "border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:text-blue-700"} disabled:cursor-not-allowed disabled:opacity-45`} disabled={savingQuota || unavailable} key={preset} onClick={() => void setQuota(presetBytes)}>{preset} GB</button>;
              })}
            </div>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <label className="sr-only" htmlFor="custom-storage-limit">Custom storage limit in GB</label>
              <input aria-label="Custom storage limit in GB" id="custom-storage-limit" className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" min={minQuota / gigabyte} max={maxQuota / gigabyte} onChange={(event) => setCustomQuotaGb(event.target.value)} placeholder="Custom GB" step="0.1" type="number" value={customQuotaGb} />
              <button className="rounded-lg border border-blue-600 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50" disabled={savingQuota} onClick={setCustomQuota}>{savingQuota ? "Saving…" : "Apply custom limit"}</button>
            </div>
            <p className="mt-3 text-xs leading-5 text-slate-500">Custom limits must be at least {formatBytes(minQuota)} and no more than {formatBytes(maxQuota)} (80% of this machine's disk).</p>
            {quotaError && <p className="mt-2 text-sm font-medium text-red-600" role="alert">{quotaError}</p>}
          </section>
          <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between gap-4">
              <div><h3 className="font-semibold text-slate-800">Full machine disk</h3><p className="mt-1 text-sm text-slate-500">{formatBytes(available)} available of {formatBytes(total)}</p></div>
              <span className="text-sm font-medium text-slate-600">{formatBytes(systemUsed)} used</span>
            </div>
            <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-slate-200"><div className="bg-slate-500" style={{ width: `${total > 0 ? (systemUsed / total) * 100 : 0}%` }} /></div>
            <p className="mt-3 text-xs leading-5 text-slate-500"><span className="font-medium text-slate-700">Zo system files & other machine data:</span> {formatBytes(otherMachineData)} outside Zo Drive, including the Zo runtime, Drive application code, and other platform files.</p>
          </section>
          <section className="overflow-hidden rounded-xl border border-slate-200">
            <div className="border-b border-slate-100 px-4 py-3"><h3 className="font-semibold text-slate-800">Your Zo Drive data</h3><p className="mt-0.5 text-sm text-slate-500">{fileCount} active Drive {fileCount === 1 ? "file" : "files"}, grouped by storage type</p></div>
            <div className="divide-y divide-slate-100">{categories.length > 0 ? categories.map((category) => { const meta = storageCategoryMeta[category.id]; return <div className="flex items-center gap-3 px-4 py-3" key={category.id}><span className={`size-3 rounded-full ${meta.color}`} /><span className="flex-1 text-sm font-medium text-slate-700">{meta.label}</span><span className="text-right text-sm tabular-nums text-slate-600">{formatBytes(category.bytes)}<span className="ml-2 text-xs text-slate-400">{category.fileCount} {category.fileCount === 1 ? meta.unit : `${meta.unit}s`}</span></span></div>; }) : <p className="px-4 py-6 text-sm text-slate-500">Your Drive is empty.</p>}</div>
          </section>
        </div>
      </section>
    </div>
  );
}
