import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { LocalClusterCache } from "./local-cluster-cache.js";

describe("LocalClusterCache", () => {
  const roots: string[] = [];

  afterEach(async () => {
    await Promise.all(roots.splice(0).map((root) => rm(root, { force: true, recursive: true })));
  });

  it("evicts least-recently-used file bodies without affecting cached manifests", async () => {
    const root = await mkdtemp(join(tmpdir(), "zo-drive-cluster-cache-"));
    roots.push(root);
    const cache = new LocalClusterCache({ root, maxBytes: 6 });
    const scope = { ownerUserId: "bob", mountId: "11111111-1111-4111-8111-111111111111" };
    const put = (key: string, body: string) => cache.putFile({ ...scope, key, name: key, size: body.length, contentType: "text/plain", updatedAt: "2026-07-22T00:00:00.000Z", body: new Blob([body]).stream() });

    await cache.putManifest({ ...scope, objects: [{ key: "first.txt" }] });
    await put("first.txt", "one");
    await put("second.txt", "two");
    expect(await cache.getFile({ ...scope, key: "first.txt" })).not.toBeNull();
    await put("third.txt", "tri");

    expect(await cache.getFile({ ...scope, key: "first.txt" })).not.toBeNull();
    expect(await cache.getFile({ ...scope, key: "second.txt" })).toBeNull();
    expect(await cache.getFile({ ...scope, key: "third.txt" })).not.toBeNull();
    await expect(cache.getManifest(scope)).resolves.toMatchObject({ objects: [{ key: "first.txt" }] });
  });
});
