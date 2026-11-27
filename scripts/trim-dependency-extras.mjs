import { createRequire } from "node:module";
import { existsSync, lstatSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { dirname, join } from "node:path";

const require = createRequire(new URL("../apps/api/package.json", import.meta.url));
const root = dirname(require.resolve("kuzu"));
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));

if (pkg.version !== "0.11.3" || !existsSync(join(root, "kuzujs.node"))) {
  console.log("Skipping Kuzu extras: version or installed native binary needs review.");
  process.exit(0);
}

function bytes(path) {
  if (!existsSync(path) || lstatSync(path).isSymbolicLink()) return 0;
  return statSync(path).isDirectory()
    ? readdirSync(path).reduce((sum, name) => sum + bytes(join(path, name)), 0)
    : statSync(path).size;
}

const targets = [join(root, "kuzu-source", "dataset")];
const prebuilt = join(root, "prebuilt");
const native = `kuzujs-${process.platform}-${process.arch}.node`;
if (existsSync(join(prebuilt, native))) {
  for (const name of readdirSync(prebuilt)) {
    if (/^kuzujs-(linux|darwin|win32)-(x64|arm64)\.node$/.test(name) && name !== native) {
      targets.push(join(prebuilt, name));
    }
  }
}

let removed = 0;
for (const path of targets) {
  if (existsSync(path) && lstatSync(path).isSymbolicLink()) throw new Error(`Unexpected symlink: ${path}`);
  removed += bytes(path);
  rmSync(path, { recursive: true, force: true });
}
console.log(JSON.stringify({ package: `kuzu@${pkg.version}`, bytesRemoved: removed }));
