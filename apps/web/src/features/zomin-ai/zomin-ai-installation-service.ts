import { zominAiGatewayUrl, zominAiStatusUrl } from "./zomin-ai-config.js";
import { zominAiHealthUrl, zominAiResponseError } from "./zomin-ai-gateway.js";
import type {
  ZominAiDownloadStatus,
  ZominAiInstallation,
  ZominAiSettings,
  ZominAiVerification
} from "./zomin-ai-types.js";

export async function getZominAiDownloadStatus(signal?: AbortSignal): Promise<ZominAiDownloadStatus> {
  const response = await fetch(zominAiStatusUrl, { headers: { Accept: "application/json" }, signal });
  if (!response.ok) throw new Error(`Status service returned ${response.status}`);
  const body = await response.json() as { model?: unknown; status?: unknown };
  if (body.status !== "ready" || typeof body.model !== "string") throw new Error("Bonsai 8B is not ready");
  return { detail: `${body.model} is ready on your Zo Computer.`, downloadedBytes: 1, expectedBytes: 1, progress: 1, state: "ready", updatedAt: new Date().toISOString() };
}
export async function getZominAiInstallation(signal?: AbortSignal): Promise<ZominAiInstallation> {
  const response = await fetch(`${zominAiGatewayUrl()}/installation`, { headers: { Accept: "application/json" }, signal });
  if (!response.ok) throw new Error(`Installation service returned ${response.status}`);
  return await response.json() as ZominAiInstallation;
}
export async function updateZominAiInstallation(method: "DELETE" | "POST", version: string): Promise<void> {
  const response = await fetch(`${zominAiGatewayUrl()}/installation`, { body: JSON.stringify({ version }), headers: { Accept: "application/json", "Content-Type": "application/json" }, method });
  if (response.ok) return;
  throw await zominAiResponseError(response);
}

export async function verifyZominAiInstall(settings: ZominAiSettings): Promise<ZominAiVerification> {
  const healthUrl = zominAiHealthUrl(settings.endpoint);
  if (!healthUrl) {
    return { checkedAt: new Date().toISOString(), runtime: { ready: false, detail: "The ZominAI gateway address is invalid." } };
  }
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 4000);
  let runtime: ZominAiVerification["runtime"];
  try {
    const response = await fetch(healthUrl, { headers: { Accept: "application/json" }, signal: controller.signal });
    if (!response.ok) {
      runtime = { ready: false, detail: `The Zo Computer could not reach Bonsai 8B (HTTP ${response.status}).` };
      return { checkedAt: new Date().toISOString(), runtime };
    }
    const body = await response.json() as { model?: unknown; status?: unknown };
    runtime = body.status === "ready" && typeof body.model === "string"
      ? { ready: true, detail: `${body.model} is ready on your Zo Computer.` }
      : { ready: false, detail: "The Zo Computer runtime responded, but Bonsai 8B is not loaded yet." };
  } catch {
    runtime = { ready: false, detail: "The private Bonsai 8B runtime is unavailable. If you just installed it, wait for the model download and startup to finish." };
  } finally {
    window.clearTimeout(timeout);
  }
  return { checkedAt: new Date().toISOString(), runtime };
}
