import { access, mkdir, stat, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { join } from "node:path";
import { spawn } from "node:child_process";

export const zominAiModelVersion = "Bonsai-8B-Q1_0.gguf";
export type ZominAiInstallationStatus = { model: { fileName: string; installed: boolean; location: string; sizeBytes: number; version: string }; runtimeLocation: string; state: "downloading" | "installed" | "not-installed" | "removed" };

export class LocalZominAiModelManager {
  readonly #modelPath: string;
  readonly #partialPath: string;
  readonly #disabledPath: string;

  constructor(private readonly options: { managerScript: string; runtimeRoot: string }) {
    this.#modelPath = join(options.runtimeRoot, "models", zominAiModelVersion);
    this.#partialPath = `${this.#modelPath}.part`;
    this.#disabledPath = join(options.runtimeRoot, "state", "disabled");
  }

  async status(): Promise<ZominAiInstallationStatus> {
    const [model, partial, disabled] = await Promise.all([fileSize(this.#modelPath), fileSize(this.#partialPath), exists(this.#disabledPath)]);
    return { model: { fileName: zominAiModelVersion, installed: model > 0, location: this.#modelPath, sizeBytes: model, version: zominAiModelVersion }, runtimeLocation: this.options.runtimeRoot, state: model > 0 && !disabled ? "installed" : partial > 0 ? "downloading" : disabled ? "removed" : "not-installed" };
  }

  async install(version: string): Promise<void> {
    assertVersion(version);
    await mkdir(join(this.options.runtimeRoot, "state"), { recursive: true });
    await writeFile(this.#disabledPath, "installing\n");
    const child = spawn(this.options.managerScript, ["install", version], { detached: true, stdio: "ignore" });
    child.unref();
  }

  async uninstall(version: string): Promise<void> {
    assertVersion(version);
    await new Promise<void>((resolve, reject) => {
      const child = spawn(this.options.managerScript, ["uninstall", version], { stdio: "ignore" });
      child.once("error", reject);
      child.once("exit", (code) => code === 0 ? resolve() : reject(new Error("Could not remove the selected ZominAI model.")));
    });
  }
}

function assertVersion(version: string) { if (version !== zominAiModelVersion) throw new Error("Select the exact supported ZominAI model version."); }
async function exists(path: string) { try { await access(path, constants.F_OK); return true; } catch { return false; } }
async function fileSize(path: string) { try { return (await stat(path)).size; } catch { return 0; } }
