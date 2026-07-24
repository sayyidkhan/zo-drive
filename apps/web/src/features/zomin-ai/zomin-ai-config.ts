import { createDriveUrls, normalizeAppBasePath } from "../../app-urls.js";
import type { ZominAiSettings } from "./zomin-ai-types.js";

const settingsStorageKey = "zo-drive:zominai:v1";
const appBasePath = normalizeAppBasePath(
  import.meta.env.VITE_ZO_DRIVE_APP_BASE_PATH
    ?? (import.meta.env.DEV ? "/" : "/drive")
);
const { zominAiDocsUrl } = createDriveUrls(appBasePath);

export const zominAiButtonUrl = `${appBasePath}/zominai-button.png`;

export function zominAiDocumentationUrl(): string {
  return zominAiDocsUrl();
}

export const zominAiSystemInstructionsMaxCharacters = 2_000;

export const defaultZominAiSystemInstructions =
  "Answer directly and concisely. Use the available read-only tools whenever a question depends on current Zo Drive, database, or storage information. Never guess tool results, and clearly distinguish Zo Drive data from the wider Zo Computer.";

export function zominAiGatewayUrl(): string {
  return import.meta.env.DEV
    ? `${window.location.origin}/zominai`
    : `${window.location.origin}${appBasePath}/zominai`;
}

export function createDefaultZominAiSettings(): ZominAiSettings {
  return {
    contextTokens: 4096,
    endpoint: zominAiGatewayUrl(),
    model: "Bonsai-8B-Q1_0.gguf",
    systemInstructions: defaultZominAiSystemInstructions
  };
}

export const defaultZominAiSettings = createDefaultZominAiSettings();

export const zominAiRuntimeCommand =
  "ZominAI is installed and supervised by Zo on the computer that hosts Zo Drive.";

export const zominAiStatusUrl = `${zominAiGatewayUrl()}/health`;

export function readZominAiSettings(): ZominAiSettings {
  const defaults = defaultZominAiSettings;
  try {
    const saved = JSON.parse(
      window.localStorage.getItem(settingsStorageKey) ?? "{}"
    ) as Partial<ZominAiSettings>;
    return {
      contextTokens: typeof saved.contextTokens === "number" && Number.isFinite(saved.contextTokens)
        ? Math.max(1024, Math.min(32768, Math.round(saved.contextTokens)))
        : defaults.contextTokens,
      endpoint: defaults.endpoint,
      model: typeof saved.model === "string" && saved.model.trim() && saved.model.length <= 256
        ? saved.model
        : defaults.model,
      systemInstructions: typeof saved.systemInstructions === "string"
        ? saved.systemInstructions.slice(0, zominAiSystemInstructionsMaxCharacters)
        : defaults.systemInstructions
    };
  } catch {
    return defaults;
  }
}

export function writeZominAiSettings(settings: ZominAiSettings): void {
  window.localStorage.setItem(settingsStorageKey, JSON.stringify(settings));
}

export function clearZominAiSettings(): void {
  window.localStorage.removeItem(settingsStorageKey);
}
