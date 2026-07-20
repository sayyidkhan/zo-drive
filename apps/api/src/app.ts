import { Hono } from "hono";
import type { Context } from "hono";
import { cors } from "hono/cors";
import { z } from "zod";
import { Readable } from "node:stream";
import { readFile } from "node:fs/promises";

import { LocalAuthStore } from "./auth/local-auth-store.js";
import { LocalApiKeyStore, type ApiKeyScope } from "./auth/local-api-key-store.js";
import { SessionService } from "./auth/session.js";
import { LocalShareStore, type StoredShare } from "./sharing/local-share-store.js";
import { LocalFormStore, type PublishedForm } from "./forms/local-form-store.js";
import { DatabaseImportError, DatabaseQueryError, LocalDatabaseStore } from "./databases/local-database-store.js";
import { LocalDatabaseApiKeyStore, type DatabaseApiKeyScope } from "./databases/local-database-api-key-store.js";
import { LocalDriveStorage, StorageQuotaConfigurationError, StorageQuotaExceededError, TrashRestoreConflictError, UnsafeDrivePathError, nativeFileTypes, type DriveFileCategory } from "./storage/local-drive-storage.js";

export type UserResolver = (request: Request) => string | null | Promise<string | null>;

type CreateAppOptions = {
  storage: LocalDriveStorage;
  resolveUserId: UserResolver;
  allowedOrigin?: string;
  auth?: {
    store: LocalAuthStore;
    sessions: SessionService;
    secureCookies: boolean;
  };
  apiKeys?: LocalApiKeyStore;
  sharing?: LocalShareStore;
  forms?: LocalFormStore;
  databases?: LocalDatabaseStore;
  databaseApiKeys?: LocalDatabaseApiKeyStore;
  maxDatabaseImportBytes?: number;
};

const listQuerySchema = z.object({
  prefix: z.string().max(1_024).optional(),
  query: z.string().max(256).optional(),
  contentQuery: z.string().max(256).optional(),
  type: z.enum(["document", "spreadsheet", "presentation", "form", "paste", "image", "video", "audio", "pdf", "other"] satisfies [DriveFileCategory, ...DriveFileCategory[]]).optional(),
  starred: z.enum(["true"]).optional().transform((value) => value === "true" ? true : undefined),
  modifiedAfter: z.string().datetime().optional(),
  modifiedBefore: z.string().datetime().optional()
});

const createFolderSchema = z.object({
  path: z.string().min(1).max(1_024)
});
const createNativeFileSchema = z.object({
  name: z.string().trim().min(1).max(1_024),
  path: z.string().max(1_024).optional(),
  type: z.enum(nativeFileTypes)
});
const updateNativeFileSchema = z.object({
  content: z.object({
    format: z.literal("zo-native"),
    type: z.enum(nativeFileTypes),
    version: z.literal(1)
  }).passthrough()
});
const renameFileSchema = z.object({
  name: z.string().trim().min(1).max(1_024)
});
const publishFormSchema = z.object({ key: z.string().min(1).max(1_024) });
const submitFormResponseSchema = z.object({
  answers: z.record(z.string().max(256), z.union([z.string().max(10_000), z.array(z.string().max(1_024)).max(100)]))
});

const credentialsSchema = z.object({
  username: z.string().trim().min(3).max(32).regex(/^[a-zA-Z0-9_-]+$/),
  password: z.string().min(6).max(256)
});

const usernameSchema = credentialsSchema.pick({ username: true });
const passwordChangeSchema = z.object({
  currentPassword: z.string().min(6).max(256),
  newPassword: z.string().min(6).max(256)
});
const deleteAccountSchema = z.object({
  password: z.string().min(6).max(256),
  confirmation: z.literal("DELETE MY DRIVE")
});
const createShareSchema = z.object({
  key: z.string().min(1).max(1_024),
  access: z.enum(["public", "passcode"]),
  kind: z.enum(["share", "transfer"]).optional(),
  passcode: z.string().min(1).max(256).optional(),
  expiresAt: z.string().datetime().nullable().optional()
}).superRefine((value, context) => {
  if (value.access === "passcode" && !value.passcode) context.addIssue({ code: z.ZodIssueCode.custom, message: "A passcode is required" });
});
const changeSharePasscodeSchema = z.object({
  passcode: z.string().min(1).max(256)
});
const updateStorageQuotaSchema = z.object({
  quotaBytes: z.number().int().positive()
});
const createApiKeySchema = z.object({
  name: z.string().trim().min(1).max(80),
  scopes: z.array(z.enum(["read", "write"])).min(1).max(2),
  expiresAt: z.string().datetime().nullable()
});
const createDatabaseSchema = z.object({
  name: z.string().trim().min(1).max(80)
});
const updateDatabaseImportSettingsSchema = z.object({
  importLimitBytes: z.number().int().positive()
});
const databaseRowsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(100),
  offset: z.coerce.number().int().min(0).default(0)
});
const databaseQuerySchema = z.object({
  sql: z.string().min(1).max(50_000),
  params: z.array(z.union([z.string(), z.number(), z.boolean(), z.null()])).max(100).default([])
});
const createDatabaseApiKeySchema = z.object({
  name: z.string().trim().min(1).max(80),
  scopes: z.array(z.enum(["read", "write"])).min(1).max(2),
  expiresAt: z.string().datetime().nullable()
});

export function createApp({ storage, resolveUserId, allowedOrigin, auth, apiKeys, sharing, forms, databases = new LocalDatabaseStore(storage.root), databaseApiKeys = new LocalDatabaseApiKeyStore({ root: storage.root }), maxDatabaseImportBytes = Number.MAX_SAFE_INTEGER }: CreateAppOptions) {
  const app = new Hono();
  const resolveActiveUser: UserResolver = async (request) => {
    const userId = await resolveUserId(request);
    if (!userId || !auth) return userId;
    return (await auth.store.findById(userId))?.id ?? null;
  };
  if (allowedOrigin) {
    const corsOptions = { credentials: true, origin: allowedOrigin };
    app.use("/objects/*", cors(corsOptions));
    app.use("/objects", cors(corsOptions));
    app.use("/folders", cors(corsOptions));
    app.use("/native-files", cors(corsOptions));
    app.use("/native-files/*", cors(corsOptions));
    app.use("/usage", cors(corsOptions));
    app.use("/usage/*", cors(corsOptions));
    app.use("/stars", cors(corsOptions));
    app.use("/stars/*", cors(corsOptions));
    app.use("/trash", cors(corsOptions));
    app.use("/trash/*", cors(corsOptions));
    app.use("/auth/*", cors(corsOptions));
    app.use("/api-keys", cors(corsOptions));
    app.use("/api-keys/*", cors(corsOptions));
    app.use("/shares", cors(corsOptions));
    app.use("/shares/*", cors(corsOptions));
    app.use("/shared/*", cors(corsOptions));
    app.use("/forms", cors(corsOptions));
    app.use("/forms/*", cors(corsOptions));
    app.use("/public/forms/*", cors(corsOptions));
    app.use("/databases", cors(corsOptions));
    app.use("/databases/*", cors(corsOptions));
  }

  app.get("/health", (context) => context.json({ status: "ok" }));

  if (auth) {
    app.get("/auth/status", async (context) => {
      const userId = await requireUser(context.req.raw, resolveActiveUser);
      const user = userId ? await auth.store.findById(userId) : null;
      return context.json({
        authenticated: Boolean(user),
        registrationAllowed: !(await auth.store.hasUsers()),
        user
      });
    });

    app.post("/auth/register", async (context) => {
      const parsed = credentialsSchema.safeParse(await context.req.json().catch(() => null));
      if (!parsed.success) return context.json({ error: { code: "INVALID_REQUEST", message: "Enter a username and a password of at least 6 characters" } }, 400);

      const user = await auth.store.registerInitialUser(parsed.data);
      if (!user) return context.json({ error: { code: "REGISTRATION_CLOSED", message: "An owner account already exists. Please sign in." } }, 403);
      context.header("set-cookie", auth.sessions.cookieHeader(auth.sessions.create(user.id), auth.secureCookies));
      return context.json({ user }, 201);
    });

    app.post("/auth/login", async (context) => {
      const parsed = credentialsSchema.safeParse(await context.req.json().catch(() => null));
      if (!parsed.success) return context.json({ error: { code: "INVALID_CREDENTIALS", message: "Username or password is incorrect" } }, 401);

      const user = await auth.store.authenticate(parsed.data);
      if (!user) return context.json({ error: { code: "INVALID_CREDENTIALS", message: "Username or password is incorrect" } }, 401);
      const sessionToken = auth.sessions.create(user.id);
      context.header("set-cookie", auth.sessions.cookieHeader(sessionToken, auth.secureCookies));
      return context.json({ user });
    });

    app.post("/auth/logout", (context) => {
      context.header("set-cookie", auth.sessions.clearCookieHeader(auth.secureCookies));
      return context.body(null, 204);
    });

    app.patch("/auth/profile", async (context) => {
      const userId = await requireUser(context.req.raw, resolveActiveUser);
      if (!userId) return unauthorized(context);
      const parsed = usernameSchema.safeParse(await context.req.json().catch(() => null));
      if (!parsed.success) return context.json({ error: { code: "INVALID_REQUEST", message: "Username must be 3–32 letters, numbers, underscores, or hyphens" } }, 400);
      const nextUserId = parsed.data.username.trim().toLowerCase();
      await storage.renameUser({ fromUserId: userId, toUserId: nextUserId });
      await sharing?.renameOwner({ fromUserId: userId, toUserId: nextUserId });
      await forms?.renameOwner({ fromUserId: userId, toUserId: nextUserId });
      await databases.renameOwner({ fromUserId: userId, toUserId: nextUserId });
      await databaseApiKeys.renameOwner({ fromUserId: userId, toUserId: nextUserId });
      await apiKeys?.renameOwner({ fromUserId: userId, toUserId: nextUserId });
      const user = await auth.store.renameUser(userId, nextUserId);
      if (!user) return context.json({ error: { code: "PROFILE_UPDATE_FAILED", message: "Could not update the username" } }, 409);
      context.header("set-cookie", auth.sessions.cookieHeader(auth.sessions.create(user.id), auth.secureCookies));
      return context.json({ user });
    });

    app.post("/auth/password", async (context) => {
      const userId = await requireUser(context.req.raw, resolveActiveUser);
      if (!userId) return unauthorized(context);
      const parsed = passwordChangeSchema.safeParse(await context.req.json().catch(() => null));
      if (!parsed.success) return context.json({ error: { code: "INVALID_REQUEST", message: "Passwords must have at least 6 characters" } }, 400);
      if (!(await auth.store.changePassword(userId, parsed.data.currentPassword, parsed.data.newPassword))) {
        return context.json({ error: { code: "INVALID_CREDENTIALS", message: "Your current password is incorrect" } }, 401);
      }
      return context.body(null, 204);
    });

    app.delete("/auth/account", async (context) => {
      const userId = await requireUser(context.req.raw, resolveActiveUser);
      if (!userId) return unauthorized(context);
      const parsed = deleteAccountSchema.safeParse(await context.req.json().catch(() => null));
      if (!parsed.success) return context.json({ error: { code: "INVALID_REQUEST", message: "Enter your password and DELETE MY DRIVE to permanently delete this account" } }, 400);
      if (!(await auth.store.verifyPasswordForUser(userId, parsed.data.password))) {
        return context.json({ error: { code: "INVALID_CREDENTIALS", message: "Your current password is incorrect" } }, 401);
      }
      await storage.removeUser({ userId });
      await sharing?.removeByOwner(userId);
      await forms?.removeByOwner(userId);
      await databases.removeByOwner(userId);
      await databaseApiKeys.removeByOwner(userId);
      await apiKeys?.removeByOwner(userId);
      await auth.store.removeUser(userId);
      context.header("set-cookie", auth.sessions.clearCookieHeader(auth.secureCookies));
      return context.body(null, 204);
    });

    if (apiKeys) {
      app.get("/api-keys", async (context) => {
        const userId = await requireBrowserUser(context.req.raw, auth);
        if (!userId) return unauthorized(context);
        return context.json({ keys: await apiKeys.list(userId) });
      });

      app.post("/api-keys", async (context) => {
        const userId = await requireBrowserUser(context.req.raw, auth);
        if (!userId) return unauthorized(context);
        const parsed = createApiKeySchema.safeParse(await context.req.json().catch(() => null));
        if (!parsed.success) return context.json({ error: { code: "INVALID_REQUEST", message: "Enter a key name, scope, and valid expiry" } }, 400);
        if (parsed.data.expiresAt && new Date(parsed.data.expiresAt).getTime() <= Date.now()) return context.json({ error: { code: "INVALID_REQUEST", message: "Expiry must be in the future" } }, 400);
        return context.json(await apiKeys.create({ ownerUserId: userId, ...parsed.data, scopes: parsed.data.scopes as ApiKeyScope[] }), 201);
      });

      app.delete("/api-keys/:id", async (context) => {
        const userId = await requireBrowserUser(context.req.raw, auth);
        if (!userId) return unauthorized(context);
        if (!(await apiKeys.revoke({ id: context.req.param("id"), ownerUserId: userId }))) return context.json({ error: { code: "NOT_FOUND", message: "API key not found" } }, 404);
        return context.body(null, 204);
      });
    }

    if (sharing) {
      app.get("/shares", async (context) => {
        const userId = await requireUser(context.req.raw, resolveActiveUser);
        if (!userId) return unauthorized(context);
        const shares = await Promise.all((await sharing.listByOwner(userId)).map((share) => describeShare(storage, share)));
        return context.json({ shares: shares.filter((share): share is NonNullable<typeof share> => share !== null) });
      });

      app.post("/shares", async (context) => {
        const userId = await requireUser(context.req.raw, resolveActiveUser);
        if (!userId) return unauthorized(context);
        const parsed = createShareSchema.safeParse(await context.req.json().catch(() => null));
        if (!parsed.success) return context.json({ error: { code: "INVALID_REQUEST", message: "Enter a valid file, share setting, and optional expiry" } }, 400);
        if (parsed.data.expiresAt && new Date(parsed.data.expiresAt).getTime() <= Date.now()) return context.json({ error: { code: "INVALID_REQUEST", message: "Expiry must be in the future" } }, 400);
        await storage.read({ userId, key: parsed.data.key });
        const share = await sharing.create({ ...parsed.data, ownerUserId: userId, expiresAt: parsed.data.expiresAt ?? null });
        const described = await describeShare(storage, share);
        return context.json(described, 201);
      });

      app.patch("/shares/:id/passcode", async (context) => {
        const userId = await requireUser(context.req.raw, resolveActiveUser);
        if (!userId) return unauthorized(context);
        const parsed = changeSharePasscodeSchema.safeParse(await context.req.json().catch(() => null));
        if (!parsed.success) return context.json({ error: { code: "INVALID_REQUEST", message: "Enter a valid passcode" } }, 400);
        const share = await sharing.updatePasscode({ id: context.req.param("id"), ownerUserId: userId, passcode: parsed.data.passcode });
        if (!share) return context.json({ error: { code: "NOT_FOUND", message: "Passcode-protected share link not found" } }, 404);
        return context.json(await describeShare(storage, share));
      });

      app.delete("/shares/:id", async (context) => {
        const userId = await requireUser(context.req.raw, resolveActiveUser);
        if (!userId) return unauthorized(context);
        if (!(await sharing.remove({ id: context.req.param("id"), ownerUserId: userId }))) return context.json({ error: { code: "NOT_FOUND", message: "Share link not found" } }, 404);
        return context.body(null, 204);
      });
    }

    if (forms) {
      app.post("/forms", async (context) => {
        const userId = await requireUser(context.req.raw, resolveActiveUser);
        if (!userId) return unauthorized(context);
        const parsed = publishFormSchema.safeParse(await context.req.json().catch(() => null));
        if (!parsed.success) return context.json({ error: { code: "INVALID_REQUEST", message: "Select a valid Zo Form" } }, 400);
        const file = await storage.read({ userId, key: parsed.data.key });
        if (file.nativeType !== "form") return context.json({ error: { code: "INVALID_REQUEST", message: "Only Zo Forms can be published" } }, 400);
        const published = await forms.publish({ ownerUserId: userId, key: parsed.data.key });
        const form = await describePublishedForm(storage, published);
        return form ? context.json(form, 201) : context.json({ error: { code: "NOT_FOUND", message: "Form not found" } }, 404);
      });

      app.get("/forms/:id/responses", async (context) => {
        const userId = await requireUser(context.req.raw, resolveActiveUser);
        if (!userId) return unauthorized(context);
        const responses = await forms.listResponses({ formId: context.req.param("id"), ownerUserId: userId });
        if (!responses) return context.json({ error: { code: "NOT_FOUND", message: "Published form not found" } }, 404);
        return context.json({ responses: responses.map(({ id, submittedAt, answers }) => ({ id, submittedAt, answers })) });
      });
    }
  }

  if (forms) {
    app.get("/public/forms/:id", async (context) => {
      const published = await forms.find(context.req.param("id"));
      if (!published) return context.json({ error: { code: "NOT_FOUND", message: "Form not found" } }, 404);
      const form = await describePublishedForm(storage, published);
      return form ? context.json(form) : context.json({ error: { code: "NOT_FOUND", message: "Form not found" } }, 404);
    });

    app.post("/public/forms/:id/responses", async (context) => {
      const published = await forms.find(context.req.param("id"));
      if (!published) return context.json({ error: { code: "NOT_FOUND", message: "Form not found" } }, 404);
      const form = await describePublishedForm(storage, published);
      if (!form) return context.json({ error: { code: "NOT_FOUND", message: "Form not found" } }, 404);
      if (!form.settings.acceptingResponses) return context.json({ error: { code: "RESPONSES_CLOSED", message: "This form is not accepting responses" } }, 403);
      const parsed = submitFormResponseSchema.safeParse(await context.req.json().catch(() => null));
      if (!parsed.success || !isValidFormResponse(form, parsed.success ? parsed.data.answers : {})) return context.json({ error: { code: "INVALID_RESPONSE", message: "Complete every required question with a valid answer" } }, 400);
      const response = await forms.addResponse({ formId: published.id, answers: parsed.data.answers });
      if (!response) return context.json({ error: { code: "NOT_FOUND", message: "Form not found" } }, 404);
      return context.json({ id: response.id, submittedAt: response.submittedAt, answers: response.answers }, 201);
    });
  }

  if (sharing) {
    app.get("/shared/:id/content", async (context) => {
      const share = await sharing.findActive(context.req.param("id"));
      if (!share) return context.json({ error: { code: "NOT_FOUND", message: "Share link not found or expired" } }, 404);
      if (!(await sharing.verifyPasscode(share, context.req.header("x-zo-drive-share-passcode")))) return context.json({ error: { code: "PASSCODE_REQUIRED", message: "A valid share passcode is required" } }, 401);
      const object = await storage.read({ userId: share.ownerUserId, key: share.key });
      return new Response(Readable.toWeb(storage.createReadStream(object.filePath)) as ReadableStream, { headers: { "content-disposition": `inline; filename*=UTF-8''${encodeURIComponent(object.name)}`, "content-length": object.size.toString(), "content-type": object.contentType } });
    });

    app.get("/shared/:id", async (context) => {
      const share = await sharing.findActive(context.req.param("id"));
      if (!share) return context.json({ error: { code: "NOT_FOUND", message: "Share link not found or expired" } }, 404);
      const object = await storage.read({ userId: share.ownerUserId, key: share.key });
      return context.json({ id: share.id, name: object.name, size: object.size, contentType: object.contentType, access: share.access, expiresAt: share.expiresAt, requiresPasscode: share.access === "passcode" });
    });
  }

  app.get("/folders", async (context) => {
    const userId = await requireUser(context.req.raw, resolveActiveUser);
    if (!userId) {
      return unauthorized(context);
    }
    const parsed = listQuerySchema.pick({ prefix: true }).safeParse(context.req.query());
    if (!parsed.success) {
      return context.json({ error: { code: "INVALID_REQUEST", message: "Invalid folder query" } }, 400);
    }
    const folders = await storage.listFolders({ userId, ...parsed.data });
    return context.json({ folders });
  });

  app.get("/databases", async (context) => {
    const userId = await requireDatabaseOwner(context.req.raw, resolveActiveUser, auth);
    if (!userId) return unauthorized(context);
    return context.json({ databases: await databases.list(userId) });
  });

  app.post("/databases", async (context) => {
    const userId = await requireDatabaseOwner(context.req.raw, resolveActiveUser, auth);
    if (!userId) return unauthorized(context);
    const parsed = createDatabaseSchema.safeParse(await context.req.json().catch(() => null));
    if (!parsed.success) return context.json({ error: { code: "INVALID_REQUEST", message: "Enter a database name of up to 80 characters" } }, 400);
    return context.json(await databases.create({ ownerUserId: userId, name: parsed.data.name }), 201);
  });

  app.get("/databases/settings", async (context) => {
    const userId = await requireDatabaseOwner(context.req.raw, resolveActiveUser, auth);
    if (!userId) return unauthorized(context);
    const usage = await storage.getUsage({ userId });
    return context.json(await databases.getImportSettings({ ownerUserId: userId, maxImportLimitBytes: Math.min(maxDatabaseImportBytes, usage.quotaBytes) }));
  });

  app.put("/databases/settings", async (context) => {
    const userId = await requireDatabaseOwner(context.req.raw, resolveActiveUser, auth);
    if (!userId) return unauthorized(context);
    const parsed = updateDatabaseImportSettingsSchema.safeParse(await context.req.json().catch(() => null));
    if (!parsed.success) return context.json({ error: { code: "INVALID_REQUEST", message: "Enter a whole-number import limit in bytes" } }, 400);
    const usage = await storage.getUsage({ userId });
    return context.json(await databases.setImportLimit({ ownerUserId: userId, importLimitBytes: parsed.data.importLimitBytes, maxImportLimitBytes: Math.min(maxDatabaseImportBytes, usage.quotaBytes) }));
  });

  app.post("/databases/import", async (context) => {
    const userId = await requireDatabaseOwner(context.req.raw, resolveActiveUser, auth);
    if (!userId) return unauthorized(context);
    const form = await context.req.formData().catch(() => null);
    const file = form?.get("file");
    const name = form?.get("name");
    if (!(file instanceof File) || typeof name !== "string" || !name.trim() || name.trim().length > 80) {
      return context.json({ error: { code: "INVALID_REQUEST", message: "Choose a SQLite file and database name of up to 80 characters" } }, 400);
    }
    const usage = await storage.getUsage({ userId });
    const settings = await databases.getImportSettings({ ownerUserId: userId, maxImportLimitBytes: Math.min(maxDatabaseImportBytes, usage.quotaBytes) });
    const effectiveLimit = Math.min(settings.importLimitBytes, usage.quotaAvailableBytes);
    if (file.size > effectiveLimit) return context.json({ error: { code: "DATABASE_IMPORT_ERROR", message: effectiveLimit < settings.importLimitBytes ? "This SQLite file exceeds your available Drive storage" : "This SQLite file exceeds your configured import limit" } }, 400);
    return context.json(await databases.import({ ownerUserId: userId, name: name.trim(), bytes: new Uint8Array(await file.arrayBuffer()), importLimitBytes: effectiveLimit }), 201);
  });

  app.delete("/databases/:id", async (context) => {
    const userId = await requireDatabaseOwner(context.req.raw, resolveActiveUser, auth);
    if (!userId) return unauthorized(context);
    if (!(await databases.remove({ ownerUserId: userId, id: context.req.param("id") }))) return context.json({ error: { code: "NOT_FOUND", message: "Database not found" } }, 404);
    await databaseApiKeys.removeByDatabase({ ownerUserId: userId, databaseId: context.req.param("id") });
    return context.body(null, 204);
  });

  app.get("/databases/:id/export", async (context) => {
    const userId = await requireDatabaseOwner(context.req.raw, resolveActiveUser, auth);
    if (!userId) return unauthorized(context);
    const exported = await databases.export({ ownerUserId: userId, id: context.req.param("id") });
    context.header("content-type", "application/vnd.sqlite3");
    context.header("content-disposition", `attachment; filename="${exported.database.name.replaceAll(/[^a-zA-Z0-9_-]+/g, "-") || "database"}.sqlite"`);
    const body = new ArrayBuffer(exported.bytes.byteLength);
    new Uint8Array(body).set(exported.bytes);
    return context.body(body);
  });

  app.get("/databases/:id/api-keys", async (context) => {
    const userId = await requireDatabaseOwner(context.req.raw, resolveActiveUser, auth);
    if (!userId) return unauthorized(context);
    await databases.listTables({ ownerUserId: userId, id: context.req.param("id") });
    return context.json({ keys: await databaseApiKeys.list({ ownerUserId: userId, databaseId: context.req.param("id") }) });
  });

  app.post("/databases/:id/api-keys", async (context) => {
    const userId = await requireDatabaseOwner(context.req.raw, resolveActiveUser, auth);
    if (!userId) return unauthorized(context);
    const parsed = createDatabaseApiKeySchema.safeParse(await context.req.json().catch(() => null));
    if (!parsed.success) return context.json({ error: { code: "INVALID_REQUEST", message: "Enter a key name, scope, and valid expiry" } }, 400);
    if (parsed.data.expiresAt && new Date(parsed.data.expiresAt).getTime() <= Date.now()) return context.json({ error: { code: "INVALID_REQUEST", message: "Expiry must be in the future" } }, 400);
    await databases.listTables({ ownerUserId: userId, id: context.req.param("id") });
    return context.json(await databaseApiKeys.create({ ownerUserId: userId, databaseId: context.req.param("id"), ...parsed.data, scopes: parsed.data.scopes as DatabaseApiKeyScope[] }), 201);
  });

  app.delete("/databases/:id/api-keys/:keyId", async (context) => {
    const userId = await requireDatabaseOwner(context.req.raw, resolveActiveUser, auth);
    if (!userId) return unauthorized(context);
    if (!(await databaseApiKeys.revoke({ id: context.req.param("keyId"), ownerUserId: userId, databaseId: context.req.param("id") }))) return context.json({ error: { code: "NOT_FOUND", message: "Database API key not found" } }, 404);
    return context.body(null, 204);
  });

  app.get("/databases/:id/tables", async (context) => {
    const userId = await requireDatabaseUser(context.req.raw, context.req.param("id"), "read", resolveActiveUser, databaseApiKeys);
    if (!userId) return unauthorized(context);
    return context.json({ tables: await databases.listTables({ ownerUserId: userId, id: context.req.param("id") }) });
  });

  app.get("/databases/:id/tables/:table/rows", async (context) => {
    const userId = await requireDatabaseUser(context.req.raw, context.req.param("id"), "read", resolveActiveUser, databaseApiKeys);
    if (!userId) return unauthorized(context);
    const parsed = databaseRowsQuerySchema.safeParse(context.req.query());
    if (!parsed.success) return context.json({ error: { code: "INVALID_REQUEST", message: "Invalid table pagination" } }, 400);
    return context.json(await databases.listRows({ ownerUserId: userId, id: context.req.param("id"), table: context.req.param("table"), ...parsed.data }));
  });

  app.post("/databases/:id/query", async (context) => {
    const parsed = databaseQuerySchema.safeParse(await context.req.json().catch(() => null));
    if (!parsed.success) return context.json({ error: { code: "INVALID_REQUEST", message: "Enter one valid SQL statement and up to 100 parameters" } }, 400);
    const userId = await requireDatabaseUser(context.req.raw, context.req.param("id"), databaseQueryScope(parsed.data.sql), resolveActiveUser, databaseApiKeys);
    if (!userId) return unauthorized(context);
    return context.json(await databases.query({ ownerUserId: userId, id: context.req.param("id"), ...parsed.data }));
  });

  app.post("/folders", async (context) => {
    const userId = await requireUser(context.req.raw, resolveActiveUser);
    if (!userId) {
      return unauthorized(context);
    }
    const body = await context.req.json().catch(() => null);
    const parsed = createFolderSchema.safeParse(body);
    if (!parsed.success) {
      return context.json({ error: { code: "INVALID_REQUEST", message: "A valid folder path is required" } }, 400);
    }
    return context.json(await storage.createFolder({ userId, key: parsed.data.path }), 201);
  });

  app.post("/native-files", async (context) => {
    const userId = await requireUser(context.req.raw, resolveActiveUser);
    if (!userId) return unauthorized(context);
    const parsed = createNativeFileSchema.safeParse(await context.req.json().catch(() => null));
    if (!parsed.success) return context.json({ error: { code: "INVALID_REQUEST", message: "Enter a valid Zo file name and type" } }, 400);
    const key = parsed.data.path ? `${parsed.data.path.replace(/\/$/, "")}/${parsed.data.name}` : parsed.data.name;
    return context.json(await storage.createNativeFile({ userId, key, type: parsed.data.type }), 201);
  });

  app.put("/native-files/*", async (context) => {
    const userId = await requireUser(context.req.raw, resolveActiveUser);
    if (!userId) return unauthorized(context);
    const parsed = updateNativeFileSchema.safeParse(await context.req.json().catch(() => null));
    if (!parsed.success) return context.json({ error: { code: "INVALID_REQUEST", message: "Invalid Zo-native file content" } }, 400);
    return context.json(await storage.updateNativeFile({ userId, key: nativeFileKeyFromPath(context.req.path), content: parsed.data.content }));
  });

  app.get("/objects", async (context) => {
    const userId = await requireUser(context.req.raw, resolveActiveUser);
    if (!userId) {
      return unauthorized(context);
    }

    const parsed = listQuerySchema.safeParse(context.req.query());
    if (!parsed.success) {
      return context.json({ error: { code: "INVALID_REQUEST", message: "Invalid list query" } }, 400);
    }
    const objects = await storage.list({ userId, ...parsed.data });
    return context.json({ objects });
  });

  app.get("/stars", async (context) => {
    const userId = await requireUser(context.req.raw, resolveActiveUser);
    if (!userId) return unauthorized(context);
    return context.json({ objects: await storage.listStarred({ userId }) });
  });

  app.put("/stars/*", async (context) => {
    const userId = await requireUser(context.req.raw, resolveActiveUser);
    if (!userId) return unauthorized(context);
    return context.json(await storage.setStarred({ userId, key: starKeyFromPath(context.req.path), starred: true }));
  });

  app.delete("/stars/*", async (context) => {
    const userId = await requireUser(context.req.raw, resolveActiveUser);
    if (!userId) return unauthorized(context);
    await storage.setStarred({ userId, key: starKeyFromPath(context.req.path), starred: false });
    return context.body(null, 204);
  });

  app.get("/trash", async (context) => {
    const userId = await requireUser(context.req.raw, resolveActiveUser);
    if (!userId) return unauthorized(context);
    return context.json({ items: await storage.listTrash({ userId }) });
  });

  app.put("/trash/:id/restore", async (context) => {
    const userId = await requireUser(context.req.raw, resolveActiveUser);
    if (!userId) return unauthorized(context);
    return context.json(await storage.restoreTrash({ userId, id: context.req.param("id") }));
  });

  app.delete("/trash/:id", async (context) => {
    const userId = await requireUser(context.req.raw, resolveActiveUser);
    if (!userId) return unauthorized(context);
    await storage.permanentlyDeleteTrash({ userId, id: context.req.param("id") });
    return context.body(null, 204);
  });

  app.delete("/trash", async (context) => {
    const userId = await requireUser(context.req.raw, resolveActiveUser);
    if (!userId) return unauthorized(context);
    await storage.emptyTrash({ userId });
    return context.body(null, 204);
  });

  app.post("/objects", async (context) => {
    const userId = await requireUser(context.req.raw, resolveActiveUser);
    if (!userId) {
      return unauthorized(context);
    }

    const fileName = decodeUploadHeader(context.req.header("x-zo-drive-file-name"));
    const path = decodeUploadHeader(context.req.header("x-zo-drive-path"));
    if (!fileName) return context.json({ error: { code: "INVALID_REQUEST", message: "A file name is required" } }, 400);
    if (fileName.length > 1_024 || path.length > 1_024) {
      return context.json({ error: { code: "INVALID_REQUEST", message: "The file name or folder path is too long" } }, 400);
    }
    if (!context.req.raw.body) return context.json({ error: { code: "INVALID_REQUEST", message: "A file is required" } }, 400);

    const key = path ? `${path.replace(/\/$/, "")}/${fileName}` : fileName;
    const object = await storage.write({
      userId,
      key,
      contentType: context.req.header("content-type"),
      content: Readable.fromWeb(context.req.raw.body as import("node:stream/web").ReadableStream)
    });
    return context.json(object, 201);
  });

  app.patch("/objects/*", async (context) => {
    const userId = await requireUser(context.req.raw, resolveActiveUser);
    if (!userId) return unauthorized(context);
    const parsed = renameFileSchema.safeParse(await context.req.json().catch(() => null));
    if (!parsed.success) return context.json({ error: { code: "INVALID_REQUEST", message: "Enter a valid file name" } }, 400);
    const key = objectKeyFromPath(context.req.path);
    const object = await storage.renameFile({ userId, key, name: parsed.data.name });
    if (sharing) await sharing.renameKey({ ownerUserId: userId, fromKey: key, toKey: object.key });
    if (forms) await forms.renameKey({ ownerUserId: userId, fromKey: key, toKey: object.key });
    return context.json(object);
  });

  app.get("/objects/*", async (context) => {
    const userId = await requireUser(context.req.raw, resolveActiveUser);
    if (!userId) {
      return unauthorized(context);
    }

    const key = objectKeyFromPath(context.req.path);
    const object = await storage.read({ userId, key });
    return new Response(Readable.toWeb(storage.createReadStream(object.filePath)) as ReadableStream, {
      headers: {
        "content-disposition": `inline; filename*=UTF-8''${encodeURIComponent(object.name)}`,
        "content-length": object.size.toString(),
        "content-type": object.contentType,
        "last-modified": object.updatedAt
      }
    });
  });

  app.delete("/objects/*", async (context) => {
    const userId = await requireUser(context.req.raw, resolveActiveUser);
    if (!userId) {
      return unauthorized(context);
    }

    const key = objectKeyFromPath(context.req.path);
    await storage.trash({ userId, key });
    await forms?.removeByKey({ ownerUserId: userId, key });
    return context.body(null, 204);
  });

  app.get("/usage", async (context) => {
    const userId = await requireUser(context.req.raw, resolveActiveUser);
    if (!userId) {
      return unauthorized(context);
    }
    return context.json(await storage.getUsage({ userId }));
  });

  app.put("/usage/quota", async (context) => {
    const userId = await requireUser(context.req.raw, resolveActiveUser);
    if (!userId) {
      return unauthorized(context);
    }
    const payload = updateStorageQuotaSchema.parse(await context.req.json());
    return context.json(await storage.setQuota({ userId, quotaBytes: payload.quotaBytes }));
  });

  app.onError((error, context) => {
    if (error instanceof UnsafeDrivePathError || error instanceof URIError) {
      return context.json({ error: { code: "INVALID_PATH", message: "Path must be a safe relative path" } }, 400);
    }
    if (isNotFound(error)) {
      return context.json({ error: { code: "NOT_FOUND", message: "File not found" } }, 404);
    }
    if (error instanceof TrashRestoreConflictError) {
      return context.json({ error: { code: "RESTORE_CONFLICT", message: error.message } }, 409);
    }
    if (error instanceof StorageQuotaExceededError) {
      return context.json({ error: { code: "STORAGE_QUOTA_EXCEEDED", message: error.message } }, 413);
    }
    if (error instanceof StorageQuotaConfigurationError) {
      return context.json({ error: { code: "INVALID_STORAGE_QUOTA", message: error.message } }, 400);
    }
    if (error instanceof DatabaseQueryError) {
      return context.json({ error: { code: "DATABASE_QUERY_ERROR", message: error.message } }, 400);
    }
    if (error instanceof DatabaseImportError) {
      return context.json({ error: { code: "DATABASE_IMPORT_ERROR", message: error.message } }, 400);
    }
    if (isAlreadyExists(error)) {
      return context.json({ error: { code: "ALREADY_EXISTS", message: "A file with this name already exists" } }, 409);
    }
    return context.json({ error: { code: "INTERNAL_ERROR", message: "Unexpected server error" } }, 500);
  });

  return app;
}

async function requireUser(request: Request, resolveUserId: UserResolver): Promise<string | null> {
  return resolveUserId(request);
}

async function requireBrowserUser(request: Request, auth: NonNullable<CreateAppOptions["auth"]>): Promise<string | null> {
  const userId = auth.sessions.userIdFromCookie(request);
  return userId && (await auth.store.findById(userId))?.id || null;
}

async function requireDatabaseOwner(request: Request, resolveUserId: UserResolver, auth: CreateAppOptions["auth"]): Promise<string | null> {
  if (request.headers.has("authorization")) return null;
  if (auth) return requireBrowserUser(request, auth);
  return requireUser(request, resolveUserId);
}

async function requireDatabaseUser(request: Request, databaseId: string, scope: DatabaseApiKeyScope, resolveUserId: UserResolver, databaseApiKeys: LocalDatabaseApiKeyStore): Promise<string | null> {
  if (!request.headers.has("authorization")) return requireUser(request, resolveUserId);
  const credential = await databaseApiKeys.authorize(request, scope);
  return credential?.databaseId === databaseId ? credential.ownerUserId : null;
}

function databaseQueryScope(sql: string): DatabaseApiKeyScope {
  return /^\s*(select|explain)\b/i.test(sql) ? "read" : "write";
}

function unauthorized(context: Context) {
  return context.json({ error: { code: "UNAUTHORIZED", message: "Authentication is required" } }, 401);
}

function objectKeyFromPath(path: string): string {
  const encodedKey = path.replace(/^\/objects\//, "");
  return decodeURIComponent(encodedKey);
}

function starKeyFromPath(path: string): string {
  const encodedKey = path.replace(/^\/stars\//, "");
  return decodeURIComponent(encodedKey);
}

function nativeFileKeyFromPath(path: string): string {
  const encodedKey = path.replace(/^\/native-files\//, "");
  return decodeURIComponent(encodedKey);
}

function decodeUploadHeader(value: string | undefined): string {
  return value ? decodeURIComponent(value) : "";
}

function isNotFound(error: unknown): error is NodeJS.ErrnoException {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}

function isAlreadyExists(error: unknown): error is NodeJS.ErrnoException {
  return typeof error === "object" && error !== null && "code" in error && error.code === "EEXIST";
}

async function describeShare(storage: LocalDriveStorage, share: StoredShare) {
  try {
    const object = await storage.read({ userId: share.ownerUserId, key: share.key });
    return { id: share.id, key: share.key, name: object.name, size: object.size, contentType: object.contentType, access: share.access, kind: share.kind === "transfer" ? "transfer" : "share", expiresAt: share.expiresAt, createdAt: share.createdAt };
  } catch (error) {
    if (isNotFound(error)) return null;
    throw error;
  }
}

type PublicForm = {
  id: string;
  shortCode: string;
  title: string;
  description: string;
  theme: string;
  banner: "none" | "botanical" | "fireworks";
  questions: Array<{
    id: string;
    title: string;
    description: string;
    type: "short-answer" | "paragraph" | "multiple-choice" | "checkboxes" | "dropdown" | "linear-scale" | "rating" | "multiple-choice-grid" | "checkbox-grid" | "date" | "time";
    options: string[];
    required: boolean;
    rows: string[];
    columns: string[];
    scaleMin: number;
    scaleMax: number;
    scaleMinLabel: string;
    scaleMaxLabel: string;
    ratingIcon: "star" | "heart" | "thumb";
  }>;
  settings: { acceptingResponses: boolean; confirmationMessage: string; showProgressBar: boolean };
};

const formThemes = new Set(["violet", "ocean", "forest", "sunset", "rose"]);
const formQuestionTypes = new Set(["short-answer", "paragraph", "multiple-choice", "checkboxes", "dropdown", "linear-scale", "rating", "multiple-choice-grid", "checkbox-grid", "date", "time"]);

async function describePublishedForm(storage: LocalDriveStorage, published: PublishedForm): Promise<PublicForm | null> {
  try {
    const file = await storage.read({ userId: published.ownerUserId, key: published.key });
    if (file.nativeType !== "form") return null;
    const content = JSON.parse(await readFile(file.filePath, "utf8")) as Record<string, unknown>;
    const questions = Array.isArray(content.questions) ? content.questions.flatMap((item): PublicForm["questions"] => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return [];
      const question = item as Record<string, unknown>;
      if (typeof question.id !== "string" || typeof question.title !== "string" || typeof question.type !== "string" || !formQuestionTypes.has(question.type)) return [];
      return [{
        id: question.id,
        title: question.title,
        description: typeof question.description === "string" ? question.description : "",
        type: question.type as PublicForm["questions"][number]["type"],
        options: Array.isArray(question.options) ? question.options.filter((option): option is string => typeof option === "string").slice(0, 50) : [],
        required: question.required === true,
        rows: Array.isArray(question.rows) ? question.rows.filter((item): item is string => typeof item === "string").slice(0, 50) : [],
        columns: Array.isArray(question.columns) ? question.columns.filter((item): item is string => typeof item === "string").slice(0, 50) : [],
        scaleMin: typeof question.scaleMin === "number" && Number.isInteger(question.scaleMin) && question.scaleMin >= 0 && question.scaleMin < 10 ? question.scaleMin : 1,
        scaleMax: typeof question.scaleMax === "number" && Number.isInteger(question.scaleMax) && question.scaleMax > 0 && question.scaleMax <= 10 ? question.scaleMax : 5,
        scaleMinLabel: typeof question.scaleMinLabel === "string" ? question.scaleMinLabel : "",
        scaleMaxLabel: typeof question.scaleMaxLabel === "string" ? question.scaleMaxLabel : "",
        ratingIcon: question.ratingIcon === "heart" || question.ratingIcon === "thumb" ? question.ratingIcon : "star"
      }];
    }) : [];
    return {
      id: published.id,
      shortCode: published.shortCode,
      title: typeof content.title === "string" && content.title.trim() ? content.title.trim() : "Untitled form",
      description: typeof content.description === "string" ? content.description : "",
      theme: typeof content.theme === "string" && formThemes.has(content.theme) ? content.theme : "violet",
      banner: content.banner === "botanical" || content.banner === "fireworks" ? content.banner : content.theme === "ocean" ? "botanical" : content.theme === "violet" ? "fireworks" : "none",
      questions,
      settings: {
        acceptingResponses: content.settings && typeof content.settings === "object" && !Array.isArray(content.settings) && (content.settings as Record<string, unknown>).acceptingResponses === false ? false : true,
        confirmationMessage: content.settings && typeof content.settings === "object" && !Array.isArray(content.settings) && typeof (content.settings as Record<string, unknown>).confirmationMessage === "string" ? (content.settings as Record<string, unknown>).confirmationMessage as string : "Your response has been recorded.",
        showProgressBar: Boolean(content.settings && typeof content.settings === "object" && !Array.isArray(content.settings) && (content.settings as Record<string, unknown>).showProgressBar === true)
      }
    };
  } catch (error) {
    if (isNotFound(error)) return null;
    throw error;
  }
}

function isValidFormResponse(form: PublicForm, answers: Record<string, string | string[]>): boolean {
  return form.questions.every((question) => {
    const answer = answers[question.id];
    if (question.required && (answer === undefined || answer === "" || (Array.isArray(answer) && answer.length === 0))) return false;
    if (answer === undefined) return true;
    if (["short-answer", "paragraph", "date", "time", "linear-scale", "rating"].includes(question.type)) return typeof answer === "string";
    if (question.type === "multiple-choice-grid" || question.type === "checkbox-grid") {
      const values = Array.isArray(answer) ? answer : [answer];
      return values.every((value) => typeof value === "string" && value.includes("::"));
    }
    const values = Array.isArray(answer) ? answer : [answer];
    return values.every((value) => typeof value === "string" && question.options.includes(value));
  });
}
