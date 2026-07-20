import { chmod, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { randomUUID } from "node:crypto";

export type LocalCliConfig = {
  apiKey: string;
  apiUrl: string;
};

export function defaultConfigPath(home = homedir()): string {
  return join(home, ".config", "zo-drive", "config.json");
}

export async function readLocalConfig(path = defaultConfigPath()): Promise<LocalCliConfig | null> {
  try {
    const value = JSON.parse(await readFile(path, "utf8")) as Partial<LocalCliConfig>;
    return typeof value.apiKey === "string" && typeof value.apiUrl === "string" && value.apiKey && value.apiUrl ? { apiKey: value.apiKey, apiUrl: value.apiUrl } : null;
  } catch (error: unknown) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT") return null;
    throw new Error(`Could not read Zo Drive configuration: ${error instanceof Error ? error.message : "invalid JSON"}`);
  }
}

export async function writeLocalConfig(config: LocalCliConfig, path = defaultConfigPath()): Promise<void> {
  const folder = dirname(path);
  await mkdir(folder, { recursive: true, mode: 0o700 });
  await chmod(folder, 0o700);
  const temporary = `${path}.${randomUUID()}.tmp`;
  await writeFile(temporary, `${JSON.stringify(config, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  await rename(temporary, path);
  await chmod(path, 0o600);
}
