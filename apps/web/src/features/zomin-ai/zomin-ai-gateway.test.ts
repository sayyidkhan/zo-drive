import { afterEach, describe, expect, it, vi } from "vitest";

import {
  sendZominAiMessage,
  zominAiChatUrl,
  zominAiHealthUrl
} from "./zomin-ai-gateway.js";
import type { ZominAiSettings } from "./zomin-ai-types.js";

const settings: ZominAiSettings = {
  contextTokens: 4096,
  endpoint: "http://localhost:3000/zominai",
  model: "Bonsai-8B-Q1_0.gguf",
  systemInstructions: "Reply concisely."
};

describe("ZominAI gateway", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("constructs only HTTP gateway URLs", () => {
    expect(zominAiHealthUrl("http://localhost:3000/zominai?old=1")).toBe(
      "http://localhost:3000/zominai/health"
    );
    expect(zominAiChatUrl("https://drive.example/zominai/")).toBe(
      "https://drive.example/zominai/chat"
    );
    expect(zominAiChatUrl("file:///tmp/runtime")).toBeNull();
    expect(zominAiHealthUrl("not a url")).toBeNull();
  });

  it("parses streamed content, progress, and runtime metrics", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(
      'data: {"choices":[{"delta":{"content":"Streamed"}}]}\n\n'
      + 'data: {"choices":[{"delta":{"content":" reply"}}]}\n\n'
      + 'data: {"choices":[],"usage":{"completion_tokens":12},"timings":{"predicted_per_second":24}}\n\n'
      + "data: [DONE]\n\n",
      { headers: { "content-type": "text/event-stream" }, status: 200 }
    ));
    const progress: string[] = [];

    const reply = await sendZominAiMessage(
      settings,
      [{ role: "user", content: "Stream a reply" }],
      undefined,
      undefined,
      (content) => progress.push(content)
    );

    expect(reply).toMatchObject({
      completionTokens: 12,
      content: "Streamed reply",
      tokensPerSecond: 24
    });
    expect(progress).toEqual(["Streamed", "Streamed reply"]);
  });

  it("feeds tool results back into the local runtime", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({
        choices: [{
          message: {
            content: "",
            tool_calls: [{
              function: { arguments: "{}", name: "list_drive" },
              id: "tool-1",
              type: "function"
            }]
          }
        }]
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        choices: [{ message: { content: "Your Drive has one file." } }]
      }), { status: 200 }));
    const toolRunner = vi.fn().mockResolvedValue('{"files":[{"name":"notes.txt"}]}');

    const reply = await sendZominAiMessage(
      settings,
      [{ role: "user", content: "What is in my Drive?" }],
      toolRunner
    );

    expect(reply.content).toBe("Your Drive has one file.");
    expect(toolRunner).toHaveBeenCalledWith("list_drive", "{}", undefined);
    const followUp = JSON.parse(String(fetchSpy.mock.calls[1]?.[1]?.body)) as {
      messages: Array<{ role: string; tool_call_id?: string }>;
    };
    expect(followUp.messages).toContainEqual(
      expect.objectContaining({ role: "tool", tool_call_id: "tool-1" })
    );
  });

  it("propagates cancellation to the active request", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(
      async (_input, init) => await new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener(
          "abort",
          () => reject(new DOMException("Stopped", "AbortError")),
          { once: true }
        );
      })
    );
    const controller = new AbortController();
    const request = sendZominAiMessage(
      settings,
      [{ role: "user", content: "Keep thinking" }],
      undefined,
      undefined,
      undefined,
      controller.signal
    );

    controller.abort();

    await expect(request).rejects.toMatchObject({ name: "AbortError" });
  });
});
