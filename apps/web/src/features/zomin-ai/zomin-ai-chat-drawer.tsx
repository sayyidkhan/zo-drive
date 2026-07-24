import {
  Check,
  History,
  LoaderCircle,
  Minimize2,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Send,
  Square,
  Trash2,
  X
} from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent
} from "react";
import { toast } from "sonner";

import {
  createZominAiChatSession,
  zominAiChatTitle,
  zominAiContextMessages,
  zominAiContextSummary,
  zominAiElapsedLabel,
  zominAiEstimatedContextTokens,
  zominAiTimestamp,
  zominAiTokenLabel,
  zominAiTokensPerSecondLabel
} from "./zomin-ai-chat-domain.js";
import { zominAiButtonUrl } from "./zomin-ai-config.js";
import {
  sendZominAiMessage,
  warmZominAi,
  zominAiWarmupMessages
} from "./zomin-ai-gateway.js";
import {
  readZominAiChatSessions,
  readZominAiDrawerWidth,
  writeZominAiChatSessions,
  writeZominAiDrawerWidth
} from "./zomin-ai-persistence.js";
import {
  createZominAiToolRunner,
  type ZominAiToolClient
} from "./zomin-ai-tool-runner.js";
import type {
  ZominAiChatMessage,
  ZominAiChatSession,
  ZominAiConnection,
  ZominAiSettings,
  ZominAiWarmup
} from "./zomin-ai-types.js";

export function ZominAiChatDrawer({ client, connection, isOpen, onClose, onConnectionChange, onModelChange, onRefreshConnection, settings }: { client: ZominAiToolClient; connection: ZominAiConnection; isOpen: boolean; onClose: () => void; onConnectionChange: (connection: ZominAiConnection) => void; onModelChange: (model: string) => void; onRefreshConnection: () => void; settings: ZominAiSettings }) {
  const [sessions, setSessions] = useState<ZominAiChatSession[]>(readZominAiChatSessions);
  const [activeSessionId, setActiveSessionId] = useState(() => sessions[0]!.id);
  const [draft, setDraft] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [drawerWidth, setDrawerWidth] = useState(readZominAiDrawerWidth);
  const [resizing, setResizing] = useState(false);
  const [sending, setSending] = useState(false);
  const [streamingReply, setStreamingReply] = useState("");
  const [elapsedMs, setElapsedMs] = useState(0);
  const [warmup, setWarmup] = useState<ZominAiWarmup>({ detail: "", state: "idle" });
  const [warmupMessageIndex, setWarmupMessageIndex] = useState(0);
  const [warmupAttempt, setWarmupAttempt] = useState(0);
  const [editingTitleId, setEditingTitleId] = useState<string | null>(null);
  const [titleDraft, setTitleDraft] = useState("");
  const requestControllerRef = useRef<AbortController | null>(null);
  const warmedModelRef = useRef<string | null>(null);
  const drawerRef = useRef<HTMLElement>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const activeSession = sessions.find((session) => session.id === activeSessionId) ?? sessions[0]!;
  const contextMessages = zominAiContextMessages(activeSession, activeSession.messages);
  const estimatedContextTokens = zominAiEstimatedContextTokens(contextMessages, activeSession.contextSummary, settings.systemInstructions);
  const contextPercent = Math.min(100, Math.round((estimatedContextTokens / settings.contextTokens) * 100));
  const canCompactContext = zominAiContextSummary(activeSession.messages) !== null;
  const availableModels = connection.models.includes(settings.model) ? connection.models : [settings.model, ...connection.models];
  const modelReady = warmup.state === "ready" && connection.state === "connected";
  const displayedConnection = warmup.state === "warming"
    ? { label: "Warming up", ariaLabel: "ZominAI warming up", colour: "bg-amber-50 text-amber-700", dot: "bg-amber-500 animate-pulse", detail: zominAiWarmupMessages[warmupMessageIndex] }
    : warmup.state === "failed" || connection.state === "disconnected"
      ? { label: "Not ready", ariaLabel: "ZominAI not ready", colour: "bg-red-50 text-red-700", dot: "bg-red-500", detail: warmup.detail || connection.detail }
      : modelReady
        ? { label: "Ready", ariaLabel: "ZominAI ready", colour: "bg-emerald-50 text-emerald-700", dot: "bg-emerald-500", detail: `${settings.model} is warm and ready to respond.` }
        : { label: "Checking", ariaLabel: "ZominAI checking connection", colour: "bg-amber-50 text-amber-700", dot: "bg-amber-500 animate-pulse", detail: connection.detail };
  const drawerTransitionClass = resizing
    ? "transition-none"
    : "transition-[transform,width,border-color,box-shadow] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]";

  useEffect(() => {
    writeZominAiChatSessions(sessions);
  }, [sessions]);

  useEffect(() => {
    writeZominAiDrawerWidth(drawerWidth);
  }, [drawerWidth]);

  useEffect(() => {
    if (!isOpen) {
      setWarmup({ detail: "", state: "idle" });
      return;
    }
    if (warmedModelRef.current === settings.model) {
      setWarmup({ detail: `${settings.model} is warm and ready to respond.`, state: "ready" });
      return;
    }
    const controller = new AbortController();
    setWarmupMessageIndex(0);
    setWarmup({ detail: "Preparing the selected local model.", state: "warming" });
    void warmZominAi(settings, controller.signal).then(() => {
      warmedModelRef.current = settings.model;
      setWarmup({ detail: `${settings.model} is warm and ready to respond.`, state: "ready" });
    }).catch((error) => {
      if (controller.signal.aborted) return;
      setWarmup({ detail: error instanceof Error ? error.message : "The private Bonsai runtime could not warm up.", state: "failed" });
    });
    return () => controller.abort();
  }, [isOpen, settings.endpoint, settings.model, warmupAttempt]);

  useEffect(() => {
    if (warmup.state !== "warming") return;
    const timer = window.setInterval(() => setWarmupMessageIndex((current) => (current + 1) % zominAiWarmupMessages.length), 1_600);
    return () => window.clearInterval(timer);
  }, [warmup.state]);

  useEffect(() => {
    const transcript = transcriptRef.current;
    if (transcript && typeof transcript.scrollTo === "function") transcript.scrollTo({ top: transcript.scrollHeight });
  }, [activeSessionId, activeSession.messages, sending]);

  useEffect(() => () => requestControllerRef.current?.abort(), []);

  function createChat() {
    const session = createZominAiChatSession();
    setSessions((current) => [session, ...current].slice(0, 50));
    setActiveSessionId(session.id);
    setDraft("");
    setEditingTitleId(null);
  }

  function selectChat(id: string) {
    setActiveSessionId(id);
    setDraft("");
    setEditingTitleId(null);
  }

  function beginRename(session: ZominAiChatSession) {
    setEditingTitleId(session.id);
    setTitleDraft(session.title);
  }

  function saveTitle(id: string) {
    const title = titleDraft.trim().slice(0, 120);
    if (!title) return;
    setSessions((current) => current.map((session) => session.id === id ? { ...session, title, updatedAt: new Date().toISOString() } : session));
    setEditingTitleId(null);
  }

  function deleteChat(id: string) {
    const remaining = sessions.filter((session) => session.id !== id);
    const nextSessions = remaining.length > 0 ? remaining : [createZominAiChatSession()];
    setSessions(nextSessions);
    if (activeSessionId === id) setActiveSessionId(nextSessions[0]!.id);
    setEditingTitleId(null);
  }

  function compactContext() {
    const contextSummary = zominAiContextSummary(activeSession.messages);
    if (!contextSummary) {
      toast.message("Add more messages before compacting context.");
      return;
    }
    const compactedAt = new Date().toISOString();
    setSessions((current) => current.map((session) => session.id === activeSession.id ? { ...session, compactedAt, contextSummary, updatedAt: compactedAt } : session));
    toast.success("Context compacted locally for future replies.");
  }

  function startResize(event: ReactPointerEvent<HTMLButtonElement>) {
    if (!window.matchMedia("(min-width: 768px)").matches) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const startX = event.clientX;
    const startWidth = drawerWidth;
    let nextWidth = startWidth;
    const update = (moveEvent: PointerEvent) => {
      const maximumWidth = Math.min(640, Math.max(360, window.innerWidth - 360));
      nextWidth = Math.max(360, Math.min(maximumWidth, startWidth + startX - moveEvent.clientX));
      drawerRef.current?.style.setProperty("--zominai-drawer-width", `${nextWidth}px`);
    };
    const stop = (stopEvent: PointerEvent) => {
      if (stopEvent.type === "pointerup") update(stopEvent);
      setDrawerWidth(nextWidth);
      setResizing(false);
      window.removeEventListener("pointermove", update);
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
    };
    setResizing(true);
    window.addEventListener("pointermove", update);
    window.addEventListener("pointerup", stop, { once: true });
    window.addEventListener("pointercancel", stop, { once: true });
  }

  async function requestReply(sessionId: string, nextMessages: ZominAiChatMessage[], contextSummary?: string) {
    const controller = new AbortController();
    requestControllerRef.current?.abort();
    requestControllerRef.current = controller;
    setElapsedMs(0);
    setStreamingReply("");
    setSending(true);
    const startedAt = performance.now();
    let partialReply = "";
    const timer = window.setInterval(() => setElapsedMs(performance.now() - startedAt), 100);
    try {
      const session = sessions.find((candidate) => candidate.id === sessionId);
      const reply = await sendZominAiMessage(settings, zominAiContextMessages(session ?? activeSession, nextMessages), createZominAiToolRunner(client, settings), contextSummary, (content) => {
        partialReply = content;
        setStreamingReply(content);
      }, controller.signal);
      const responseElapsedMs = performance.now() - startedAt;
      onConnectionChange({ state: "connected", detail: `${settings.model} replied from ${settings.endpoint}.`, models: connection.models });
      setSessions((current) => current.map((candidate) => candidate.id === sessionId ? { ...candidate, messages: [...nextMessages, { role: "assistant", content: reply.content, elapsedMs: responseElapsedMs, ...(reply.tokensPerSecond !== undefined ? { tokensPerSecond: reply.tokensPerSecond, ...(reply.tokensPerSecondEstimated ? { tokensPerSecondEstimated: true } : {}) } : {}) }], updatedAt: new Date().toISOString() } : candidate));
    } catch (error) {
      const responseElapsedMs = performance.now() - startedAt;
      if (controller.signal.aborted) {
        setSessions((current) => current.map((candidate) => candidate.id === sessionId ? { ...candidate, messages: [...nextMessages, { role: "assistant", content: partialReply.trim() || "Response stopped.", elapsedMs: responseElapsedMs, stopped: true }], updatedAt: new Date().toISOString() } : candidate));
      } else {
        const detail = error instanceof Error ? error.message : "The local runtime could not be reached.";
        onConnectionChange({ state: "disconnected", detail, models: connection.models });
        setSessions((current) => current.map((candidate) => candidate.id === sessionId ? { ...candidate, messages: [...nextMessages, { role: "assistant", content: `I could not connect to ZominAI. ${detail}`, elapsedMs: responseElapsedMs, failed: true }], updatedAt: new Date().toISOString() } : candidate));
      }
    } finally {
      window.clearInterval(timer);
      setElapsedMs(performance.now() - startedAt);
      setStreamingReply("");
      setSending(false);
      if (requestControllerRef.current === controller) requestControllerRef.current = null;
    }
  }

  function stopResponse() {
    requestControllerRef.current?.abort();
  }

  async function send() {
    const content = draft.trim();
    if (!content || sending || !modelReady) return;
    const nextMessages = [...activeSession.messages, { role: "user" as const, content }];
    const updatedAt = new Date().toISOString();
    setSessions((current) => current.map((session) => session.id === activeSession.id ? { ...session, messages: nextMessages, title: session.messages.length === 0 ? zominAiChatTitle(content) : session.title, updatedAt } : session));
    setDraft("");
    await requestReply(activeSession.id, nextMessages, activeSession.contextSummary);
  }

  async function retryLastMessage() {
    if (sending) return;
    const failedMessage = activeSession.messages.at(-1);
    const userMessage = activeSession.messages.at(-2);
    if ((!failedMessage?.failed && !failedMessage?.stopped) || userMessage?.role !== "user") return;
    const nextMessages = activeSession.messages.slice(0, -1);
    setSessions((current) => current.map((session) => session.id === activeSession.id ? { ...session, messages: nextMessages, updatedAt: new Date().toISOString() } : session));
    await requestReply(activeSession.id, nextMessages, activeSession.contextSummary);
  }

  return <aside aria-label="ZominAI chat" aria-hidden={!isOpen} className={`fixed inset-y-0 right-0 z-[70] w-full max-w-[32rem] overflow-hidden border-l border-slate-200 bg-white pt-[4.5rem] shadow-2xl shadow-slate-950/20 ${drawerTransitionClass} motion-reduce:transition-none sm:w-[30rem] md:relative md:z-auto md:h-full md:max-w-none md:shrink-0 md:translate-x-0 md:border-l-0 md:bg-transparent md:pt-0 md:shadow-none ${isOpen ? "translate-x-0 md:w-[var(--zominai-drawer-width)] md:border-l md:border-slate-200 md:bg-white md:shadow-2xl md:shadow-slate-950/10" : "pointer-events-none translate-x-full md:w-0"}`} ref={drawerRef} style={{ "--zominai-drawer-width": `${drawerWidth}px` } as React.CSSProperties}>
    {isOpen && <button aria-label="Resize ZominAI chat" className={`group absolute inset-y-0 left-0 z-10 hidden w-5 cursor-col-resize touch-none md:block ${resizing ? "bg-blue-50" : "hover:bg-slate-50"}`} onPointerDown={startResize} title="Drag to resize chat" type="button"><span aria-hidden="true" className={`absolute left-1/2 top-1/2 h-10 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full transition-colors ${resizing ? "bg-blue-500" : "bg-slate-300 group-hover:bg-slate-400"}`} /></button>}
    <div className={`flex h-full w-full flex-col bg-white transition-[transform,opacity] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none md:w-[var(--zominai-drawer-width)] ${isOpen ? "translate-x-0 opacity-100" : "translate-x-8 opacity-0"}`}>
      <header className="flex items-center gap-3 border-b border-slate-200 px-4 py-3">
        <span className="grid size-9 place-items-center overflow-hidden rounded-xl bg-cyan-950 p-0.5"><img className="size-full rounded-[0.6rem] object-cover" src={zominAiButtonUrl} alt="ZominAI Pegasus" /></span>
        <div className="min-w-0 flex-1"><div className="flex items-center gap-2"><p className="text-sm font-semibold text-slate-900">ZominAI</p><span aria-label={displayedConnection.ariaLabel} className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ${displayedConnection.colour}`} title={displayedConnection.detail}><span aria-hidden="true" className={`size-1.5 rounded-full ${displayedConnection.dot}`} />{displayedConnection.label}</span><button aria-label="Refresh ZominAI connection" className="rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-cyan-800 disabled:cursor-wait disabled:opacity-50" disabled={connection.state === "checking" || warmup.state === "warming"} onClick={() => { warmedModelRef.current = null; setWarmupAttempt((attempt) => attempt + 1); onRefreshConnection(); }} title="Refresh connection and warm up the selected model" type="button"><RefreshCw className={connection.state === "checking" || warmup.state === "warming" ? "animate-spin" : ""} size={14} /></button></div><label className="sr-only" htmlFor="zominai-model-selector">ZominAI model</label><select aria-label="ZominAI model" className="mt-0.5 block max-w-full cursor-pointer truncate rounded-md border border-transparent bg-transparent pr-6 text-xs font-medium text-slate-500 outline-none transition hover:border-slate-200 hover:bg-slate-50 focus:border-cyan-300 focus:ring-2 focus:ring-cyan-100 disabled:cursor-wait" disabled={sending || warmup.state === "warming" || connection.state === "checking"} id="zominai-model-selector" onChange={(event) => onModelChange(event.target.value)} title="Select the local model for the next message" value={settings.model}>{availableModels.map((model) => <option key={model} value={model}>{model}</option>)}</select></div>
        <button aria-label="New ZominAI chat" className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-700 px-2.5 py-2 text-xs font-semibold text-white transition hover:bg-cyan-800" onClick={createChat}><Plus size={15} /> <span className="hidden sm:inline">New chat</span></button>
        <button aria-controls="zominai-chat-history" aria-expanded={historyOpen} aria-label="Toggle ZominAI chat history" className={`rounded-lg p-2 transition ${historyOpen ? "bg-cyan-50 text-cyan-800" : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"}`} onClick={() => setHistoryOpen((open) => !open)} title="Chat history"><History size={18} /></button>
        <button aria-label="Close ZominAI chat" className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900" onClick={onClose}><X size={19} /></button>
      </header>
      <div className="relative flex min-h-0 flex-1 flex-col">
        {historyOpen && <>
          <button aria-label="Close ZominAI chat history" className="absolute inset-0 z-10 bg-slate-950/10 backdrop-blur-[1px]" onClick={() => setHistoryOpen(false)} type="button" />
          <nav aria-label="ZominAI chat history" className="absolute inset-y-0 left-0 z-20 flex w-[min(20rem,calc(100%-2rem))] flex-col border-r border-slate-200 bg-slate-50 p-3 shadow-2xl shadow-slate-950/15" id="zominai-chat-history">
            <div className="flex items-center justify-between gap-3 px-1 py-1"><p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">History</p><button aria-label="Close ZominAI chat history panel" className="rounded-md p-1 text-slate-400 hover:bg-white hover:text-slate-700" onClick={() => setHistoryOpen(false)} type="button"><X size={15} /></button></div>
            <div className="mt-2 min-h-0 flex-1 space-y-2 overflow-y-auto">{sessions.slice().sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)).map((session) => <div className={`rounded-xl border p-1.5 ${session.id === activeSession.id ? "border-cyan-200 bg-white shadow-sm" : "border-transparent hover:border-slate-200 hover:bg-white"}`} key={session.id}>{editingTitleId === session.id ? <form className="flex items-center gap-1" onSubmit={(event) => { event.preventDefault(); saveTitle(session.id); }}><label className="sr-only" htmlFor={`zominai-title-${session.id}`}>Chat title</label><input autoFocus className="min-w-0 flex-1 rounded-md border border-cyan-300 bg-white px-2 py-1.5 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-cyan-100" id={`zominai-title-${session.id}`} maxLength={120} onChange={(event) => setTitleDraft(event.target.value)} value={titleDraft} /><button aria-label="Save chat title" className="rounded-md p-1.5 text-cyan-700 hover:bg-cyan-50" type="submit"><Check size={14} /></button><button aria-label="Cancel chat title rename" className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100" onClick={() => setEditingTitleId(null)} type="button"><X size={14} /></button></form> : <><button aria-current={session.id === activeSession.id ? "page" : undefined} className="block w-full text-left" onClick={() => selectChat(session.id)} type="button"><span className={`block truncate px-1 text-xs font-semibold leading-5 ${session.id === activeSession.id ? "text-cyan-900" : "text-slate-700"}`}>{session.title}</span><span className="block px-1 text-[11px] leading-4 text-slate-400">{zominAiTimestamp(session.updatedAt)}</span></button><div className="mt-1 flex justify-end gap-1"><button aria-label={`Rename chat ${session.title}`} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" onClick={() => beginRename(session)} title="Rename chat" type="button"><Pencil size={13} /></button><button aria-label={`Delete chat ${session.title}`} className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600" onClick={() => deleteChat(session.id)} title="Delete chat" type="button"><Trash2 size={13} /></button></div></>}</div>)}</div>
          </nav>
        </>}
        <section className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div aria-label="ZominAI conversation" className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-slate-50/70 p-4" ref={transcriptRef}>
            {activeSession.messages.length === 0 && warmup.state !== "warming" && warmup.state !== "failed" ? <div className="grid h-full min-h-56 place-items-center text-center"><div className="max-w-60"><img className="mx-auto size-20 rounded-3xl object-cover shadow-sm" src={zominAiButtonUrl} alt="ZominAI Pegasus" /><p className="mt-4 text-sm font-semibold text-slate-900">Ask about your Drive</p><p className="mt-2 text-xs leading-5 text-slate-500">ZominAI can search and read supported Drive files, inspect databases, check the Zo Computer clock, and run read-only queries. Results stay with this local model.</p></div></div> : activeSession.messages.map((message, index) => <div className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`} key={`${message.role}-${index}`}><div className="max-w-[88%]"><div className={`whitespace-pre-wrap rounded-2xl px-3 py-2.5 text-sm leading-6 ${message.role === "user" ? "rounded-br-md bg-cyan-800 text-white" : message.failed ? "rounded-bl-md border border-red-200 bg-red-50 text-red-800" : message.stopped ? "rounded-bl-md border border-amber-200 bg-amber-50 text-slate-700" : "rounded-bl-md border border-slate-200 bg-white text-slate-700"}`}>{message.content}</div>{message.role === "assistant" && <div className="mt-1 flex items-center gap-2 px-1">{typeof message.elapsedMs === "number" && <p aria-label="ZominAI response metrics" className="text-[10px] text-slate-400">{message.stopped ? "Stopped after" : "Completed in"} {zominAiElapsedLabel(message.elapsedMs)}{message.stopped ? "" : typeof message.tokensPerSecond === "number" ? ` · ${message.tokensPerSecondEstimated ? "est. " : ""}${zominAiTokensPerSecondLabel(message.tokensPerSecond)}` : " · TPS unavailable"}</p>}{(message.failed || message.stopped) && index === activeSession.messages.length - 1 && <button aria-label="Retry message to ZominAI" className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-semibold text-cyan-800 transition hover:bg-cyan-50 disabled:text-slate-300" disabled={sending} onClick={() => void retryLastMessage()} type="button"><RotateCcw size={12} /> Try again</button>}</div>}</div></div>)}
            {warmup.state === "warming" && <div className="flex justify-start"><div aria-label="ZominAI warm-up status" aria-live="polite" className="inline-flex max-w-[88%] items-center gap-2 rounded-2xl rounded-bl-md border border-cyan-200 bg-white px-3 py-2.5 text-sm leading-6 text-slate-600 shadow-sm"><span className="grid size-6 shrink-0 place-items-center overflow-hidden rounded-lg bg-cyan-950 p-0.5"><img className="size-full rounded-md object-cover" src={zominAiButtonUrl} alt="" /></span><LoaderCircle className="shrink-0 animate-spin text-cyan-700" size={15} /><span>{zominAiWarmupMessages[warmupMessageIndex]}</span></div></div>}
            {warmup.state === "failed" && <div className="flex justify-start"><div className="max-w-[88%]"><div aria-label="ZominAI warm-up failed" className="rounded-2xl rounded-bl-md border border-red-200 bg-red-50 px-3 py-2.5 text-sm leading-6 text-red-800">I could not finish warming up. {warmup.detail}</div><button className="mt-1 inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-semibold text-cyan-800 transition hover:bg-cyan-50" onClick={() => { warmedModelRef.current = null; setWarmupAttempt((attempt) => attempt + 1); onRefreshConnection(); }} type="button"><RotateCcw size={12} /> Try warm-up again</button></div></div>}
            {sending && <div className="flex justify-start"><div className="max-w-[88%]"><div className={`rounded-2xl rounded-bl-md border border-slate-200 bg-white px-3 py-2.5 text-sm leading-6 ${streamingReply ? "whitespace-pre-wrap text-slate-700" : "inline-flex items-center gap-2 text-slate-500"}`}>{streamingReply || <><LoaderCircle className="animate-spin" size={15} /> Thinking…</>}</div><p aria-live="polite" className="mt-1 px-1 text-[10px] font-medium text-slate-400">{streamingReply ? "Responding" : "Elapsed"} · {zominAiElapsedLabel(elapsedMs)}</p></div></div>}
          </div>
          <div aria-label="ZominAI context used" className="flex items-center gap-3 border-t border-slate-200 bg-white px-3 py-2">
            <div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-2 text-[11px] text-slate-500"><span className="truncate">Context used · estimated {zominAiTokenLabel(estimatedContextTokens)} / {zominAiTokenLabel(settings.contextTokens)} tokens</span><span className="shrink-0 font-medium text-slate-600">{contextPercent}%</span></div><div aria-hidden="true" className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${contextPercent >= 85 ? "bg-amber-500" : "bg-cyan-600"}`} style={{ width: `${Math.max(2, contextPercent)}%` }} /></div>{activeSession.compactedAt && <p className="mt-1 text-[10px] text-slate-400">Compacted {zominAiTimestamp(activeSession.compactedAt)}</p>}</div>
            <button aria-label="Compact ZominAI context" className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 px-2 py-1.5 text-[11px] font-semibold text-slate-600 hover:border-cyan-300 hover:text-cyan-800 disabled:cursor-not-allowed disabled:text-slate-300" disabled={!canCompactContext || sending} onClick={compactContext} title={canCompactContext ? "Keep recent messages active and compact earlier context locally" : "Add more messages before compacting context"} type="button"><Minimize2 size={14} /><span className="hidden sm:inline">Compact</span></button>
          </div>
          <form className="border-t border-slate-200 bg-white p-3" onSubmit={(event) => { event.preventDefault(); void send(); }}><label className="sr-only" htmlFor="zominai-drawer-message">Message ZominAI</label><div className="flex items-end gap-2 rounded-xl border border-slate-300 p-1.5 focus-within:border-cyan-600 focus-within:ring-4 focus-within:ring-cyan-100"><textarea aria-label="Message ZominAI" className="min-h-10 flex-1 resize-none bg-transparent px-2 py-1.5 text-sm outline-none placeholder:text-slate-400" disabled={sending || !modelReady} id="zominai-drawer-message" onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void send(); } }} placeholder={warmup.state === "warming" ? "ZominAI is warming up…" : warmup.state === "failed" ? "Warm-up required before chatting" : connection.state !== "connected" ? "Connecting to ZominAI…" : "Ask ZominAI…"} rows={1} value={draft} />{sending ? <button aria-label="Stop ZominAI response" className="grid size-9 place-items-center rounded-lg bg-red-600 text-white transition hover:bg-red-700" onClick={stopResponse} title="Stop generating" type="button"><Square fill="currentColor" size={14} /></button> : <button aria-label="Send message to ZominAI" className="grid size-9 place-items-center rounded-lg bg-cyan-700 text-white hover:bg-cyan-800 disabled:bg-slate-300" disabled={!draft.trim() || !modelReady} type="submit"><Send size={17} /></button>}</div></form>
        </section>
      </div>
    </div>
  </aside>;
}
