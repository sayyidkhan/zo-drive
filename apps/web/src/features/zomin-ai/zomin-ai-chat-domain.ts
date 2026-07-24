import type { ZominAiChatMessage, ZominAiChatSession } from "./zomin-ai-types.js";

export function createZominAiChatSession(): ZominAiChatSession {
  const now = new Date().toISOString();
  return {
    createdAt: now,
    id: typeof crypto?.randomUUID === "function" ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    messages: [],
    title: "New chat",
    updatedAt: now
  };
}
const zominAiRecentMessageCount = 6;

export function zominAiChatTitle(content: string): string {
  const words = content.replace(/\s+/g, " ").trim().replace(/[.?!]+$/, "").split(" ").filter(Boolean);
  if (words.length === 0) return "New chat";
  const title = words.slice(0, 8).join(" ");
  return words.length > 8 ? `${title}…` : title;
}
export function zominAiTimestamp(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Unknown time" : date.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}

export function zominAiElapsedLabel(elapsedMs: number): string {
  if (elapsedMs < 60_000) return `${(elapsedMs / 1_000).toFixed(1)}s`;
  const minutes = Math.floor(elapsedMs / 60_000);
  const seconds = Math.floor((elapsedMs % 60_000) / 1_000);
  return `${minutes}m ${seconds}s`;
}

export function zominAiContextSummary(messages: ZominAiChatMessage[]): string | null {
  const contextMessages = messages.filter((message) => !message.failed && !message.stopped);
  const olderMessages = contextMessages.slice(0, -zominAiRecentMessageCount);
  if (olderMessages.length === 0) return null;
  const notes = olderMessages.slice(-12).map((message) => `${message.role === "user" ? "User" : "ZominAI"}: ${message.content.replace(/\s+/g, " ").slice(0, 280)}`);
  return `Conversation notes from ${olderMessages.length} earlier message${olderMessages.length === 1 ? "" : "s"}:\n${notes.join("\n")}`;
}

export function zominAiContextMessages(session: ZominAiChatSession, messages: ZominAiChatMessage[]): ZominAiChatMessage[] {
  const contextMessages = messages.filter((message) => !message.failed && !message.stopped);
  return session.contextSummary ? contextMessages.slice(-zominAiRecentMessageCount) : contextMessages;
}

export function zominAiEstimatedContextTokens(messages: ZominAiChatMessage[], summary?: string, systemInstructions = ""): number {
  const characters = messages.reduce((total, message) => total + message.content.length + 16, (summary?.length ?? 0) + systemInstructions.length + 520);
  return Math.max(1, Math.ceil(characters / 4));
}

export function zominAiTokenLabel(tokens: number): string {
  return tokens >= 1_000 ? `${(tokens / 1_000).toFixed(tokens >= 10_000 ? 0 : 1)}k` : String(tokens);
}

export function zominAiTokensPerSecondLabel(tokensPerSecond: number): string {
  return `${tokensPerSecond.toFixed(1)} tok/s`;
}
