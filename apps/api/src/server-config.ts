import { readFile } from "node:fs/promises";

import { z } from "zod";

const serverConfigSchema = z.object({
  rateLimit: z.object({
    blockSeconds: z.number().int().positive().optional(),
    maxAttempts: z.number().int().positive().optional(),
    trustProxy: z.boolean().optional(),
    windowSeconds: z.number().int().positive().optional()
  }).optional()
}).strict();

export type ServerConfig = z.infer<typeof serverConfigSchema>;

export async function loadServerConfig(path: string): Promise<ServerConfig> {
  let contents: string;
  try {
    contents = await readFile(path, "utf8");
  } catch (error) {
    if (isMissingFile(error)) return {};
    throw error;
  }

  let value: unknown;
  try {
    value = JSON.parse(contents);
  } catch {
    throw new Error(`Zo Drive API config at ${path} is not valid JSON`);
  }
  const parsed = serverConfigSchema.safeParse(value);
  if (!parsed.success) {
    throw new Error(`Zo Drive API config at ${path} is invalid: ${parsed.error.issues.map((issue) => issue.message).join(", ")}`);
  }
  return parsed.data;
}

function isMissingFile(error: unknown): error is NodeJS.ErrnoException {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}
