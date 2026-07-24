import { z } from "zod";

import { validCron } from "./functions/local-function-store.js";
import { nativeFileTypes, type DriveFileCategory } from "./storage/local-drive-storage.js";

const databaseEngineIds = ["sqlite", "duckdb", "libsql", "pglite", "lancedb", "leveldb", "redis", "kuzu"] as const;

export const listQuerySchema = z.object({
  prefix: z.string().max(1_024).optional(),
  query: z.string().max(256).optional(),
  contentQuery: z.string().max(256).optional(),
  type: z.enum(["document", "spreadsheet", "presentation", "form", "paste", "image", "video", "audio", "pdf", "other"] satisfies [DriveFileCategory, ...DriveFileCategory[]]).optional(),
  starred: z.enum(["true"]).optional().transform((value) => value === "true" ? true : undefined),
  modifiedAfter: z.string().datetime().optional(),
  modifiedBefore: z.string().datetime().optional()
});

export const createFolderSchema = z.object({
  path: z.string().min(1).max(1_024)
});

export const renameFolderSchema = z.object({
  name: z.string().trim().min(1).max(1_024)
});

export const createNativeFileSchema = z.object({
  name: z.string().trim().min(1).max(1_024),
  path: z.string().max(1_024).optional(),
  type: z.enum(nativeFileTypes)
});

export const updateNativeFileSchema = z.object({
  content: z.object({
    format: z.literal("zo-native"),
    type: z.enum(nativeFileTypes),
    version: z.literal(1)
  }).passthrough()
});

export const updateFileSchema = z.object({
  copyTo: z.string().trim().min(1).max(1_024).optional(),
  overwrite: z.boolean().optional(),
  name: z.string().trim().min(1).max(1_024).optional(),
  destination: z.string().trim().min(1).max(1_024).optional()
}).superRefine((value, context) => {
  if ([value.name, value.destination, value.copyTo].filter((item) => item !== undefined).length !== 1) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Provide a file name, destination, or copy destination" });
  }
  if (value.overwrite !== undefined && value.copyTo === undefined) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Overwrite is only supported when copying a file" });
  }
});

export const publishFormSchema = z.object({ key: z.string().min(1).max(1_024) });

export const submitFormResponseSchema = z.object({
  answers: z.record(z.string().max(256), z.union([z.string().max(10_000), z.array(z.string().max(1_024)).max(100)]))
});

export const credentialsSchema = z.object({
  username: z.string().trim().min(3).max(32).regex(/^[a-zA-Z0-9_-]+$/),
  password: z.string().min(6).max(256)
});

export const accountMemberCreateSchema = credentialsSchema.extend({
  access: z.enum(["read", "write"]),
  role: z.enum(["regular", "super"]),
  isDemo: z.boolean().optional().default(false)
});

export const accountMemberUpdateSchema = z.object({
  access: z.enum(["read", "write"]).optional(),
  role: z.enum(["regular", "super"]).optional()
}).refine((value) => value.access !== undefined || value.role !== undefined, "Provide an access level or role");

export const usernameSchema = credentialsSchema.pick({ username: true });

export const passwordChangeSchema = z.object({
  currentPassword: z.string().min(6).max(256),
  newPassword: z.string().min(6).max(256)
});

export const deleteAccountSchema = z.object({
  password: z.string().min(6).max(256),
  confirmation: z.literal("DELETE MY DRIVE")
});

export const createShareSchema = z.object({
  key: z.string().min(1).max(1_024),
  access: z.enum(["public", "passcode"]),
  editable: z.boolean().optional().default(false),
  kind: z.enum(["share", "transfer"]).optional(),
  passcode: z.string().min(1).max(256).optional(),
  expiresAt: z.string().datetime().nullable().optional()
}).superRefine((value, context) => {
  if (value.access === "passcode" && !value.passcode) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "A passcode is required" });
  }
});

export const changeSharePasscodeSchema = z.object({
  passcode: z.string().min(1).max(256)
});

export const sharedPasteContentSchema = z.object({
  format: z.literal("zo-native"),
  type: z.literal("paste"),
  version: z.literal(1),
  language: z.string().max(80),
  tags: z.array(z.string().max(80)).max(20),
  text: z.string().max(1_000_000)
});

export const updateSharedPasteSchema = z.object({
  content: sharedPasteContentSchema,
  expectedRevision: z.string().min(1).max(128)
});

export const updateStorageQuotaSchema = z.object({
  quotaBytes: z.number().int().positive()
});

export const createApiKeySchema = z.object({
  name: z.string().trim().min(1).max(80),
  scopes: z.array(z.enum(["read", "write"])).min(1).max(2),
  expiresAt: z.string().datetime().nullable()
});

export const createDatabaseSchema = z.object({
  name: z.string().trim().min(1).max(80),
  engine: z.enum(databaseEngineIds).default("sqlite")
});

export const updateDatabaseImportSettingsSchema = z.object({
  importLimitBytes: z.number().int().positive()
});

export const databaseRowsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(100),
  offset: z.coerce.number().int().min(0).default(0)
});

export const databaseQuerySchema = z.object({
  sql: z.string().min(1).max(50_000),
  params: z.array(z.union([z.string(), z.number(), z.boolean(), z.null()])).max(100).default([])
});

export const databaseExecuteSchema = z.record(z.string(), z.unknown())
  .refine((value) => Object.keys(value).length > 0 && JSON.stringify(value).length <= 1_000_000);

export const createDatabaseApiKeySchema = z.object({
  name: z.string().trim().min(1).max(80),
  scopes: z.array(z.enum(["read", "write"])).min(1).max(2),
  expiresAt: z.string().datetime().nullable()
});

export const functionIdSchema = z.string().uuid();

const functionFieldsSchema = z.object({
  name: z.string().trim().min(1).max(80),
  runtime: z.enum(["javascript", "python"]),
  source: z.string().min(1).max(50_000),
  visibility: z.enum(["private", "public"]),
  cron: z.string().trim().max(100).nullable(),
  enabled: z.boolean()
});

export const functionCreateSchema = functionFieldsSchema.extend({
  visibility: z.enum(["private", "public"]).default("private"),
  cron: z.string().trim().max(100).nullable().default(null),
  enabled: z.boolean().default(true)
}).superRefine((value, context) => {
  if (value.cron && !validCron(value.cron)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Use a valid five-field UTC cron expression" });
  }
});

export const functionUpdateSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  runtime: z.enum(["javascript", "python"]).optional(),
  source: z.string().min(1).max(50_000).optional(),
  visibility: z.enum(["private", "public"]).optional(),
  cron: z.string().trim().max(100).nullable().optional(),
  enabled: z.boolean().optional()
}).superRefine((value, context) => {
  if (Object.keys(value).length === 0) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Provide at least one change" });
  }
  if (value.cron && !validCron(value.cron)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Use a valid five-field UTC cron expression" });
  }
});

export const functionRunSchema = z.object({
  input: z.unknown().optional().default({})
});

const clusterRoleSchema = z.enum(["viewer", "editor"]);

export const clusterInvitationSchema = z.object({
  folder: z.string().trim().min(1).max(1_024),
  role: clusterRoleSchema.default("editor"),
  recipient: z.string().trim().min(1).max(120).nullable().optional()
});

export const clusterMountSchema = z.object({
  remoteUrl: z.string().url().max(2_048),
  inviteToken: z.string().min(20).max(256)
});

export const clusterMountTokenSchema = clusterMountSchema.pick({ inviteToken: true });

export const clusterPeerUpdateSchema = z.object({
  role: clusterRoleSchema
});

export const zominAiChatSchema = z.object({
  messages: z.array(z.object({
    content: z.string().max(100_000).nullable().optional(),
    role: z.enum(["assistant", "system", "tool", "user"]),
    tool_call_id: z.string().max(128).optional(),
    tool_calls: z.array(z.object({
      function: z.object({ arguments: z.string().max(20_000), name: z.string().max(80) }),
      id: z.string().max(128),
      type: z.literal("function")
    })).max(6).optional()
  })).min(1).max(30),
  model: z.string().trim().min(1).max(256).optional(),
  stream: z.boolean().optional(),
  stream_options: z.object({ include_usage: z.boolean() }).optional(),
  tool_choice: z.literal("auto").optional(),
  tools: z.array(z.unknown()).max(10).optional()
}).refine((value) => JSON.stringify(value).length <= 1_000_000, "ZominAI request is too large");

export const zominAiWarmupSchema = z.object({
  model: z.string().trim().min(1).max(256).optional()
});

export const zominAiModelVersionSchema = z.object({
  version: z.string().trim().min(1).max(256)
});
