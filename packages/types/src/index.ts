import { z } from "zod";

export const nativeFileTypeSchema = z.enum(["document", "spreadsheet", "presentation", "form"]);

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
  usedBytes: z.number().int().nonnegative()
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

export const driveShareSchema = z.object({
  id: z.string(),
  key: z.string(),
  name: z.string(),
  size: z.number().int().nonnegative(),
  contentType: z.string(),
  access: shareAccessSchema,
  expiresAt: z.string().nullable(),
  createdAt: z.string()
});

export const listSharesResponseSchema = z.object({ shares: z.array(driveShareSchema) });
export const publicShareSchema = driveShareSchema.pick({ "access": true, "contentType": true, "expiresAt": true, "id": true, "name": true, "size": true }).extend({ requiresPasscode: z.boolean() });

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
export type PublicShare = z.infer<typeof publicShareSchema>;
