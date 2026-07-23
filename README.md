# Zo Drive

Zo Drive is a private Drive-like file manager for your Zo server. The source code stays in this repository; uploaded data lives in one configured data root outside it.

Release histories are maintained in [CHANGELOG.GUI.md](CHANGELOG.GUI.md),
[CHANGELOG.CLI.md](CHANGELOG.CLI.md), and
[CHANGELOG.ZOMINAI.md](CHANGELOG.ZOMINAI.md). See [AGENTS.md](AGENTS.md) for
the GUI, CLI, and ZominAI versioning and release policy.

For AI agents interacting with a hosted Drive, use the machine-oriented
[`/drive/llms.txt`](apps/web/public/llms.txt) entry point before the
human-oriented documentation. Keep it updated with any public API,
authentication, or workflow change.

## What works now

- Hono REST API for upload, list, download/preview, delete, search, and owner-complete storage usage across files, Trash, databases, functions, and Zo Originals data
- Persistent runtimes for SQLite, DuckDB, libSQL, PGlite, LanceDB, LevelDB, Redis, and Kuzu, with versioned installation, updates, private database creation, and per-database read/write credentials for external backends
- SQLite table browsing and validated `.sqlite` import/export with owner-configurable limits; every installed engine also has a native in-Drive request workspace and scoped HTTPS connection
- Zo Functions: owner-scoped JavaScript and Python handlers with private or public invocation, UTC cron schedules, and run history
- Owner-account authentication: signed HttpOnly sessions and one-time registration
- Account controls for username, password, sign-out, and permanent account/data deletion
- Traversal-safe, user-scoped filesystem data root
- Shared TypeScript SDK used by both the CLI and React app
- `zo-drive` CLI: upload, list, download, delete, usage, and secure per-device configuration
- React GUI: folder browsing, search, drag-and-drop/multiple upload of any file type, list/grid views, previews, deletion, and usage display
- Zo-native files: documents, spreadsheets, presentations, forms, and secure text pastes created privately inside the drive
- Zo Paste: dark text editor with language and tag metadata; create view-only or editable shared-notepad links with public or passcode access, expiry, and revocation controls
- Home for recently updated files; My Drive as the default; Starred files and Shared with others for managed links
- Share links: public or passcode-protected, with one-day, seven-day, thirty-day, or no-expiry TTL; copy and revoke controls
- Zo Transfer: upload a file or select one already in Drive to create and manage public or passcode-protected expiring links; payment-gated delivery is coming soon
- Zo Shared Drives: remote folder mounts with a persistent, bounded on-demand LRU cache for opened files and folder listings; cached content is not copied into My Drive or charged to the recipient's quota
- Account lifecycle design for keeping files or permanently removing everything in [the plan](docs/PLAN.md)

## Storage layout

Set `ZO_DRIVE_DATA_ROOT` to a directory outside this project. Do not use the repository root or add an `uploads` directory here.

```text
ZO_DRIVE_DATA_ROOT/
  v1/auth/users.json                 # salted password hash; never commit this
  v1/shares/shares.json              # share metadata and hashed passcodes
  v1/databases/api-keys.json         # hashed database-scoped API credentials
  v1/clusters/cache/                 # private Shared Drive metadata and LRU file cache
  v1/users/{username}/files/
    Notes/hello.txt
    Photos/image.jpg
  v1/users/{username}/databases/
    databases.json                    # private database registry
    instances/                        # persistent engine data
  v1/users/{username}/stars.json       # private starred-file metadata
```

For development, use a directory such as:

```text
/Users/your-user/Library/Application Support/zo-drive-data
```

On Zo, configure a persistent directory such as `~/zo-drive-data` and point `ZO_DRIVE_DATA_ROOT` to it.

## Run locally

Install dependencies once:

```bash
pnpm install
```

Redis databases also require a `redis-server` executable on the host. The
catalogue install action verifies the binary before marking Redis installed.

In one terminal, start the API:

```bash
ZO_DRIVE_DATA_ROOT="$HOME/Library/Application Support/zo-drive-data" \
ZO_DRIVE_SESSION_SECRET="replace-this-with-a-long-random-secret" \
ZO_DRIVE_ALLOWED_ORIGIN="http://127.0.0.1:43072" \
pnpm --filter @zo-drive/api dev
```

In another terminal, start the web app:

```bash
VITE_ZO_DRIVE_API_URL="http://127.0.0.1:43071" pnpm --filter @zo-drive/web dev
```

The CLI uses the same API:

```bash
pnpm --filter @zo-drive/cli build
# Create a scoped device key in the browser at Zo Drive > API Keys first.
node apps/cli/dist/index.js configure
node apps/cli/dist/index.js upload ./example.pdf --path Documents
node apps/cli/dist/index.js mkdir Documents/Receipts
node apps/cli/dist/index.js ls Documents
```

## Upload from another machine

The hosted UI includes a public landing page at the Drive URL. Select **Zo Drive**
in the top-right corner to open the private browser workspace, or select **Docs**
for the in-product upload guide.

### Browser GUI

After signing in, use the fixed **Upload** button in the bottom-right corner. You
can drop a file or folder into the panel, or use **Choose file** and **Choose
folder**. Folder uploads retain their directory structure below the current Drive
folder.

#### GUI versioning

The browser GUI has its own release track, currently `GUI v1.41.1`. GUI changes
are deployed to Zo Drive directly; browser users receive the current version by
loading the page. Use `gui-v*` Git tags to trace a deployed GUI release. CLI
releases are separate and do not change the GUI version.

### CLI

#### Installation

The production distribution target is a standalone npm package:

```bash
npm install --global zo-drive
zo-drive --help
```

That package is not published yet. Do not rely on the command above until a
CLI release announcement confirms it is available. The current temporary
setup is for developers and release testing only.

#### Developer setup (temporary)

Clone this repository, build it, then link the CLI globally. This makes
`zo-drive` available from any folder, but it executes the checked-out source
and is not the supported end-user installation path:

```bash
git clone https://github.com/sayyidkhan/zo-drive.git
cd zo-drive
pnpm install
pnpm build
(cd apps/cli && npm link)
zo-drive --help
```

#### Production packaging direction

The published `zo-drive` package will bundle its internal SDK and types so an
end user installs one package and does not need this repository, pnpm, or npm
links. Until that release exists, use the developer setup above only for local
testing.

#### Connect your local computer to Zo

From any local computer with internet access, create a named, scoped API key
from the **API Keys** page in Zo Drive. This is a direct HTTPS connection to
Zo Drive: you do not need SSH, Tailscale, or a Zo dashboard session on the
local machine.

Run one command. It asks for the public `/drive` address of this Zo Computer,
then accepts the device key with hidden terminal input. `zo-drive` stores the
connection in `~/.config/zo-drive/config.json` with `0600` permissions, so
future commands use it automatically.

```bash
zo-drive configure
# Zo Drive URL: https://your-drive.example/drive
# Zo Drive API key: [input hidden]
zo-drive usage
```

#### Upload a file

With the local connection saved, upload directly to Drive:

```bash
zo-drive upload ./launch-plan.pdf --path Product/Launch
# Validate the connection, file, quota, and destination without transferring it.
zo-drive upload ./launch-plan.pdf --path Product/Launch --dry-run
```

Uploads of 1 MB or more show a live progress bar in an interactive terminal.

To confirm a remote file exists before downloading it, without creating a
local file:

```bash
zo-drive download Product/Launch/launch-plan.pdf --output ./launch-plan.pdf --dry-run
```

#### Find a file

List a folder or use `exists` when you need a scriptable yes/no check. `exists`
returns exit code `0` when the exact file is present and `1` when it is absent.

```bash
zo-drive ls Product/Launch
zo-drive exists Product/Launch/launch-plan.pdf
zo-drive stat Product/Launch/launch-plan.pdf
# Use --json when a script needs structured metadata.
zo-drive stat Product/Launch/launch-plan.pdf --json
```

`zo-drive ls` supports familiar listing flags: `-l` for size and time, `-t`
for newest first, `-S` for largest first, `-r` to reverse, `-a` for hidden
names, and `-R` for nested folders. Run `zo-drive ls --help` for the full
Drive-compatible list. Unix-only fields such as owners, permissions, inodes,
and symlinks do not exist in Zo Drive.

#### Move or remove a file

Move a file by supplying its exact destination key. `rm` moves the file to Zo
Drive Trash; it does not permanently delete the file.

```bash
zo-drive mv Product/Launch/launch-plan.pdf Archive/2026/launch-plan.pdf
zo-drive rm Archive/2026/launch-plan.pdf
```

Copy a Drive file without downloading it to your computer. By default, copying
does not replace an existing destination; add `--force` only when you intend
to replace it.

```bash
zo-drive cp Product/Launch/launch-plan.pdf Archive/2026/launch-plan-copy.pdf
zo-drive cp Product/Launch/launch-plan.pdf Archive/2026/launch-plan-copy.pdf --force
```

#### Zo Originals from the CLI

The CLI also manages Zo Paste, Zo Transfer, Zo Shared Drives, Zo Databases, and
Zo Functions through the same authenticated API as the browser workspace.
ZominAI is intentionally not part of the CLI.

```bash
# Create and share a private paste.
zo-drive paste create deployment-notes --path Notes --file ./notes.md --language markdown --tags release,ops
zo-drive paste share Notes/deployment-notes --access passcode --passcode "share-this" --expires 7d

# Create a controlled transfer link for a Drive file.
zo-drive transfer create Product/Launch/launch-plan.pdf --access public --expires 7d

# Install SQLite, create a database, and run a query.
zo-drive database engine install sqlite
zo-drive database create metrics --engine sqlite
zo-drive database query <database-id> --sql "SELECT 1 AS ready" --json

# Create and run a JavaScript function.
zo-drive function create --name echo --source 'export default async input => input'
zo-drive function run <function-id> --input '{"ok":true}' --json
```

Run `zo-drive shared`, `zo-drive database`, or `zo-drive function` without
subcommands to see the command family for invitations and mounts, database
credentials and import/export, or function runs and source updates.

#### Check Drive status

Confirm the connection and storage usage:

```bash
zo-drive status
```

For an operator-focused check of API latency, authentication, storage, and
filesystem capacity, use:

```bash
zo-drive health
zo-drive health --json
```

`health` does not report Zo Computer CPU, memory, uptime, or process health;
those belong to the Zo Computer platform rather than the Drive service.

Print the logo on its own for a terminal profile, demo, or script:

```bash
zo-drive logo
```

#### CLI updates and versioning

The CLI has its own independent release track. This checkout reports `CLI
v1.3.0`; check an installed copy with `zo-drive --version`.

For a developer checkout linked with npm, rebuild after pulling changes; the
existing link then uses the updated build:

```bash
cd zo-drive
git pull --ff-only
pnpm install --frozen-lockfile
pnpm build
zo-drive --help
```

Stable CLI releases use `cli-v*` Git tags. After the standalone package is
published, update a global installation with:

```bash
npm update --global zo-drive
```

To test a source checkout at a tagged release, fetch the tags, choose the
version returned by the third command, then rebuild:

```bash
cd zo-drive
git fetch origin --tags
git tag --list 'cli-v*' --sort=-v:refname | head -n 1
git checkout <cli-release-tag>
pnpm install --frozen-lockfile
pnpm build
```

### TypeScript SDK

The workspace SDK powers both the web app and CLI. Build it with
`pnpm --filter @zo-drive/sdk build`, then use it from a script in this repository:

```ts
import { readFile } from "node:fs/promises";
import { ZoDriveClient } from "@zo-drive/sdk";

const client = new ZoDriveClient({
  baseUrl: "https://your-drive.example/drive",
  headers: { authorization: `Bearer ${process.env.ZO_DRIVE_API_KEY}` }
});

const bytes = await readFile("./launch-plan.pdf");
await client.upload({
  file: new Blob([bytes], { type: "application/pdf" }),
  fileName: "launch-plan.pdf",
  path: "Product/Launch"
});
```

The device API key is a bearer credential. Keep it in a secret manager and
never commit it to source control. Create separate scoped keys for each
machine or automation, and revoke a key from Zo Drive immediately if it may
have been exposed.

## Verify before trying it

```bash
pnpm test
pnpm typecheck
pnpm build
```

The test suite includes a full CLI → SDK → API → data-root flow: upload, list, download with byte verification, and delete.

## Deployment note

On its first visit, Zo Drive shows **Create your owner account**, not the drive. Registration is available only while no user exists; immediately after creation, all visitors see **Sign in** and every drive endpoint requires a valid session. Passwords are salted and hashed with scrypt; the browser session is an HttpOnly, signed cookie.

For deployment, set a unique `ZO_DRIVE_SESSION_SECRET` (at least 32 characters; for example `openssl rand -base64 48`), create the owner account before making the site public, run over HTTPS, and use a same-origin reverse proxy for the web app and API. Never expose `ZO_DRIVE_DATA_ROOT` itself. The username is also the user's storage namespace, so renaming it migrates their files and invalidates existing sessions. This is deliberately an owner-only product: it has no public self-registration or collaborative in-app sharing. Add a database-backed identity system, account recovery, and invitations before turning it into a multi-user service.

Device API keys are protected against repeated invalid attempts: five failed `zdk_…` keys in one minute block further attempts for 15 minutes and return `429 Too Many Requests` with `Retry-After`. By default the limiter uses a one-way key fingerprint and never stores the raw key.

Configure these settings in `apps/api/config.json` (start from `apps/api/config.example.json`):

```json
{
  "rateLimit": {
    "trustProxy": true,
    "maxAttempts": 5,
    "windowSeconds": 60,
    "blockSeconds": 900
  }
}
```

Set `trustProxy` to `true` only when your reverse proxy sanitizes and sets `X-Forwarded-For`; it applies the limit per client IP. The config file is Git-ignored. For a nonstandard location, use `ZO_DRIVE_CONFIG_PATH=/absolute/path/to/config.json`. The existing rate-limit environment variables remain fallbacks only when a value is omitted from the JSON config.

Share links are deliberately read-only. Public links can open the file directly; passcode links require the passcode for file content; expired and revoked links return no file. On Zo, serve the web app and API from the same origin so public links such as `https://your-drive.zo.com/?share={id}` work without cross-site cookie constraints.

### Shared Drive cache

Connected Shared Drives remain remote mounts: Zo Drive does not bulk-copy a
shared folder into a recipient's Drive. It stores the latest remote file tree
and the bytes of files a recipient has actually opened in a separate persistent
LRU cache. The cache is used only when the remote source is unavailable; it is
not visible in My Drive and does not count towards the recipient's Drive quota.

The default content-cache limit is 1 GiB. Set `ZO_DRIVE_CLUSTER_CACHE_BYTES`
to a positive byte value to choose a different limit. Cache entries are removed
least-recently-used first and are invalidated after a mounted-folder write,
rename, delete, or disconnect. Permission failures and missing-file responses
never fall back to cached content.
