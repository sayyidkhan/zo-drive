export type ZominAiPane = "install" | "settings" | "uninstall" | "verify";

export type ZominAiSettings = {
  contextTokens: number;
  endpoint: string;
  model: string;
  systemInstructions: string;
};

export type ZominAiWarmup = {
  detail: string;
  state: "idle" | "warming" | "ready" | "failed";
};

export type ZominAiVerification = {
  checkedAt: string;
  runtime: { detail: string; ready: boolean };
};

export type ZominAiDownloadStatus = {
  detail: string;
  downloadedBytes: number;
  expectedBytes: number;
  progress: number;
  state: "downloading" | "ready" | "stopped";
  updatedAt: string;
};
export type ZominAiInstallation = { model: { fileName: string; installed: boolean; location: string; sizeBytes: number; version: string }; runtimeLocation: string; state: "downloading" | "installed" | "not-installed" | "removed" };

export type ZominAiConnection = {
  detail: string;
  models: string[];
  state: "checking" | "connected" | "disconnected";
};

export type ZominAiChatMessage = {
  content: string;
  elapsedMs?: number;
  failed?: boolean;
  role: "assistant" | "user";
  stopped?: boolean;
  tokensPerSecond?: number;
  tokensPerSecondEstimated?: boolean;
};

export type ZominAiCompletion = {
  content: string;
  completionTokens?: number;
  tokensPerSecond?: number;
  tokensPerSecondEstimated?: boolean;
  toolCalls: ZominAiToolCall[];
};

export type ZominAiReply = Omit<ZominAiCompletion, "toolCalls">;

export type ZominAiToolName = "describe_database" | "get_current_time" | "get_storage_usage" | "list_databases" | "list_drive" | "query_database" | "read_drive_file" | "search_drive";

export type ZominAiToolCall = {
  function: { arguments: string; name: ZominAiToolName };
  id: string;
  type: "function";
};

export type ZominAiRuntimeMessage = ZominAiChatMessage | {
  content: string;
  role: "assistant";
  tool_calls: ZominAiToolCall[];
} | {
  content: string;
  role: "tool";
  tool_call_id: string;
};

export type ZominAiToolRunner = (name: ZominAiToolName, argumentsJson: string, signal?: AbortSignal) => Promise<string>;

export type ZominAiChatSession = {
  compactedAt?: string;
  contextSummary?: string;
  createdAt: string;
  id: string;
  messages: ZominAiChatMessage[];
  title: string;
  updatedAt: string;
};
