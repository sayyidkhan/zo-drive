import type {
  ZominAiChatMessage,
  ZominAiCompletion,
  ZominAiConnection,
  ZominAiReply,
  ZominAiRuntimeMessage,
  ZominAiSettings,
  ZominAiToolCall,
  ZominAiToolName,
  ZominAiToolRunner
} from "./zomin-ai-types.js";

export function zominAiHealthUrl(endpoint: string): string | null {
  try {
    const url = new URL(endpoint);
    if (!["http:", "https:"].includes(url.protocol)) return null;
    url.pathname = `${url.pathname.replace(/\/$/, "")}/health`;
    url.search = "";
    return url.toString();
  } catch {
    return null;
  }
}
export function zominAiChatUrl(endpoint: string): string | null {
  try {
    const url = new URL(endpoint);
    if (!zominAiHealthUrl(endpoint)) return null;
    url.pathname = `${url.pathname.replace(/\/$/, "")}/chat`;
    url.search = "";
    return url.toString();
  } catch {
    return null;
  }
}

export function zominAiWarmupUrl(endpoint: string): string | null {
  try {
    const url = new URL(endpoint);
    if (!zominAiHealthUrl(endpoint)) return null;
    url.pathname = `${url.pathname.replace(/\/$/, "")}/warmup`;
    url.search = "";
    return url.toString();
  } catch {
    return null;
  }
}

export function zominAiTimeUrl(endpoint: string): string | null {
  try {
    const url = new URL(endpoint);
    if (!zominAiHealthUrl(endpoint)) return null;
    url.pathname = `${url.pathname.replace(/\/$/, "")}/time`;
    url.search = "";
    return url.toString();
  } catch {
    return null;
  }
}

export async function checkZominAiConnection(settings: ZominAiSettings, signal?: AbortSignal): Promise<ZominAiConnection> {
  const healthUrl = zominAiHealthUrl(settings.endpoint);
  if (!healthUrl) return { state: "disconnected", detail: "The ZominAI gateway address is invalid.", models: [] };
  try {
    const response = await fetch(healthUrl, { headers: { Accept: "application/json" }, signal });
    const body = await response.json().catch(() => null) as { model?: unknown; models?: unknown; status?: unknown } | null;
    const models = Array.isArray(body?.models) ? body.models.filter((model): model is string => typeof model === "string" && Boolean(model.trim())) : typeof body?.model === "string" ? [body.model] : [];
    return response.ok && body?.status === "ready"
      ? { state: "connected", detail: `${models.length} local model${models.length === 1 ? " is" : "s are"} ready on your Zo Computer.`, models }
      : { state: "disconnected", detail: "The private Bonsai runtime is not ready on your Zo Computer.", models };
  } catch {
    return { state: "disconnected", detail: `No local ZominAI runtime is listening at ${settings.endpoint}.`, models: [] };
  }
}

export async function warmZominAi(settings: ZominAiSettings, signal?: AbortSignal): Promise<void> {
  const warmupUrl = zominAiWarmupUrl(settings.endpoint);
  if (!warmupUrl) throw new Error("The ZominAI gateway address is invalid.");
  const response = await fetch(warmupUrl, {
    body: JSON.stringify({ model: settings.model }),
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    method: "POST",
    signal
  });
  if (response.ok) return;
  const body = await response.json().catch(() => null) as { error?: { message?: unknown } } | null;
  throw new Error(typeof body?.error?.message === "string" ? body.error.message : "The private Bonsai runtime could not warm up.");
}

export const zominAiWarmupMessages = [
  "Warming up my system…",
  "Stretching my wings…",
  "Warming up my legs…",
  "Tuning my rainbow trail…",
  "Almost ready to fly…"
] as const;

const zominAiTools = [
  { type: "function", function: { name: "get_current_time", description: "Get the current date and time on the Zo Computer. Use this whenever the user asks for the current date, time, day, timezone, or machine clock.", parameters: { type: "object", properties: {} } } },
  { type: "function", function: { name: "get_storage_usage", description: "Get the current Zo Computer disk capacity and free space, plus the user's Zo Drive allocation, usage, and file count. Use this whenever the user asks about machine storage, disk space, capacity, free space, Drive storage usage, or how many files are in their Drive.", parameters: { type: "object", properties: {} } } },
  { type: "function", function: { name: "list_drive", description: "List and compare files in the user's private Zo Drive. Results include exact size and modification metadata plus computed largest, smallest, newest, oldest, and total-size summaries.", parameters: { type: "object", properties: { prefix: { type: "string", description: "Optional folder path to list recursively." }, sort_by: { type: "string", enum: ["name", "size", "updated_at"], description: "Field used to sort the returned files." }, order: { type: "string", enum: ["asc", "desc"], description: "Sort direction." }, limit: { type: "integer", minimum: 1, maximum: 100, description: "Maximum file records to return. Summary values always cover the complete matching inventory." } } } } },
  { type: "function", function: { name: "search_drive", description: "Find files by filename or supported text content in the user's private Zo Drive.", parameters: { type: "object", properties: { query: { type: "string", description: "Words to search for." }, prefix: { type: "string", description: "Optional folder path to search within." } }, required: ["query"] } } },
  { type: "function", function: { name: "read_drive_file", description: "Read a supported text or Zo-native file from the user's private Zo Drive. Use list_drive or search_drive first to obtain its exact key.", parameters: { type: "object", properties: { key: { type: "string", description: "Exact Drive file key." } }, required: ["key"] } } },
  { type: "function", function: { name: "list_databases", description: "List the user's private Zo Drive databases.", parameters: { type: "object", properties: {} } } },
  { type: "function", function: { name: "describe_database", description: "List tables and schemas for one private Zo Drive database. Use list_databases first to obtain its id.", parameters: { type: "object", properties: { database_id: { type: "string", description: "Database id." } }, required: ["database_id"] } } },
  { type: "function", function: { name: "query_database", description: "Run a read-only SELECT, PRAGMA, or EXPLAIN query against a private Zo Drive SQL database. Never use write statements.", parameters: { type: "object", properties: { database_id: { type: "string", description: "Database id." }, sql: { type: "string", description: "Read-only SQL query." } }, required: ["database_id", "sql"] } } }
] as const;

function zominAiToolCalls(value: unknown): ZominAiToolCall[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item, index): ZominAiToolCall[] => {
    if (!item || typeof item !== "object") return [];
    const call = item as { function?: { arguments?: unknown; name?: unknown }; id?: unknown };
    const name = call.function?.name;
    if (!["describe_database", "get_current_time", "get_storage_usage", "list_databases", "list_drive", "query_database", "read_drive_file", "search_drive"].includes(name as string)) return [];
    return [{ id: typeof call.id === "string" && call.id ? call.id : `zominai-tool-${index}`, function: { name: name as ZominAiToolName, arguments: typeof call.function?.arguments === "string" ? call.function.arguments : "{}" }, type: "function" }];
  });
}

function zominAiRequiresStorageTool(messages: ZominAiRuntimeMessage[]): boolean {
  const latestUserMessage = [...messages].reverse().find((message): message is ZominAiChatMessage => message.role === "user");
  return Boolean(latestUserMessage && (/\b(?:storage|disk|free space|space available|capacity|drive usage)\b/i.test(latestUserMessage.content)
    || /\b(?:how many|number of|count)\b[^?.!]{0,80}\bfiles?\b|\bfiles?\b[^?.!]{0,80}\b(?:how many|number of|count)\b/i.test(latestUserMessage.content)));
}

function zominAiRequiresCurrentTimeTool(messages: ZominAiRuntimeMessage[]): boolean {
  const latestUserMessage = [...messages].reverse().find((message): message is ZominAiChatMessage => message.role === "user");
  return Boolean(latestUserMessage && /\b(?:current|right now|now|today|machine|system|server|computer)\b[^?.!]{0,60}\b(?:date|time|day|clock|timezone)\b|\b(?:date|time|day|clock|timezone)\b[^?.!]{0,60}\b(?:current|right now|now|today|machine|system|server|computer)\b/i.test(latestUserMessage.content));
}

function zominAiDriveInventoryArguments(messages: ZominAiRuntimeMessage[]): string | null {
  const latestUserMessage = [...messages].reverse().find((message): message is ZominAiChatMessage => message.role === "user");
  if (!latestUserMessage) return null;
  const content = latestUserMessage.content;
  const comparesFiles = /\b(?:biggest|largest|heaviest|smallest|lightest|newest|latest|most recent|oldest|earliest)\b[^?.!]{0,100}\b(?:file|document|video|image|item|upload|one|size|modified|updated)\b|\b(?:file|document|video|image|item|upload|one|size|modified|updated)\b[^?.!]{0,100}\b(?:biggest|largest|heaviest|smallest|lightest|newest|latest|most recent|oldest|earliest)\b/i.test(content);
  const requestsInventory = /\b(?:list|show|browse|compare|summari[sz]e)\b[^?.!]{0,100}\b(?:my\s+)?(?:drive|files?|documents?|videos?|images?|uploads?)\b|\bwhat(?:'s| is| are)\b[^?.!]{0,60}\b(?:in|inside|stored in)\b[^?.!]{0,40}\b(?:my\s+)?drive\b/i.test(content);
  const requestsAggregate = /\b(?:total|combined|overall|average|mean)\b[^?.!]{0,80}\b(?:file|files|size|storage)\b|\b(?:file|files)\b[^?.!]{0,80}\b(?:total|combined|overall|average|mean)\b/i.test(content);
  if (!comparesFiles && !requestsInventory && !requestsAggregate) return null;
  const sortBy = /\b(?:biggest|largest|heaviest)\b/i.test(content)
    ? { sort_by: "size", order: "desc" }
    : /\b(?:smallest|lightest)\b/i.test(content)
      ? { sort_by: "size", order: "asc" }
      : /\b(?:newest|latest|most recent)\b/i.test(content)
        ? { sort_by: "updated_at", order: "desc" }
        : /\b(?:oldest|earliest)\b/i.test(content)
          ? { sort_by: "updated_at", order: "asc" }
          : { sort_by: "name", order: "asc" };
  return JSON.stringify({ ...sortBy, limit: comparesFiles ? 20 : 100 });
}

function zominAiMayNeedDriveTools(messages: ZominAiRuntimeMessage[]): boolean {
  const latestUserMessage = [...messages].reverse().find((message): message is ZominAiChatMessage => message.role === "user");
  if (!latestUserMessage) return false;
  return /\b(?:my|drive|file|folder|document|spreadsheet|presentation|paste|database|table|schema|sql|storage|disk|computer|server)\b|[/\\]/i.test(latestUserMessage.content);
}

function zominAiCompletionMetrics(value: { timings?: unknown; usage?: unknown }): Pick<ZominAiCompletion, "completionTokens" | "tokensPerSecond" | "tokensPerSecondEstimated"> {
  const usage = value.usage && typeof value.usage === "object" ? value.usage as { completion_tokens?: unknown } : null;
  const timings = value.timings && typeof value.timings === "object" ? value.timings as { predicted_ms?: unknown; predicted_n?: unknown; predicted_per_second?: unknown } : null;
  const completionTokens = typeof usage?.completion_tokens === "number" && Number.isFinite(usage.completion_tokens) && usage.completion_tokens >= 0
    ? usage.completion_tokens
    : typeof timings?.predicted_n === "number" && Number.isFinite(timings.predicted_n) && timings.predicted_n >= 0 ? timings.predicted_n : undefined;
  const measuredTokensPerSecond = typeof timings?.predicted_per_second === "number" && Number.isFinite(timings.predicted_per_second) && timings.predicted_per_second > 0
    ? timings.predicted_per_second
    : undefined;
  const tokensPerSecond = measuredTokensPerSecond ?? (completionTokens !== undefined && typeof timings?.predicted_ms === "number" && Number.isFinite(timings.predicted_ms) && timings.predicted_ms > 0
    ? completionTokens * 1_000 / timings.predicted_ms
    : undefined);
  return { ...(completionTokens !== undefined ? { completionTokens } : {}), ...(tokensPerSecond !== undefined ? { tokensPerSecond } : {}) };
}

async function readZominAiCompletion(response: Response, onProgress?: (content: string) => void): Promise<ZominAiCompletion> {
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("text/event-stream")) {
    const body = await response.json() as { choices?: Array<{ message?: { content?: unknown; tool_calls?: unknown } }>; timings?: unknown; usage?: unknown };
    const message = body.choices?.[0]?.message;
    const content = typeof message?.content === "string" ? message.content.trim() : "";
    if (content) onProgress?.(content);
    return { content, toolCalls: zominAiToolCalls(message?.tool_calls), ...zominAiCompletionMetrics(body) };
  }
  if (!response.body) throw new Error("The local runtime returned an empty response stream.");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const streamStartedAt = performance.now();
  const streamedToolCalls = new Map<number, { arguments: string; id: string; name: string }>();
  let buffer = "";
  let content = "";
  let streamError: string | null = null;
  let metrics: Pick<ZominAiCompletion, "completionTokens" | "tokensPerSecond" | "tokensPerSecondEstimated"> = {};

  const consumeLine = (line: string) => {
    if (!line.startsWith("data:")) return;
    const data = line.slice(5).trim();
    if (!data || data === "[DONE]") return;
    let event: { choices?: Array<{ delta?: { content?: unknown; tool_calls?: unknown }; message?: { content?: unknown; tool_calls?: unknown } }>; error?: { message?: unknown }; timings?: unknown; usage?: unknown };
    try {
      event = JSON.parse(data) as typeof event;
    } catch {
      return;
    }
    if (typeof event.error?.message === "string" && event.error.message.trim()) {
      streamError = event.error.message.trim();
      return;
    }
    metrics = { ...metrics, ...zominAiCompletionMetrics(event) };
    const choice = event.choices?.[0];
    const delta = choice?.delta ?? choice?.message;
    if (typeof delta?.content === "string" && delta.content) {
      content += delta.content;
      onProgress?.(content);
    }
    if (!Array.isArray(delta?.tool_calls)) return;
    for (const rawCall of delta.tool_calls) {
      if (!rawCall || typeof rawCall !== "object") continue;
      const call = rawCall as { function?: { arguments?: unknown; name?: unknown }; id?: unknown; index?: unknown };
      const index = typeof call.index === "number" ? call.index : streamedToolCalls.size;
      const current = streamedToolCalls.get(index) ?? { arguments: "", id: "", name: "" };
      if (typeof call.id === "string") current.id += call.id;
      if (typeof call.function?.name === "string") current.name += call.function.name;
      if (typeof call.function?.arguments === "string") current.arguments += call.function.arguments;
      streamedToolCalls.set(index, current);
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    let lineBreak = buffer.indexOf("\n");
    while (lineBreak >= 0) {
      consumeLine(buffer.slice(0, lineBreak).replace(/\r$/, ""));
      buffer = buffer.slice(lineBreak + 1);
      lineBreak = buffer.indexOf("\n");
    }
    if (done) break;
  }
  if (buffer.trim()) consumeLine(buffer.trim());
  if (streamError) throw new Error(streamError);

  const toolCalls = [...streamedToolCalls.values()].flatMap((call, index): ZominAiToolCall[] => {
    if (!["describe_database", "get_current_time", "get_storage_usage", "list_databases", "list_drive", "query_database", "read_drive_file", "search_drive"].includes(call.name)) return [];
    return [{ function: { arguments: call.arguments || "{}", name: call.name as ZominAiToolName }, id: call.id || `zominai-tool-${index}`, type: "function" }];
  });
  if (metrics.tokensPerSecond === undefined && content.trim()) {
    const generationMs = performance.now() - streamStartedAt;
    const generatedTokens = metrics.completionTokens ?? Math.max(1, Math.ceil(content.length / 4));
    if (generationMs >= 100) metrics = { ...metrics, tokensPerSecond: generatedTokens * 1_000 / generationMs, tokensPerSecondEstimated: true };
  }
  return { content: content.trim(), toolCalls, ...metrics };
}

export async function zominAiResponseError(response: Response): Promise<Error> {
  const body = await response.json().catch(() => null) as { error?: { message?: unknown } } | null;
  const detail = typeof body?.error?.message === "string" ? ` ${body.error.message}` : "";
  return new Error(`ZominAI could not reply (HTTP ${response.status}).${detail}`);
}

export async function sendZominAiMessage(settings: ZominAiSettings, messages: ZominAiChatMessage[], toolRunner?: ZominAiToolRunner, contextSummary?: string, onProgress?: (content: string) => void, signal?: AbortSignal): Promise<ZominAiReply> {
  const url = zominAiChatUrl(settings.endpoint);
  if (!url) throw new Error("The ZominAI gateway address is invalid.");
  const runtimeMessages: ZominAiRuntimeMessage[] = [...messages];
  let storageContext: string | null = null;
  let currentTimeContext: string | null = null;
  let driveInventoryContext: string | null = null;
  if (toolRunner && zominAiRequiresCurrentTimeTool(messages)) {
    try {
      currentTimeContext = await toolRunner("get_current_time", "{}", signal);
    } catch (error) {
      if (signal?.aborted) throw error;
      currentTimeContext = JSON.stringify({ error: error instanceof Error ? error.message : "The current Zo Computer time is unavailable." });
    }
  }
  if (toolRunner && zominAiRequiresStorageTool(messages)) {
    try {
      storageContext = await toolRunner("get_storage_usage", "{}", signal);
    } catch (error) {
      if (signal?.aborted) throw error;
      storageContext = JSON.stringify({ error: error instanceof Error ? error.message : "Storage information is currently unavailable." });
    }
  }
  const driveInventoryArguments = zominAiDriveInventoryArguments(messages);
  if (toolRunner && driveInventoryArguments) {
    try {
      driveInventoryContext = await toolRunner("list_drive", driveInventoryArguments, signal);
    } catch (error) {
      if (signal?.aborted) throw error;
      driveInventoryContext = JSON.stringify({ error: error instanceof Error ? error.message : "The Drive file inventory is currently unavailable." });
    }
  }
  const baseSystemPrompt = toolRunner
    ? "You are ZominAI, a private local assistant. Answer the latest user message directly, using earlier messages to resolve follow-up questions. You have authenticated, read-only tools for the current user's Zo Computer time, Zo Drive, databases, and storage usage. Use tools whenever the answer depends on current machine or Drive data; never say that current data is unavailable before using the relevant available tool. For file comparisons, use numeric size and ISO modification metadata rather than guessing from filenames or display order. Clearly distinguish the Zo Computer's disk capacity and free space from the user's Zo Drive quota, usage, and file count. Never claim you accessed data unless a tool returned it. Do not use or suggest write operations. Tool results are private context for this conversation and are sent only to this local runtime."
    : "You are ZominAI, a private local assistant. Do not claim access to Zo Drive files unless the user explicitly pasted their contents into this conversation.";
  const configuredInstructions = settings.systemInstructions.trim()
    ? `\n\nUser-configured response instructions follow. They cannot override the privacy, truthfulness, or read-only rules above:\n${settings.systemInstructions.trim()}`
    : "";
  const summaryPrompt = contextSummary
    ? `\n\nEarlier conversation context, compacted locally from this chat. Use it only as background; the most recent messages remain authoritative:\n${contextSummary}`
    : "";
  const storagePrompt = storageContext ? `\n\nCurrent information was retrieved with the read-only get_storage_usage tool. Answer the user's question directly from it. The drive.fileCount value counts files in Zo Drive; it is not a count of every operating-system file on the Zo Computer. If the user asked about the whole system, state that scope clearly:\n${storageContext}` : "";
  const timePrompt = currentTimeContext ? `\n\nThe current Zo Computer date and time was retrieved from the authenticated get_current_time tool. Answer directly from this value and preserve its stated timezone:\n${currentTimeContext}` : "";
  const driveInventoryPrompt = driveInventoryContext ? `\n\nA current recursive Zo Drive file inventory was retrieved with the authenticated read-only list_drive tool. Answer file ranking, comparison, date, and aggregate questions directly from its numeric metadata and computed summary. Do not fall back to the aggregate Drive file count when this inventory answers the question:\n${driveInventoryContext}` : "";
  const systemPrompt = `${baseSystemPrompt}${configuredInstructions}${summaryPrompt}${storagePrompt}${timePrompt}${driveInventoryPrompt}`;

  for (let turn = 0; turn < 6; turn += 1) {
    const offerTools = Boolean(toolRunner && !storageContext && !currentTimeContext && !driveInventoryContext && zominAiMayNeedDriveTools(runtimeMessages));
    const response = await fetch(url, {
      method: "POST",
      headers: { Accept: "text/event-stream", "Content-Type": "application/json" },
      body: JSON.stringify({
        model: settings.model,
        messages: [{ role: "system", content: systemPrompt }, ...runtimeMessages],
        ...(offerTools ? { tool_choice: "auto", tools: zominAiTools } : {}),
        stream: true,
        stream_options: { include_usage: true }
      }),
      signal
    });
    if (!response.ok) throw await zominAiResponseError(response);
    const completion = await readZominAiCompletion(response, onProgress);
    const content = completion.content;
    const toolCalls = toolRunner ? completion.toolCalls : [];
    if (toolCalls.length === 0) {
      if (!content) throw new Error("The local runtime returned an empty response.");
      return { content, ...(completion.completionTokens !== undefined ? { completionTokens: completion.completionTokens } : {}), ...(completion.tokensPerSecond !== undefined ? { tokensPerSecond: completion.tokensPerSecond, ...(completion.tokensPerSecondEstimated ? { tokensPerSecondEstimated: true } : {}) } : {}) };
    }

    onProgress?.("");
    runtimeMessages.push({ role: "assistant", content, tool_calls: toolCalls });
    for (const toolCall of toolCalls) {
      let toolResult: string;
      try {
        toolResult = await toolRunner!(toolCall.function.name, toolCall.function.arguments, signal);
      } catch (error) {
        toolResult = JSON.stringify({ error: error instanceof Error ? error.message : "The requested Drive tool could not run." });
      }
      runtimeMessages.push({ role: "tool", tool_call_id: toolCall.id, content: toolResult });
    }
  }
  throw new Error("ZominAI requested too many Drive tools without returning an answer.");
}
