import { z } from "zod";

export const nativeFileTypeSchema = z.enum(["document", "spreadsheet", "presentation", "form", "paste"]);

export const driveObjectSchema = z.object({
  key: z.string(),
  name: z.string(),
  size: z.number().int().nonnegative(),
  contentType: z.string(),
  updatedAt: z.string(),
  starred: z.boolean().default(false),
  nativeType: nativeFileTypeSchema.optional()
});

export const listObjectsResponseSchema = z.object({
  objects: z.array(driveObjectSchema)
});

export const clusterRoleSchema = z.enum(["viewer", "editor"]);
export const clusterInvitationSchema = z.object({ id: z.string().uuid(), folder: z.string(), role: clusterRoleSchema, recipient: z.string().nullable(), createdAt: z.string().datetime(), expiresAt: z.string().datetime(), token: z.string() });
export const clusterPendingInvitationSchema = clusterInvitationSchema.omit({ token: true });
export const listClusterInvitationsResponseSchema = z.object({ invitations: z.array(clusterPendingInvitationSchema) });
export const clusterMountSchema = z.object({ id: z.string().uuid(), remoteUrl: z.string().url(), remotePeerId: z.string().uuid(), folder: z.string(), role: clusterRoleSchema, recipient: z.string().nullable(), author: z.string().nullable().default(null), createdAt: z.string().datetime() });
export const listClusterMountsResponseSchema = z.object({ mounts: z.array(clusterMountSchema) });
export const clusterPeerSchema = z.object({ id: z.string().uuid(), folder: z.string(), role: clusterRoleSchema, recipient: z.string().nullable(), createdAt: z.string().datetime() });
export const listClusterPeersResponseSchema = z.object({ peers: z.array(clusterPeerSchema) });
export const clusterAccessSchema = z.object({ role: clusterRoleSchema });

export const driveTrashItemSchema = z.object({
  id: z.string(),
  originalKey: z.string(),
  name: z.string(),
  size: z.number().int().nonnegative(),
  contentType: z.string(),
  kind: z.enum(["file", "folder"]).default("file"),
  starred: z.boolean(),
  trashedAt: z.string(),
  expiresAt: z.string()
});

export const listTrashResponseSchema = z.object({
  items: z.array(driveTrashItemSchema)
});

export const driveFolderSchema = z.object({
  key: z.string(),
  name: z.string(),
  updatedAt: z.string()
});

export const listFoldersResponseSchema = z.object({
  folders: z.array(driveFolderSchema)
});

export const healthSchema = z.object({
  status: z.literal("ok")
});

export const storageUsageSchema = z.object({
  fileCount: z.number().int().nonnegative(),
  usedBytes: z.number().int().nonnegative(),
  quotaBytes: z.number().int().positive(),
  quotaAvailableBytes: z.number().int().nonnegative(),
  minQuotaBytes: z.number().int().positive(),
  maxQuotaBytes: z.number().int().positive(),
  totalBytes: z.number().int().nonnegative(),
  availableBytes: z.number().int().nonnegative(),
  systemUsedBytes: z.number().int().nonnegative(),
  categories: z.array(z.object({
    id: z.enum(["photos", "videos", "documents", "audio", "archives", "other", "trash", "databases", "functions", "zo-originals"]),
    bytes: z.number().int().nonnegative(),
    fileCount: z.number().int().nonnegative()
  }))
});

export const apiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string()
  })
});

export const driveUserSchema = z.object({
  id: z.string(),
  username: z.string(),
  access: z.enum(["read", "write"]).optional(),
  role: z.enum(["regular", "super"]).optional(),
  isOwner: z.boolean().optional(),
  isDemo: z.boolean().optional()
});

export const accountAccessSchema = z.enum(["read", "write"]);
export const accountRoleSchema = z.enum(["regular", "super"]);
export const accountMemberSchema = driveUserSchema.extend({
  access: accountAccessSchema,
  role: accountRoleSchema,
  isOwner: z.boolean(),
  isDemo: z.boolean(),
  createdAt: z.string().datetime()
});
export const listAccountMembersResponseSchema = z.object({ members: z.array(accountMemberSchema) });

export const demoAccountCredentialsSchema = z.object({
  username: z.string(),
  password: z.string()
});

export const authStatusSchema = z.object({
  authenticated: z.boolean(),
  registrationAllowed: z.boolean(),
  user: driveUserSchema.nullable(),
  demoAccount: demoAccountCredentialsSchema.nullable().optional()
});

export const authCredentialsSchema = z.object({
  username: z.string().trim().min(3).max(32).regex(/^[a-zA-Z0-9_-]+$/),
  password: z.string().min(6).max(256)
});

export const apiKeyScopeSchema = z.enum(["read", "write"]);
export const driveApiKeySchema = z.object({
  id: z.string(),
  name: z.string(),
  prefix: z.string(),
  scopes: z.array(apiKeyScopeSchema),
  createdAt: z.string(),
  expiresAt: z.string().nullable(),
  lastUsedAt: z.string().nullable()
});
export const createdDriveApiKeySchema = driveApiKeySchema.extend({ apiKey: z.string() });
export const listDriveApiKeysResponseSchema = z.object({ keys: z.array(driveApiKeySchema) });

export const databaseEngineIdSchema = z.enum(["sqlite", "duckdb", "libsql", "pglite", "lancedb", "leveldb", "redis", "kuzu"]);
export const databaseProtocolSchema = z.enum(["sql", "vector", "key-value", "redis", "cypher"]);
export const driveDatabaseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  engine: databaseEngineIdSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  sizeBytes: z.number().int().nonnegative()
});
export const listDriveDatabasesResponseSchema = z.object({ databases: z.array(driveDatabaseSchema) });
export const databaseEngineSchema = z.object({
  engine: databaseEngineIdSchema,
  name: z.string(),
  packageName: z.string(),
  availableVersion: z.string(),
  installedVersion: z.string().nullable(),
  protocol: databaseProtocolSchema,
  installed: z.boolean(),
  installedAt: z.string().datetime().nullable(),
  updatedAt: z.string().datetime().nullable(),
  updateAvailable: z.boolean(),
  workspaceAvailable: z.boolean()
});
export const listDatabaseEnginesResponseSchema = z.object({ engines: z.array(databaseEngineSchema) });
export const databaseExecuteRequestSchema = z.record(z.string(), z.unknown()).refine((value) => Object.keys(value).length > 0, "Provide an engine request");
export const databaseExecuteResultSchema = z.object({ engine: databaseEngineIdSchema, result: z.unknown() });
export const databaseTableSchema = z.object({ name: z.string(), schema: z.string() });
export const listDatabaseTablesResponseSchema = z.object({ tables: z.array(databaseTableSchema) });
export const databaseRowsSchema = z.object({
  columns: z.array(z.string()),
  rows: z.array(z.record(z.string(), z.unknown())),
  total: z.number().int().nonnegative()
});
export const databaseQueryResultSchema = z.object({
  columns: z.array(z.string()),
  rows: z.array(z.record(z.string(), z.unknown())),
  changes: z.number().int().nonnegative(),
  lastInsertRowid: z.number().int().nullable()
});
export const databaseImportSettingsSchema = z.object({
  importLimitBytes: z.number().int().positive(),
  minImportLimitBytes: z.number().int().positive(),
  maxImportLimitBytes: z.number().int().positive()
});
export const databaseApiKeyScopeSchema = z.enum(["read", "write"]);
export const databaseApiKeySchema = z.object({
  id: z.string().uuid(),
  databaseId: z.string().uuid(),
  name: z.string(),
  prefix: z.string(),
  scopes: z.array(databaseApiKeyScopeSchema),
  createdAt: z.string().datetime(),
  expiresAt: z.string().datetime().nullable(),
  lastUsedAt: z.string().datetime().nullable()
});
export const createdDatabaseApiKeySchema = databaseApiKeySchema.extend({ apiKey: z.string() });
export const listDatabaseApiKeysResponseSchema = z.object({ keys: z.array(databaseApiKeySchema) });

export const functionRuntimeSchema = z.enum(["javascript", "python"]);
export const functionVisibilitySchema = z.enum(["private", "public"]);
export const driveFunctionSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  runtime: functionRuntimeSchema,
  source: z.string(),
  visibility: functionVisibilitySchema,
  cron: z.string().nullable(),
  enabled: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  lastRunAt: z.string().datetime().nullable(),
  lastRunStatus: z.enum(["success", "error", "timeout"]).nullable()
});
export const functionRunSchema = z.object({
  id: z.string().uuid(),
  functionId: z.string().uuid(),
  startedAt: z.string().datetime(),
  finishedAt: z.string().datetime(),
  status: z.enum(["success", "error", "timeout"]),
  output: z.unknown().nullable(),
  logs: z.string(),
  trigger: z.enum(["manual", "public", "schedule"])
});
export const listDriveFunctionsResponseSchema = z.object({ functions: z.array(driveFunctionSchema) });
export const listFunctionRunsResponseSchema = z.object({ runs: z.array(functionRunSchema) });

export const shareAccessSchema = z.enum(["public", "passcode"]);
export const shareKindSchema = z.enum(["share", "transfer"]);

export const driveShareSchema = z.object({
  id: z.string(),
  key: z.string(),
  name: z.string(),
  size: z.number().int().nonnegative(),
  contentType: z.string(),
  access: shareAccessSchema,
  editable: z.boolean().default(false),
  kind: shareKindSchema.default("share"),
  expiresAt: z.string().nullable(),
  createdAt: z.string()
});

export const listSharesResponseSchema = z.object({ shares: z.array(driveShareSchema) });
export const publicShareSchema = driveShareSchema.pick({ "access": true, "contentType": true, "editable": true, "expiresAt": true, "id": true, "name": true, "size": true }).extend({ requiresPasscode: z.boolean(), updatedAt: z.string().datetime() });

export const sharedPasteContentSchema = z.object({
  format: z.literal("zo-native"),
  type: z.literal("paste"),
  version: z.literal(1),
  language: z.string().max(80),
  tags: z.array(z.string().max(80)).max(20),
  text: z.string().max(1_000_000)
});
export const sharedPasteSchema = z.object({ content: sharedPasteContentSchema, revision: z.string().min(1) });

export const formQuestionSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  type: z.enum([
    "short-answer", "paragraph", "multiple-choice", "checkboxes", "dropdown",
    "linear-scale", "rating", "multiple-choice-grid", "checkbox-grid", "date", "time"
  ]),
  options: z.array(z.string()),
  required: z.boolean(),
  rows: z.array(z.string()).default([]),
  columns: z.array(z.string()).default([]),
  scaleMin: z.number().int().min(0).max(10).default(1),
  scaleMax: z.number().int().min(1).max(10).default(5),
  scaleMinLabel: z.string().default(""),
  scaleMaxLabel: z.string().default(""),
  ratingIcon: z.enum(["star", "heart", "thumb"]).default("star")
});
export const publishedFormSchema = z.object({
  id: z.string(),
  shortCode: z.string().min(6).max(32),
  title: z.string(),
  description: z.string(),
  theme: z.string(),
  banner: z.enum(["none", "botanical", "fireworks"]).default("none"),
  questions: z.array(formQuestionSchema),
  settings: z.object({
    acceptingResponses: z.boolean().default(true),
    confirmationMessage: z.string().default("Your response has been recorded."),
    showProgressBar: z.boolean().default(false)
  }).default({ acceptingResponses: true, confirmationMessage: "Your response has been recorded.", showProgressBar: false })
});
export const formResponseSchema = z.object({
  id: z.string(),
  submittedAt: z.string(),
  answers: z.record(z.string(), z.union([z.string(), z.array(z.string())]))
});
export const listFormResponsesSchema = z.object({ responses: z.array(formResponseSchema) });

export type DriveObject = z.infer<typeof driveObjectSchema>;
export type NativeFileType = z.infer<typeof nativeFileTypeSchema>;
export type ListObjectsResponse = z.infer<typeof listObjectsResponseSchema>;
export type ClusterInvitation = z.infer<typeof clusterInvitationSchema>;
export type ClusterPendingInvitation = z.infer<typeof clusterPendingInvitationSchema>;
export type ClusterMount = z.infer<typeof clusterMountSchema>;
export type ClusterPeer = z.infer<typeof clusterPeerSchema>;
export type ClusterRole = z.infer<typeof clusterRoleSchema>;
export type DriveTrashItem = z.infer<typeof driveTrashItemSchema>;
export type ListTrashResponse = z.infer<typeof listTrashResponseSchema>;
export type DriveFolder = z.infer<typeof driveFolderSchema>;
export type ListFoldersResponse = z.infer<typeof listFoldersResponseSchema>;
export type Health = z.infer<typeof healthSchema>;
export type StorageUsage = z.infer<typeof storageUsageSchema>;
export type ApiError = z.infer<typeof apiErrorSchema>;
export type AccountAccess = z.infer<typeof accountAccessSchema>;
export type AccountRole = z.infer<typeof accountRoleSchema>;
export type AccountMember = z.infer<typeof accountMemberSchema>;
export type ListAccountMembersResponse = z.infer<typeof listAccountMembersResponseSchema>;
export type DemoAccountCredentials = z.infer<typeof demoAccountCredentialsSchema>;
export type DriveUser = z.infer<typeof driveUserSchema>;
export type AuthStatus = z.infer<typeof authStatusSchema>;
export type ApiKeyScope = z.infer<typeof apiKeyScopeSchema>;
export type DriveApiKey = z.infer<typeof driveApiKeySchema>;
export type CreatedDriveApiKey = z.infer<typeof createdDriveApiKeySchema>;
export type DriveDatabase = z.infer<typeof driveDatabaseSchema>;
export type DatabaseEngineId = z.infer<typeof databaseEngineIdSchema>;
export type DatabaseProtocol = z.infer<typeof databaseProtocolSchema>;
export type DatabaseEngine = z.infer<typeof databaseEngineSchema>;
export type DatabaseExecuteRequest = z.infer<typeof databaseExecuteRequestSchema>;
export type DatabaseExecuteResult = z.infer<typeof databaseExecuteResultSchema>;
export type DatabaseTable = z.infer<typeof databaseTableSchema>;
export type DatabaseRows = z.infer<typeof databaseRowsSchema>;
export type DatabaseQueryResult = z.infer<typeof databaseQueryResultSchema>;
export type DatabaseImportSettings = z.infer<typeof databaseImportSettingsSchema>;
export type DatabaseApiKeyScope = z.infer<typeof databaseApiKeyScopeSchema>;
export type DatabaseApiKey = z.infer<typeof databaseApiKeySchema>;
export type CreatedDatabaseApiKey = z.infer<typeof createdDatabaseApiKeySchema>;
export type FunctionRuntime = z.infer<typeof functionRuntimeSchema>;
export type FunctionVisibility = z.infer<typeof functionVisibilitySchema>;
export type DriveFunction = z.infer<typeof driveFunctionSchema>;
export type DriveFunctionRun = z.infer<typeof functionRunSchema>;
export type DriveShare = z.infer<typeof driveShareSchema>;
export type ShareAccess = z.infer<typeof shareAccessSchema>;
export type ShareKind = z.infer<typeof shareKindSchema>;
export type PublicShare = z.infer<typeof publicShareSchema>;
export type SharedPaste = z.infer<typeof sharedPasteSchema>;
export type FormQuestion = z.infer<typeof formQuestionSchema>;
export type PublishedForm = z.infer<typeof publishedFormSchema>;
export type FormResponse = z.infer<typeof formResponseSchema>;
