import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { defaultConfigPath, readLocalConfig, writeLocalConfig } from "./config.js";

describe("local Zo Drive CLI configuration", () => {
  const roots: string[] = [];

  afterEach(async () => {
    await Promise.all(roots.splice(0).map((root) => rm(root, { force: true, recursive: true })));
  });

  it("stores the local device key in an owner-only configuration file", async () => {
    const home = await mkdtemp(join(tmpdir(), "zo-drive-cli-"));
    roots.push(home);
    const path = defaultConfigPath(home);

    await writeLocalConfig({ apiKey: "zdk_example", apiUrl: "https://drive.example/drive" }, path);

    await expect(readLocalConfig(path)).resolves.toEqual({ apiKey: "zdk_example", apiUrl: "https://drive.example/drive" });
    expect((await stat(path)).mode & 0o777).toBe(0o600);
    expect((await stat(join(home, ".config", "zo-drive"))).mode & 0o777).toBe(0o700);
  });
});
