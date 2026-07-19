import { serve } from "@hono/node-server";

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

const app = createApp({
  storage: new LocalDriveStorage({ root: dataRoot }),
  resolveUserId: (request) => sessions.userIdFromRequest(request),
  allowedOrigin,
  auth: {
    store: new LocalAuthStore({ root: dataRoot }),
    sessions,
    secureCookies: process.env.NODE_ENV === "production"
  },
  sharing: shareStore
});

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
