import {
  ArrowUpRight,
  Cpu,
  Download,
  ExternalLink,
  LoaderCircle,
  Settings2,
  ShieldCheck,
  Trash2
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { formatBytes } from "../../drive-formatting.js";
import { ZominAiCheck } from "./components/zomin-ai-check.js";
import {
  clearZominAiSettings,
  defaultZominAiSettings,
  defaultZominAiSystemInstructions,
  readZominAiSettings,
  writeZominAiSettings,
  zominAiButtonUrl,
  zominAiDocumentationUrl,
  zominAiSystemInstructionsMaxCharacters
} from "./zomin-ai-config.js";
import {
  getZominAiDownloadStatus,
  getZominAiInstallation,
  updateZominAiInstallation,
  verifyZominAiInstall
} from "./zomin-ai-installation-service.js";
import type {
  ZominAiDownloadStatus,
  ZominAiInstallation,
  ZominAiPane,
  ZominAiSettings,
  ZominAiVerification
} from "./zomin-ai-types.js";

export function ZominAiWorkspace({ initialPane = "install" }: { initialPane?: ZominAiPane }) {
  const [activePane, setActivePane] = useState<ZominAiPane>(initialPane);
  const [settings, setSettings] = useState<ZominAiSettings>(readZominAiSettings);
  const [installation, setInstallation] = useState<ZominAiInstallation | null>(null);
  const [installationUnavailable, setInstallationUnavailable] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [verification, setVerification] = useState<ZominAiVerification | null>(null);
  const [downloadStatus, setDownloadStatus] = useState<ZominAiDownloadStatus | null>(null);
  const [downloadStatusUnavailable, setDownloadStatusUnavailable] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [confirmUninstall, setConfirmUninstall] = useState(false);
  const [uninstalled, setUninstalled] = useState(false);

  useEffect(() => setActivePane(initialPane), [initialPane]);

  useEffect(() => {
    if (uninstalled) {
      clearZominAiSettings();
      return;
    }
    writeZominAiSettings(settings);
  }, [settings, uninstalled]);

  useEffect(() => {
    const controller = new AbortController();
    let disposed = false;
    const refreshStatus = async () => {
      try {
        const status = await getZominAiDownloadStatus(controller.signal);
        if (!disposed) {
          setDownloadStatus(status);
          setDownloadStatusUnavailable(false);
        }
      } catch {
        if (!disposed) setDownloadStatusUnavailable(true);
      }
    };
    void refreshStatus();
    const interval = window.setInterval(() => void refreshStatus(), 2500);
    return () => {
      disposed = true;
      controller.abort();
      window.clearInterval(interval);
    };
  }, []);

  const refreshInstallation = async () => {
    try { setInstallation(await getZominAiInstallation()); setInstallationUnavailable(false); } catch { setInstallationUnavailable(true); }
  };

  useEffect(() => {
    void refreshInstallation();
    const interval = window.setInterval(() => void refreshInstallation(), 3_000);
    return () => window.clearInterval(interval);
  }, []);

  async function verify() {
    setVerifying(true);
    try {
      const result = await verifyZominAiInstall(settings);
      setVerification(result);
      toast[result.runtime.ready ? "success" : "message"](result.runtime.ready ? "ZominAI runtime verified" : "ZominAI needs local setup");
    } finally {
      setVerifying(false);
    }
  }

  function uninstall() {
    setUninstalled(true);
    setSettings(defaultZominAiSettings);
    setVerification(null);
    setConfirmUninstall(false);
    setActivePane("verify");
    toast.success("ZominAI browser settings removed");
  }

  async function uninstallVersion() {
    const version = installation?.model.version ?? defaultZominAiSettings.model;
    setRemoving(true);
    try {
      await updateZominAiInstallation("DELETE", version);
      setConfirmUninstall(false);
      setVerification(null);
      toast.success(`${version} removed from this Zo Computer`);
      await refreshInstallation();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not remove the ZominAI model.");
    } finally { setRemoving(false); }
  }

  const panes: Array<{ description: string; icon: React.ReactNode; id: ZominAiPane; label: string }> = [
    { id: "verify", label: "Check runtime", description: "Confirm the active model is ready", icon: <ShieldCheck size={18} /> },
    { id: "install", label: "Install or repair", description: "Set up the managed model version", icon: <Download size={18} /> },
    { id: "settings", label: "Preferences", description: "View model location and set behaviour", icon: <Settings2 size={18} /> },
    { id: "uninstall", label: "Remove version", description: "Remove one specified model version", icon: <Trash2 size={18} /> }
  ];
  return <div className="space-y-5">
    <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-950 via-cyan-950 to-slate-900 px-7 py-8 text-white shadow-sm md:px-9"><div className="absolute -right-20 -top-24 size-72 rounded-full bg-cyan-300/15 blur-3xl" /><div className="relative max-w-4xl"><span className="inline-flex items-center gap-2 rounded-full border border-cyan-200/20 bg-cyan-200/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-100"><img className="size-4 rounded object-cover" src={zominAiButtonUrl} alt="" /> Local Bonsai runtime</span><h2 className="mt-4 text-3xl font-semibold tracking-tight md:text-4xl">Run ZominAI beside your Drive.</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">ZominAI stays on the device running the local model. When you ask about your Drive, authenticated read-only tools can supply supported file content and database results to this local runtime. Nothing is sent to a hosted model.</p><p className="mt-4 text-xs font-medium text-cyan-100/80">Inspired by Google Gemini.</p><nav aria-label="ZominAI resources" className="mt-6 grid gap-2 sm:grid-cols-2 xl:grid-cols-4"><a className="rounded-xl border border-cyan-100/20 bg-white/10 p-3 text-sm font-semibold text-cyan-50 transition hover:border-cyan-100/50 hover:bg-white/15" href="https://prismml.com/" rel="noreferrer" target="_blank">PrismML overview <ExternalLink className="ml-1 inline" size={14} /></a><a className="rounded-xl border border-cyan-100/20 bg-white/10 p-3 text-sm font-semibold text-cyan-50 transition hover:border-cyan-100/50 hover:bg-white/15" href="https://huggingface.co/prism-ml/Bonsai-27B-gguf" rel="noreferrer" target="_blank">Bonsai model &amp; licence <ExternalLink className="ml-1 inline" size={14} /></a><a className="rounded-xl border border-cyan-100/20 bg-white/10 p-3 text-sm font-semibold text-cyan-50 transition hover:border-cyan-100/50 hover:bg-white/15" href="https://github.com/ggml-org/llama.cpp/blob/master/docs/install.md" rel="noreferrer" target="_blank">Runtime installation docs <ExternalLink className="ml-1 inline" size={14} /></a><a className="rounded-xl border border-cyan-100/20 bg-cyan-200/20 p-3 text-sm font-semibold text-cyan-50 transition hover:border-cyan-100/50 hover:bg-white/15" href={zominAiDocumentationUrl()}>ZominAI documentation <ArrowUpRight className="ml-1 inline" size={14} /></a></nav></div></section>
    <div className="grid gap-5 xl:grid-cols-[17rem_minmax(0,1fr)]"><aside className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-sm"><p className="px-3 pb-2 pt-3 text-xs font-bold uppercase tracking-[0.16em] text-slate-400">ZominAI</p>{panes.map((pane) => <button aria-label={`ZominAI menu: ${pane.label}`} className={`mb-1 flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left transition ${activePane === pane.id ? "bg-cyan-950 text-white shadow-sm" : "text-slate-700 hover:bg-slate-50"}`} key={pane.id} onClick={() => { setActivePane(pane.id); setConfirmUninstall(false); }}><span className={`mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg ${activePane === pane.id ? "bg-white/15 text-cyan-100" : "bg-slate-100 text-slate-500"}`}>{pane.icon}</span><span><span className="block text-sm font-semibold">{pane.label}</span><span className={`mt-0.5 block text-xs leading-5 ${activePane === pane.id ? "text-cyan-100" : "text-slate-400"}`}>{pane.description}</span></span></button>)}</aside>
      <div className="min-w-0">
        {activePane === "verify" && <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-cyan-700">Runtime status</p><h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">Verify the Zo Computer runtime.</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">ZominAI runs on the Zo Computer, not in this browser. This checks the private Bonsai service through Zo Drive’s authenticated gateway.</p></div><button aria-label="Verify ZominAI install" className="inline-flex items-center gap-2 rounded-lg bg-cyan-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-cyan-800 disabled:bg-slate-300" disabled={verifying} onClick={() => void verify()}>{verifying ? <LoaderCircle className="animate-spin" size={17} /> : <ShieldCheck size={17} />}{verifying ? "Checking…" : "Check runtime"}</button></div>{verification ? <div className="mt-6 grid gap-3"><ZominAiCheck label="Zo Computer runtime" result={verification.runtime} /><p className="pt-1 text-xs text-slate-400">Last checked {new Date(verification.checkedAt).toLocaleString()}.</p></div> : <div className="mt-6 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">No runtime check has run yet.</div>}</section>}
        {activePane === "install" && <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><p className="text-xs font-bold uppercase tracking-[0.16em] text-cyan-700">Zo Computer installation</p><h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">Install Bonsai 8B once on this Zo Computer.</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">ZominAI is a private supervised service on the Zo Computer. Web, iPhone, and Android clients all use the same authenticated Zo Drive gateway; the model port stays private at <span className="font-mono text-slate-700">127.0.0.1:57183</span>.</p><div className="mt-6 rounded-xl border border-cyan-100 bg-cyan-50/60 p-4"><p className="text-sm font-semibold text-slate-900">Managed runtime</p><p className="mt-1 text-sm leading-6 text-slate-600">The Bonsai 8B model and llama.cpp runtime are installed once and restarted automatically by Zo. Your browser does not need WebGPU, disk space for the model, or any local setup.</p></div><ZominAiDownloadProgress status={downloadStatus} unavailable={downloadStatusUnavailable} /><div className="mt-5 flex flex-wrap gap-3"><a className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50" href="https://huggingface.co/prism-ml/Bonsai-8B-gguf" rel="noreferrer" target="_blank">Bonsai 8B model <ExternalLink size={16} /></a><button className="inline-flex items-center gap-2 rounded-lg bg-cyan-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-cyan-800" onClick={() => { setActivePane("verify"); void verify(); }}>Check runtime <ShieldCheck size={16} /></button></div></section>}
        {activePane === "settings" && <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><p className="text-xs font-bold uppercase tracking-[0.16em] text-cyan-700">Connection and behaviour</p><h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">ZominAI settings</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">These values stay in this browser only. The endpoint must be local to protect Drive data from accidental remote inference routing.</p><div className="mt-6 grid gap-5 md:grid-cols-2"><label className="block text-sm font-semibold text-slate-700">Local runtime address<input aria-label="ZominAI runtime address" className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-mono text-sm outline-none focus:border-cyan-600 focus:ring-4 focus:ring-cyan-100" value={settings.endpoint} onChange={(event) => { setUninstalled(false); setSettings((current) => ({ ...current, endpoint: event.target.value })); }} /></label><label className="block text-sm font-semibold text-slate-700">Model file<input aria-label="ZominAI model file" className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-mono text-sm outline-none focus:border-cyan-600 focus:ring-4 focus:ring-cyan-100" value={settings.model} onChange={(event) => { setUninstalled(false); setSettings((current) => ({ ...current, model: event.target.value })); }} /></label><label className="block text-sm font-semibold text-slate-700">Context window<input aria-label="ZominAI context window" className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-cyan-600 focus:ring-4 focus:ring-cyan-100" max={32768} min={1024} step={1024} type="number" value={settings.contextTokens} onChange={(event) => { setUninstalled(false); setSettings((current) => ({ ...current, contextTokens: Number(event.target.value) || 1024 })); }} /></label></div><div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><label className="text-sm font-semibold text-slate-800" htmlFor="zominai-system-instructions">System instructions</label><p className="mt-1 max-w-2xl text-xs leading-5 text-slate-500">Customise ZominAI’s tone and response preferences. Privacy, truthfulness, and read-only tool rules remain enforced.</p></div><button className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:border-cyan-300 hover:text-cyan-800" onClick={() => setSettings((current) => ({ ...current, systemInstructions: defaultZominAiSystemInstructions }))} type="button">Restore default</button></div><textarea aria-label="ZominAI system instructions" className="mt-3 min-h-36 w-full resize-y rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm leading-6 outline-none focus:border-cyan-600 focus:ring-4 focus:ring-cyan-100" id="zominai-system-instructions" maxLength={zominAiSystemInstructionsMaxCharacters} onChange={(event) => { setUninstalled(false); setSettings((current) => ({ ...current, systemInstructions: event.target.value })); }} value={settings.systemInstructions} /><p aria-live="polite" className="mt-2 text-right text-xs tabular-nums text-slate-400">{settings.systemInstructions.length.toLocaleString()} / {zominAiSystemInstructionsMaxCharacters.toLocaleString()} characters</p></div><div className="mt-6 flex flex-wrap items-center gap-3"><button className="inline-flex items-center gap-2 rounded-lg bg-cyan-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-cyan-800" onClick={() => void verify()}><Cpu size={17} /> Save and verify</button><p className="text-xs text-slate-400">Saved automatically in this browser.</p></div></section>}
        {activePane === "uninstall" && <section className="rounded-2xl border border-red-200 bg-white p-6 shadow-sm"><p className="text-xs font-bold uppercase tracking-[0.16em] text-red-600">Remove local settings</p><h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">Uninstall ZominAI from this browser</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">This clears ZominAI’s local endpoint, model preference, and verification record from this browser. It cannot remove the model or llama.cpp runtime from your Mac, iPhone, or another device.</p>{confirmUninstall ? <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4"><p className="text-sm font-medium text-red-900">Remove ZominAI browser settings now?</p><div className="mt-4 flex gap-3"><button aria-label="Confirm uninstall ZominAI" className="rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700" onClick={uninstall}>Remove settings</button><button className="rounded-lg border border-red-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-red-50" onClick={() => setConfirmUninstall(false)}>Cancel</button></div></div> : <button aria-label="Uninstall ZominAI browser settings" className="mt-6 inline-flex items-center gap-2 rounded-lg border border-red-200 bg-white px-4 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-50" onClick={() => setConfirmUninstall(true)}><Trash2 size={17} /> Uninstall ZominAI</button>}</section>}
      </div>
    </div>
  </div>;
}
function ZominAiDownloadProgress({ status, unavailable }: { status: ZominAiDownloadStatus | null; unavailable: boolean }) {
  if (unavailable) return <div className="mt-6 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-500">Local download progress is available when this Zo Drive page is open on the device running ZominAI.</div>;
  if (!status) return <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">Checking the local ZominAI download status…</div>;
  const percent = Math.round(Math.max(0, Math.min(1, status.progress)) * 100);
  const ready = status.state === "ready";
  return <section className={`mt-6 rounded-xl border p-4 ${ready ? "border-emerald-200 bg-emerald-50/60" : "border-cyan-200 bg-cyan-50/60"}`}><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm font-semibold text-slate-900">{ready ? "ZominAI is ready locally" : "ZominAI local download"}</p><p className="mt-1 text-sm text-slate-600">{status.detail}</p></div><span className={`rounded-full px-2.5 py-1 text-sm font-bold tabular-nums ${ready ? "bg-emerald-600 text-white" : "bg-cyan-700 text-white"}`}>{percent}%</span></div><div className="mt-4 h-2 overflow-hidden rounded-full bg-cyan-100"><div className={`h-full rounded-full transition-[width] duration-500 ${ready ? "bg-emerald-600" : "bg-cyan-600"}`} style={{ width: `${percent}%` }} /></div><p className="mt-3 text-xs leading-5 text-slate-500">{formatBytes(status.downloadedBytes)} of about {formatBytes(status.expectedBytes)} prepared on this device. This background service continues after you leave Zo Drive; return here to see the latest status.</p></section>;
}
