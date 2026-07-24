import { serve } from "@hono/node-server";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, extname, resolve, sep } from "node:path";
import { execFileSync } from "node:child_process";

import { createApp } from "./app.js";
import { InvalidApiKeyRateLimiter } from "./auth/invalid-api-key-rate-limiter.js";
import { LocalAuthStore } from "./auth/local-auth-store.js";
import { LocalApiKeyStore } from "./auth/local-api-key-store.js";
import { SessionService } from "./auth/session.js";
import { LocalShareStore } from "./sharing/local-share-store.js";
import { LocalFormStore } from "./forms/local-form-store.js";
import { LocalFunctionStore } from "./functions/local-function-store.js";
import { loadServerConfig } from "./server-config.js";
import { LocalDriveStorage } from "./storage/local-drive-storage.js";

const dataRoot = requiredEnvironmentVariable("ZO_DRIVE_DATA_ROOT");
const port = numberEnvironmentVariable("ZO_DRIVE_PORT", 43071);
const allowedOrigin = process.env.ZO_DRIVE_ALLOWED_ORIGIN;
const sessionSecret = process.env.ZO_DRIVE_SESSION_SECRET ?? developmentSessionSecret();
const sessions = new SessionService(sessionSecret);
const apiKeys = new LocalApiKeyStore({ root: dataRoot });
const shareStore = new LocalShareStore({ root: dataRoot });
const formStore = new LocalFormStore({ root: dataRoot });
const functionStore = new LocalFunctionStore(dataRoot);
const storage = new LocalDriveStorage({ root: dataRoot });
const maxDatabaseImportBytes = positiveIntegerEnvironmentVariable("ZO_DRIVE_MAX_DATABASE_IMPORT_BYTES", Number.MAX_SAFE_INTEGER);
const zominAiEndpoint = localHttpEndpoint(process.env.ZO_DRIVE_ZOMINAI_ENDPOINT ?? "http://127.0.0.1:57183");
const zominAiModel = process.env.ZO_DRIVE_ZOMINAI_MODEL ?? "Bonsai-8B-Q1_0.gguf";
const webRoot = process.env.ZO_DRIVE_WEB_ROOT ?? resolve(dirname(fileURLToPath(import.meta.url)), "../../web/dist");
const apiRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const config = await loadServerConfig(process.env.ZO_DRIVE_CONFIG_PATH ?? resolve(apiRoot, "config.json"));
const release = {
  api: "0.5.0",
  gui: "1.25.0",
  revision: deployedRevision(),
  zominai: "1.1.0"
};

const app = createApp({
  storage,
  resolveUserId: async (request) => sessions.userIdFromRequest(request) ?? await apiKeys.userIdFromRequest(request),
  allowedOrigin,
  auth: {
    store: new LocalAuthStore({ root: dataRoot }),
    sessions,
    secureCookies: process.env.NODE_ENV === "production"
  },
  apiKeys,
  invalidApiKeyRateLimiter: new InvalidApiKeyRateLimiter({
    blockDurationMs: (config.rateLimit?.blockSeconds ?? positiveIntegerEnvironmentVariable("ZO_DRIVE_INVALID_API_KEY_BLOCK_SECONDS", 15 * 60)) * 1_000,
    maxAttempts: config.rateLimit?.maxAttempts ?? positiveIntegerEnvironmentVariable("ZO_DRIVE_INVALID_API_KEY_MAX_ATTEMPTS", 5),
    windowMs: (config.rateLimit?.windowSeconds ?? positiveIntegerEnvironmentVariable("ZO_DRIVE_INVALID_API_KEY_WINDOW_SECONDS", 60)) * 1_000
  }),
  trustProxy: config.rateLimit?.trustProxy ?? process.env.ZO_DRIVE_TRUST_PROXY === "true",
  sharing: shareStore,
  forms: formStore,
  functions: functionStore,
  maxDatabaseImportBytes,
  release,
  zominAi: {
    endpoint: zominAiEndpoint,
    model: zominAiModel
  }
});

async function purgeExpiredTrash() {
  try {
    await storage.purgeExpiredTrash();
  } catch (error) {
    console.error("Zo Drive trash cleanup failed", error);
  }
}

void purgeExpiredTrash();
const trashCleanup = setInterval(() => void purgeExpiredTrash(), 60 * 60 * 1_000);
trashCleanup.unref();

async function runScheduledFunctions() {
  try {
    await functionStore.runDue();
  } catch (error) {
    console.error("Zo Functions scheduler failed", error);
  }
}

void runScheduledFunctions();
const functionScheduler = setInterval(() => void runScheduledFunctions(), 60_000);
functionScheduler.unref();

// A hosted Zo Drive is one private HTTP service. Serving the compiled UI from
// the API keeps session cookies and browser requests on the same origin.
if (process.env.NODE_ENV === "production") {
  app.get("*", async (context) => {
    const requestPath = new URL(context.req.url).pathname;
    const relativePath = requestPath === "/" ? "index.html" : requestPath.replace(/^\/+/, "");
    const requestedFile = resolve(webRoot, relativePath);
    const isWithinWebRoot = requestedFile === webRoot || requestedFile.startsWith(`${webRoot}${sep}`);
    const file = isWithinWebRoot ? requestedFile : resolve(webRoot, "index.html");

    try {
      const contents = await readFile(file);
      return new Response(contents, {
        headers: {
          "content-type": contentTypeFor(file),
          "cache-control": file.includes(`${sep}assets${sep}`) ? "public, max-age=31536000, immutable" : "no-cache"
        }
      });
    } catch {
      // Client-side routes (for example a shared-link URL) load the app shell.
      const contents = await readFile(resolve(webRoot, "index.html"));
      return new Response(contents, {
        headers: {
          "content-type": "text/html; charset=utf-8",
          "cache-control": "no-cache"
        }
      });
    }
  });
}

serve({ fetch: requestWithAppBasePath, port }, () => {
  console.log(`Zo Drive API listening on http://localhost:${port}`);
});

function requestWithAppBasePath(request: Request): Response | Promise<Response> {
  const url = new URL(request.url);
  // Zo routes this service at /drive. Some proxy paths preserve that prefix,
  // while local access and other proxies send root-relative requests.
  if (url.pathname === "/drive" || url.pathname.startsWith("/drive/")) {
    url.pathname = url.pathname === "/drive" ? "/" : url.pathname.slice("/drive".length);
    return app.fetch(new Request(url, request));
  }
  return app.fetch(request);
}

function requiredEnvironmentVariable(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

function deployedRevision(): string {
  if (process.env.ZO_DRIVE_RELEASE_SHA) return process.env.ZO_DRIVE_RELEASE_SHA;
  try {
    return execFileSync("git", ["rev-parse", "--short=12", "HEAD"], { cwd: resolve(apiRoot, "../.."), encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
}

function numberEnvironmentVariable(name: string, fallback: number): number {
  const value = process.env[name];
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65_535) {
    throw new Error(`${name} must be a valid port number`);
  }
  return parsed;
}

function positiveIntegerEnvironmentVariable(name: string, fallback: number): number {
  const value = process.env[name];
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) throw new Error(`${name} must be a positive integer`);
  return parsed;
}

function localHttpEndpoint(value: string): string {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol) || !['127.0.0.1', '::1', 'localhost'].includes(url.hostname)) {
    throw new Error("ZO_DRIVE_ZOMINAI_ENDPOINT must use a loopback HTTP(S) address");
  }
  return url.toString();
}

function developmentSessionSecret(): string {
  if (process.env.NODE_ENV === "production") {
    throw new Error("ZO_DRIVE_SESSION_SECRET is required in production");
  }
  return "development-only-session-secret-change-before-deploy";
}

function contentTypeFor(file: string): string {
  switch (extname(file).toLowerCase()) {
    case ".css": return "text/css; charset=utf-8";
    case ".js": return "text/javascript; charset=utf-8";
    case ".json": return "application/json; charset=utf-8";
    case ".txt": return "text/plain; charset=utf-8";
    case ".svg": return "image/svg+xml";
    case ".png": return "image/png";
    case ".jpg":
    case ".jpeg": return "image/jpeg";
    case ".ico": return "image/x-icon";
    case ".woff2": return "font/woff2";
    default: return "text/html; charset=utf-8";
  }
}
