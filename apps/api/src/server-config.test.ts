import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { loadServerConfig } from "./server-config.js";

describe("loadServerConfig", () => {
  const roots: string[] = [];

  afterEach(async () => {
    await Promise.all(roots.splice(0).map((root) => rm(root, { force: true, recursive: true })));
  });

  it("loads rate-limit settings from a JSON config file", async () => {
    const root = await mkdtemp(join(tmpdir(), "zo-drive-server-config-"));
    roots.push(root);
    const path = join(root, "config.json");
    await writeFile(path, JSON.stringify({ rateLimit: { blockSeconds: 900, maxAttempts: 5, trustProxy: true, windowSeconds: 60 } }));

    await expect(loadServerConfig(path)).resolves.toEqual({
      rateLimit: { blockSeconds: 900, maxAttempts: 5, trustProxy: true, windowSeconds: 60 }
    });
  });

  it("uses an empty config when the optional file is absent", async () => {
    await expect(loadServerConfig(join(tmpdir(), "zo-drive-no-such-config.json"))).resolves.toEqual({});
  });
});
