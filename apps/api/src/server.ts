import { serve } from "@hono/node-server";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, extname, resolve, sep } from "node:path";

import { createApp } from "./app.js";
import { LocalAuthStore } from "./auth/local-auth-store.js";
import { SessionService } from "./auth/session.js";
import { LocalShareStore } from "./sharing/local-share-store.js";
import { LocalDriveStorage } from "./storage/local-drive-storage.js";

const dataRoot = requiredEnvironmentVariable("ZO_DRIVE_DATA_ROOT");
const port = numberEnvironmentVariable("ZO_DRIVE_PORT", 43071);
const allowedOrigin = process.env.ZO_DRIVE_ALLOWED_ORIGIN;
const sessionSecret = process.env.ZO_DRIVE_SESSION_SECRET ?? developmentSessionSecret();
const sessions = new SessionService(sessionSecret);
const shareStore = new LocalShareStore({ root: dataRoot });
const storage = new LocalDriveStorage({ root: dataRoot });
const webRoot = process.env.ZO_DRIVE_WEB_ROOT ?? resolve(dirname(fileURLToPath(import.meta.url)), "../../web/dist");

const app = createApp({
  storage,
  resolveUserId: (request) => sessions.userIdFromRequest(request),
  allowedOrigin,
  auth: {
    store: new LocalAuthStore({ root: dataRoot }),
    sessions,
    secureCookies: process.env.NODE_ENV === "production"
  },
  sharing: shareStore
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

serve({ fetch: app.fetch, port }, () => {
  console.log(`Zo Drive API listening on http://localhost:${port}`);
});

function requiredEnvironmentVariable(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
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
    case ".svg": return "image/svg+xml";
    case ".png": return "image/png";
    case ".jpg":
    case ".jpeg": return "image/jpeg";
    case ".ico": return "image/x-icon";
    case ".woff2": return "font/woff2";
    default: return "text/html; charset=utf-8";
  }
}
