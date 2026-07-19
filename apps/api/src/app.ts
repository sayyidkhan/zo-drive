import { Hono } from "hono";
import type { Context } from "hono";
import { cors } from "hono/cors";
import { z } from "zod";
import { Readable } from "node:stream";

import { LocalAuthStore } from "./auth/local-auth-store.js";
import { SessionService } from "./auth/session.js";
import { LocalShareStore, type StoredShare } from "./sharing/local-share-store.js";
import { LocalDriveStorage, TrashRestoreConflictError, UnsafeDrivePathError, nativeFileTypes, type DriveFileCategory } from "./storage/local-drive-storage.js";

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
  sharing?: LocalShareStore;
};

const listQuerySchema = z.object({
  prefix: z.string().max(1_024).optional(),
  query: z.string().max(256).optional(),
  contentQuery: z.string().max(256).optional(),
  type: z.enum(["document", "spreadsheet", "presentation", "form", "image", "video", "audio", "pdf", "other"] satisfies [DriveFileCategory, ...DriveFileCategory[]]).optional(),
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
  passcode: z.string().min(1).max(256).optional(),
  expiresAt: z.string().datetime().nullable().optional()
}).superRefine((value, context) => {
  if (value.access === "passcode" && !value.passcode) context.addIssue({ code: z.ZodIssueCode.custom, message: "A passcode is required" });
});
const changeSharePasscodeSchema = z.object({
  passcode: z.string().min(1).max(256)
});

export function createApp({ storage, resolveUserId, allowedOrigin, auth, sharing }: CreateAppOptions) {
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
    app.use("/stars", cors(corsOptions));
    app.use("/stars/*", cors(corsOptions));
    app.use("/trash", cors(corsOptions));
    app.use("/trash/*", cors(corsOptions));
    app.use("/auth/*", cors(corsOptions));
    app.use("/shares", cors(corsOptions));
    app.use("/shares/*", cors(corsOptions));
    app.use("/shared/*", cors(corsOptions));
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
      // Node's built-in fetch has no persistent cookie jar. The CLI explicitly
      // opts in to receive a short-lived bearer session; browsers never do.
      return context.json(context.req.header("x-zo-drive-cli") === "1" ? { user, sessionToken } : { user });
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
      await auth.store.removeUser(userId);
      context.header("set-cookie", auth.sessions.clearCookieHeader(auth.secureCookies));
      return context.body(null, 204);
    });

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

    await storage.trash({ userId, key: objectKeyFromPath(context.req.path) });
    return context.body(null, 204);
  });

  app.get("/usage", async (context) => {
    const userId = await requireUser(context.req.raw, resolveActiveUser);
    if (!userId) {
      return unauthorized(context);
    }
    return context.json(await storage.getUsage({ userId }));
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
    return { id: share.id, key: share.key, name: object.name, size: object.size, contentType: object.contentType, access: share.access, expiresAt: share.expiresAt, createdAt: share.createdAt };
  } catch (error) {
    if (isNotFound(error)) return null;
    throw error;
  }
}
