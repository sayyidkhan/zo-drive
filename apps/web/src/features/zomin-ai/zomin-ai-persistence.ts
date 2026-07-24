import { createZominAiChatSession } from "./zomin-ai-chat-domain.js";
import type { ZominAiChatMessage, ZominAiChatSession } from "./zomin-ai-types.js";

const chatsStorageKey = "zo-drive:zominai:chats:v1";
const drawerWidthStorageKey = "zo-drive:zominai:drawer-width:v1";

export function readZominAiChatSessions(): ZominAiChatSession[] {
  try {
    const stored = JSON.parse(window.localStorage.getItem(chatsStorageKey) ?? "[]") as unknown;
    if (!Array.isArray(stored)) return [createZominAiChatSession()];
    const sessions = stored.flatMap((value): ZominAiChatSession[] => {
      if (!value || typeof value !== "object") return [];
      const session = value as Partial<ZominAiChatSession>;
      if (typeof session.id !== "string" || typeof session.title !== "string" || typeof session.createdAt !== "string" || typeof session.updatedAt !== "string" || !Array.isArray(session.messages)) return [];
      const messages = session.messages.flatMap((message): ZominAiChatMessage[] => {
        if (!message || typeof message !== "object" || (message as { role?: unknown }).role === "system" || !["assistant", "user"].includes((message as { role?: unknown }).role as string) || typeof (message as { content?: unknown }).content !== "string") return [];
        const elapsedMs = (message as { elapsedMs?: unknown }).elapsedMs;
        const tokensPerSecond = (message as { tokensPerSecond?: unknown }).tokensPerSecond;
        const tokensPerSecondEstimated = (message as { tokensPerSecondEstimated?: unknown }).tokensPerSecondEstimated === true;
        const role = (message as ZominAiChatMessage).role;
        const content = (message as ZominAiChatMessage).content;
        const failed = (message as { failed?: unknown }).failed === true || (role === "assistant" && content.startsWith("I could not connect to ZominAI."));
        const stopped = (message as { stopped?: unknown }).stopped === true;
        return [{ role, content, ...(typeof elapsedMs === "number" && Number.isFinite(elapsedMs) && elapsedMs >= 0 ? { elapsedMs } : {}), ...(typeof tokensPerSecond === "number" && Number.isFinite(tokensPerSecond) && tokensPerSecond > 0 ? { tokensPerSecond, ...(tokensPerSecondEstimated ? { tokensPerSecondEstimated: true } : {}) } : {}), ...(failed ? { failed: true } : {}), ...(stopped ? { stopped: true } : {}) }];
      });
      const compactedAt = typeof session.compactedAt === "string" ? session.compactedAt : undefined;
      const contextSummary = typeof session.contextSummary === "string" ? session.contextSummary.slice(0, 6_000) : undefined;
      return [{ id: session.id, title: session.title.slice(0, 120), ...(compactedAt ? { compactedAt } : {}), ...(contextSummary ? { contextSummary } : {}), createdAt: session.createdAt, updatedAt: session.updatedAt, messages }];
    });
    return sessions.length > 0 ? sessions.slice(0, 50) : [createZominAiChatSession()];
  } catch {
    return [createZominAiChatSession()];
  }
}

export function readZominAiDrawerWidth(): number {
  try {
    const width = Number(window.localStorage.getItem(drawerWidthStorageKey));
    return Number.isFinite(width) ? Math.max(360, Math.min(640, Math.round(width))) : 480;
  } catch {
    return 480;
  }
}


export function writeZominAiChatSessions(sessions: ZominAiChatSession[]): void {
  window.localStorage.setItem(chatsStorageKey, JSON.stringify(sessions));
}

export function writeZominAiDrawerWidth(width: number): void {
  window.localStorage.setItem(drawerWidthStorageKey, String(width));
}
