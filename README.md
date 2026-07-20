# Zo Drive

Zo Drive is a private Drive-like file manager for your Zo server. The source code stays in this repository; uploaded data lives in one configured data root outside it.

Release histories are maintained in [CHANGELOG.GUI.md](CHANGELOG.GUI.md) and
[CHANGELOG.CLI.md](CHANGELOG.CLI.md). See [AGENTS.md](AGENTS.md) for the
GUI/CLI versioning and release policy.

## What works now

- Hono REST API for upload, list, download/preview, delete, search, and storage usage
- Owner-account authentication: signed HttpOnly sessions and one-time registration
- Account controls for username, password, sign-out, and permanent account/data deletion
- Traversal-safe, user-scoped filesystem data root
- Shared TypeScript SDK used by both the CLI and React app
- `zo-drive` CLI: upload, list, download, delete, usage, and secure per-device configuration
- React GUI: folder browsing, search, drag-and-drop/multiple upload of any file type, list/grid views, previews, deletion, and usage display
- Zo-native files: documents, spreadsheets, presentations, forms, and secure text pastes created privately inside the drive
- Zo Paste: dark text editor with language and tag metadata; shared paste links honour the existing expiry and passcode controls
- Home for recently updated files; My Drive as the default; Starred files and Shared with others for managed links
- Share links: public or passcode-protected, with one-day, seven-day, thirty-day, or no-expiry TTL; copy and revoke controls
- Zo Transfer: upload a file or select one already in Drive to create and manage public or passcode-protected expiring links; payment-gated delivery is coming soon
- Account lifecycle design for keeping files or permanently removing everything in [the plan](docs/PLAN.md)

## Storage layout

Set `ZO_DRIVE_DATA_ROOT` to a directory outside this project. Do not use the repository root or add an `uploads` directory here.

```text
ZO_DRIVE_DATA_ROOT/
  v1/auth/users.json                 # salted password hash; never commit this
  v1/shares/shares.json              # share metadata and hashed passcodes
  v1/users/{username}/files/
    Notes/hello.txt
    Photos/image.jpg
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
ZO_DRIVE_API_URL="http://127.0.0.1:43071" ZO_DRIVE_API_KEY="zdk_..." node apps/cli/dist/index.js configure
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

The browser GUI has its own release track, currently `GUI v0.2.0`. GUI changes
are deployed to Zo Drive directly; browser users receive the current version by
loading the page. Use `gui-v*` Git tags to trace a deployed GUI release. CLI
releases are separate and do not change the GUI version.

### CLI

#### Installation

On the machine that will upload files, clone this repository, build it, then
link the CLI globally once. This makes `zo-drive` available from any folder:

```bash
git clone https://github.com/sayyidkhan/zo-drive.git
cd zo-drive
pnpm install
pnpm build
(cd apps/cli && npm link)
zo-drive --help
```

#### Connect your local computer to Zo

From any local computer with internet access, point the CLI at the public
`/drive` address of this Zo Computer, then create a named, scoped API key from
the **API Keys** page in Zo Drive. This is a direct HTTPS connection to Zo
Drive: you do not need SSH, Tailscale, or a Zo dashboard session on the local
machine.

Paste the key without echoing it, then configure the device once. `zo-drive`
stores the connection in `~/.config/zo-drive/config.json` with `0600`
permissions; environment variables can still override it for automation.

```bash
# Public /drive address of your Zo Computer
export ZO_DRIVE_API_URL="https://your-drive.example/drive"
read -rs "ZO_DRIVE_API_KEY?Paste your Zo Drive API key: "
echo
zo-drive configure
unset ZO_DRIVE_API_KEY
zo-drive usage
```

#### Upload a file

With the cloud address and session token exported, upload directly to Drive:

```bash
zo-drive upload ./launch-plan.pdf --path Product/Launch
```

#### CLI updates and versioning

The CLI has its own release track, currently `CLI v1.0.0`. Check an installed
copy with `zo-drive --version`. The global command remains linked to the
repository checkout, so a rebuild updates the existing CLI without running
`npm link` again. Use the `main` branch for the latest pushed changes:

```bash
cd zo-drive
git pull --ff-only
pnpm install --frozen-lockfile
pnpm build
zo-drive --help
```

Stable CLI releases use `cli-v*` Git tags. To pin a machine to a release, fetch
the tags, choose the version returned by the third command, then rebuild:

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

For deployment, set a unique `ZO_DRIVE_SESSION_SECRET` (at least 32 characters; for example `openssl rand -base64 48`), create the owner account before making the site public, run over HTTPS, and use a same-origin reverse proxy for the web app and API. Never expose `ZO_DRIVE_DATA_ROOT` itself. The username is also the user's storage namespace, so renaming it migrates their files and invalidates existing sessions. This is deliberately an owner-only product: it has no public self-registration or collaborative in-app sharing. Add a database-backed identity system, account recovery, rate limiting, and invitations before turning it into a multi-user service.

Share links are deliberately read-only. Public links can open the file directly; passcode links require the passcode for file content; expired and revoked links return no file. On Zo, serve the web app and API from the same origin so public links such as `https://your-drive.zo.com/?share={id}` work without cross-site cookie constraints.
