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

export const driveTrashItemSchema = z.object({
  id: z.string(),
  originalKey: z.string(),
  name: z.string(),
  size: z.number().int().nonnegative(),
  contentType: z.string(),
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
    id: z.enum(["photos", "videos", "documents", "audio", "archives", "other", "trash"]),
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
  username: z.string()
});

export const authStatusSchema = z.object({
  authenticated: z.boolean(),
  registrationAllowed: z.boolean(),
  user: driveUserSchema.nullable()
});

export const authCredentialsSchema = z.object({
  username: z.string().trim().min(3).max(32).regex(/^[a-zA-Z0-9_-]+$/),
  password: z.string().min(6).max(256)
});

export const shareAccessSchema = z.enum(["public", "passcode"]);
export const shareKindSchema = z.enum(["share", "transfer"]);

export const driveShareSchema = z.object({
  id: z.string(),
  key: z.string(),
  name: z.string(),
  size: z.number().int().nonnegative(),
  contentType: z.string(),
  access: shareAccessSchema,
  kind: shareKindSchema.default("share"),
  expiresAt: z.string().nullable(),
  createdAt: z.string()
});

export const listSharesResponseSchema = z.object({ shares: z.array(driveShareSchema) });
export const publicShareSchema = driveShareSchema.pick({ "access": true, "contentType": true, "expiresAt": true, "id": true, "name": true, "size": true }).extend({ requiresPasscode: z.boolean() });

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
export type DriveTrashItem = z.infer<typeof driveTrashItemSchema>;
export type ListTrashResponse = z.infer<typeof listTrashResponseSchema>;
export type DriveFolder = z.infer<typeof driveFolderSchema>;
export type ListFoldersResponse = z.infer<typeof listFoldersResponseSchema>;
export type StorageUsage = z.infer<typeof storageUsageSchema>;
export type ApiError = z.infer<typeof apiErrorSchema>;
export type DriveUser = z.infer<typeof driveUserSchema>;
export type AuthStatus = z.infer<typeof authStatusSchema>;
export type DriveShare = z.infer<typeof driveShareSchema>;
export type ShareAccess = z.infer<typeof shareAccessSchema>;
export type ShareKind = z.infer<typeof shareKindSchema>;
export type PublicShare = z.infer<typeof publicShareSchema>;
export type FormQuestion = z.infer<typeof formQuestionSchema>;
export type PublishedForm = z.infer<typeof publishedFormSchema>;
export type FormResponse = z.infer<typeof formResponseSchema>;
