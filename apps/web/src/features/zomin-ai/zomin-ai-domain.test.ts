import { beforeEach, describe, expect, it } from "vitest";

import {
  zominAiChatTitle,
  zominAiContextMessages,
  zominAiContextSummary,
  zominAiEstimatedContextTokens
} from "./zomin-ai-chat-domain.js";
import {
  defaultZominAiSettings,
  readZominAiSettings,
  writeZominAiSettings,
  zominAiSystemInstructionsMaxCharacters
} from "./zomin-ai-config.js";
import {
  readZominAiChatSessions,
  readZominAiDrawerWidth,
  writeZominAiChatSessions,
  writeZominAiDrawerWidth
} from "./zomin-ai-persistence.js";
import type { ZominAiChatMessage, ZominAiChatSession } from "./zomin-ai-types.js";

describe("ZominAI domain", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("creates concise chat titles from the first user message", () => {
    expect(zominAiChatTitle("  How   much storage do I have?  ")).toBe(
      "How much storage do I have"
    );
    expect(zominAiChatTitle("one two three four five six seven eight nine")).toBe(
      "one two three four five six seven eight…"
    );
    expect(zominAiChatTitle("   ")).toBe("New chat");
  });

  it("compacts only successful conversation history", () => {
    const messages: ZominAiChatMessage[] = [
      { role: "user", content: "one" },
      { role: "assistant", content: "two" },
      { role: "user", content: "three" },
      { role: "assistant", content: "four" },
      { role: "user", content: "five" },
      { role: "assistant", content: "six" },
      { role: "assistant", content: "failed", failed: true },
      { role: "user", content: "seven" },
      { role: "assistant", content: "stopped", stopped: true },
      { role: "assistant", content: "eight" }
    ];
    const summary = zominAiContextSummary(messages);
    expect(summary).toContain("2 earlier messages");
    expect(summary).toContain("User: one");
    expect(summary).toContain("ZominAI: two");
    expect(summary).not.toContain("failed");
    expect(summary).not.toContain("stopped");

    const session: ZominAiChatSession = {
      contextSummary: summary!,
      createdAt: "2026-01-01T00:00:00.000Z",
      id: "session-1",
      messages,
      title: "Storage",
      updatedAt: "2026-01-01T00:00:00.000Z"
    };
    expect(zominAiContextMessages(session, messages)).toHaveLength(6);
    expect(zominAiEstimatedContextTokens(messages, summary!, "Be concise")).toBeGreaterThan(1);
  });

  it("sanitises persisted sessions and legacy failed replies", () => {
    const sessions: ZominAiChatSession[] = [{
      createdAt: "2026-01-01T00:00:00.000Z",
      id: "session-1",
      messages: [{
        role: "assistant",
        content: "I could not connect to ZominAI. Runtime unavailable."
      }],
      title: "A".repeat(140),
      updatedAt: "2026-01-01T00:00:00.000Z"
    }];
    writeZominAiChatSessions(sessions);

    const restored = readZominAiChatSessions();
    expect(restored).toHaveLength(1);
    expect(restored[0]?.title).toHaveLength(120);
    expect(restored[0]?.messages[0]).toMatchObject({ failed: true });
  });

  it("clamps browser settings and never restores a saved remote endpoint", () => {
    writeZominAiSettings({
      contextTokens: 99_999,
      endpoint: "https://untrusted.example",
      model: "Bonsai-custom.gguf",
      systemInstructions: "x".repeat(zominAiSystemInstructionsMaxCharacters + 50)
    });

    const settings = readZominAiSettings();
    expect(settings.contextTokens).toBe(32768);
    expect(settings.endpoint).toBe(defaultZominAiSettings.endpoint);
    expect(settings.model).toBe("Bonsai-custom.gguf");
    expect(settings.systemInstructions).toHaveLength(zominAiSystemInstructionsMaxCharacters);
  });

  it("clamps persisted drawer width to the supported range", () => {
    writeZominAiDrawerWidth(10_000);
    expect(readZominAiDrawerWidth()).toBe(640);
    writeZominAiDrawerWidth(100);
    expect(readZominAiDrawerWidth()).toBe(360);
  });
});
