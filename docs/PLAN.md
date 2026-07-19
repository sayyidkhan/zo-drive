# Zo Drive Implementation Plan

## Purpose

Build Zo Drive in two deliberate phases:

1. Prove a Zo-hosted data root through a TypeScript backend, shared SDK, and CLI.
2. Build a Google Drive-like web GUI on top of that proven API and SDK.

The product remains a thin application layer over Zo's persistent workspace filesystem. The application owns one configured data root outside the source repository; it does not build a custom storage engine.

## Technology Decisions

| Area | Choice | Reason |
| --- | --- | --- |
| Language | TypeScript | One type-safe language for API, SDK, CLI, and web app; fastest MVP iteration. |
| API | Hono | Matches the technical specification and keeps the API lightweight. |
| Storage | Zo persistent workspace filesystem | Primary source of truth for uploaded files; isolated from source code by `ZO_DRIVE_DATA_ROOT`. |
| Web app | React 19 + Vite | Matches the technical specification. |
| Client data | TanStack Query | Cache and synchronize API data in the web app. |
| UI state | Zustand | Keep local UI state separate from server state. |
| Tests | Vitest | Fast TypeScript test runner for SDK, API, and CLI checks. |

JavaScript/TypeScript is sufficient for the MVP. Before considering Go or Rust, measure the actual bottleneck. For large files, stream requests and responses instead of buffering whole files in memory.

## Architecture

```text
                    React web app                 CLI
                         |                          |
                         +---- shared TypeScript SDK-+
                                           |
                          signed session / bearer token
                                           |
                                     Hono REST API
                                           |
                              Zo persistent data root
```

The web app and CLI must call the same REST API via `packages/sdk`. Neither client should duplicate storage API logic or access the Zo server filesystem directly.

## MVP Scope

### Included

- Authentication and user-scoped access
- Upload, list, download, and delete files
- Folder-style navigation using object-key prefixes
- Search by filename and extension
- Storage usage display
- Image, PDF, audio, and video previews in the web app
- Drag-and-drop and multiple uploads in the web app
- Home view for recently updated files
- Share links with public/passcode protection, TTL, copy, revoke, and public-link viewer

### Deferred

- Durable favourites, tags, and collaborative editing permissions
- Version history and duplicate detection
- AI search, OCR, captions, and smart folders
- Desktop and mobile apps

## Key Design Decisions and Risks

### Storage root and folders

Zo's current public documentation describes persistent workspace files and hosted sites/services, but not a public object-storage bucket SDK. Zo Drive will therefore use a configured data root on the machine where its Hono service runs. The same layout is used locally and on Zo, while the physical locations are separate from the source repository:

```text
Local development:  /Users/sayyid/Library/Application Support/zo-drive-data
Zo deployment:      ~/zo-drive-data

ZO_DRIVE_DATA_ROOT/
  v1/users/{userId}/files/Work/Invoices/{uuid}--invoice-july.pdf
```

The local Git repository contains source code only. It is never an upload destination and no `uploads/` directory is needed. Unit tests use temporary directories; local integration tests use the configured local data root; deployed integration tests use the data root on Zo.

The API owns the root and user namespace. A client may request a relative folder path such as `Work/Invoices`, but it cannot choose `v1/` or another user's prefix. Folder navigation comes from directory structure. The storage adapter must resolve paths safely and reject traversal attempts such as `../`.

### User isolation

Every object key must be scoped under the authenticated user's namespace. The API must derive that namespace from the session; it must never trust a user ID supplied by the client.

### Authentication and deployment access

The initial product is owner-only. On a new data root, `POST /auth/register` creates the first and only account; the endpoint refuses every later registration. Create this account before making a deployment public, otherwise a first visitor could claim the empty drive. The user record stores only a normalized username, creation time, and a salted scrypt password hash at `v1/auth/users.json`. It is application data outside Git.

`POST /auth/login` creates a signed seven-day session. Browsers use a `Secure`, `HttpOnly`, `SameSite=Lax` cookie in production; the API derives the user namespace exclusively from this session. CLI login explicitly receives the same short-lived token and sends it as a bearer token. No route accepts a client-provided user ID.

The web app must always request `/auth/status` before requesting any drive data. If no account exists it shows owner registration; otherwise it shows sign-in. Deploy under HTTPS with a high-entropy `ZO_DRIVE_SESSION_SECRET` and a same-origin web/API proxy. This is not yet a general public multi-user identity product: add durable sessions, account recovery, rate limits, audit logging, and invitations before opening registration or sharing.

### Metadata and sharing

The initial MVP treats the configured data root as the file source of truth. Directory listing supports basic name search, folder navigation, file counts, usage totals, and a recent-files Home view. Share-link metadata is stored separately at `v1/shares/shares.json`, which allows links to be revoked without touching the original file.

The owner can create view-only links with either public access or a hashed passcode, and choose no expiry, one day, seven days, or thirty days. The API enforces expiry and passcode checks before streaming content. Deleting an account removes its share metadata before the account record disappears. Collaborative invitations and in-app multi-user editing remain deferred until a database-backed identity model exists.

### File paths

File keys can contain slashes, so download and delete routes must safely support nested relative paths. Use a wildcard route such as `GET /objects/*`, URL-encode/decode paths consistently, and resolve paths against `ZO_DRIVE_DATA_ROOT` with traversal protection.

### CLI name

The product docs use `zo` as the sample command. Confirm that this does not collide with Zo's own platform CLI. Until confirmed, distribute the app CLI as `zo-drive`.

## Phase A — Backend, SDK, and CLI

### A1. Validate the Zo data-root model and platform access

Before building the product, create an isolated TypeScript smoke test against a temporary data root.

It must prove:

1. Loading and validating `ZO_DRIVE_DATA_ROOT` from environment configuration.
2. Upload of a text fixture and a binary fixture.
3. Listing directories and pagination behavior.
4. Download/streaming and byte-for-byte checksum validation.
5. Content type and file metadata retrieval.
6. Deletion.
7. Nested paths and safe handling of spaces or special characters in filenames.
8. Expected errors for missing objects and invalid credentials.

No credentials are committed. The deployed integration test is opt-in and runs only when its required environment variables are present.

**Exit criterion:** the adapter can reliably upload, list, stream, and delete a file within the configured data root.

### A2. Bootstrap the monorepo

Create the following workspace structure:

```text
apps/
  api/
  cli/
  web/                  # scaffold only during Phase A
packages/
  sdk/
  types/
docs/
```

Configure shared TypeScript settings, linting, formatting, environment-variable validation, and root scripts for test, typecheck, lint, and build.

### A3. Create shared API contracts

In `packages/types`, define request and response types plus Zod schemas for:

- `DriveObject`
- `ListObjectsResponse`
- `UploadResponse`
- `StorageUsage`
- `ApiError`
- pagination and prefix-listing inputs

Keep the public contract independent of the low-level filesystem adapter implementation.

### A4. Build the Hono API

Implement a small storage service that isolates filesystem operations from HTTP routes.

Initial endpoints:

```text
GET     /health
GET     /objects?prefix=&cursor=&limit=&query=
POST    /objects
GET     /objects/*
DELETE  /objects/*
GET     /usage
```

Responsibilities:

- validate all inputs with Zod
- resolve the authenticated user or private Zo-site owner
- prepend and enforce the user data namespace
- stream uploads and downloads without buffering whole files in memory
- preserve content type and content disposition on downloads
- return consistent, typed errors
- avoid logging secrets or full private object keys

**Exit criterion:** automated API tests pass, including validation, authorization boundaries, successful streaming, and error handling.

### A5. Build the shared SDK

Implement `packages/sdk` as the only application client for the REST API.

Initial API:

```ts
zoDrive.list({ prefix, query, cursor })
zoDrive.upload({ file, path, onProgress })
zoDrive.download({ key })
zoDrive.delete({ key })
zoDrive.getUsage()
```

The SDK must work in both browser and Node contexts, expose useful typed errors, and not embed credentials.

**Exit criterion:** SDK unit tests cover request construction, response parsing, error handling, and upload progress behavior.

### A6. Build and test the CLI

Implement the CLI using the shared SDK, not direct filesystem access to the Zo server.

Initial commands:

```text
zo-drive login
zo-drive upload <file> [--path <prefix>]
zo-drive ls [path]
zo-drive download <key> [--output <file>]
zo-drive delete <key>
zo-drive usage
```

Include `--json` output for automation and clear progress/error messages for people.

Run a live end-to-end sequence:

```text
upload -> list -> download -> compare checksum -> delete -> confirm missing
```

**Phase A completion criterion:** a user can securely upload, list, download, and delete files through the CLI, using the same API and shared SDK that the web application will use.

## Phase B — Google Drive-like GUI

### B1. Web application foundation

Set up React 19, Vite, Tailwind CSS, shadcn/ui, TanStack Query, Zustand, Lucide, and Sonner in `apps/web`.

Use the shared SDK exclusively for data access.

### B2. Core user experience

Build:

- sign-in and session handling
- Drive-style sidebar and main content layout
- My Drive folder browser with breadcrumbs
- list and grid views
- New/upload controls and drag-and-drop uploads
- multi-file progress display
- create folder, rename, move, download, and delete actions
- filename/extension search
- storage usage indicator
- loading, empty, success, and error states

### B3. Preview experience

Preview supported types without forcing a download:

- images: PNG, JPG, GIF, WebP
- video: MP4
- audio: MP3, WAV
- documents: PDF

Unsupported file types receive a download action.

### B4. Quality and acceptance checks

Validate that a browser user can:

1. Upload one or more files.
2. Navigate to the containing prefix/folder.
3. Search for a file by name.
4. Preview a supported file.
5. Download and delete it.
6. See updated usage without a manual page reload.

The layout must be responsive and keyboard-accessible for primary actions.

**Phase B completion criterion:** the web app delivers a familiar personal-drive workflow while using the same API behavior already proven by the CLI.

## Phase C — Deployment, Account Lifecycle, and Product Extensions

1. Deploy the web app and Hono API as a Zo Site or Service, selecting private access for the owner-only MVP.
2. Configure `ZO_DRIVE_DATA_ROOT`, a unique `ZO_DRIVE_SESSION_SECRET`, HTTPS/same-origin proxying, upload limits, observability, and error reporting.
3. Add durable sessions, account recovery, rate limits, audit logging, and a persistent database before introducing public multi-user access, durable metadata, or permissions.
4. Add background processing for thumbnails and OCR after the core workflow is stable.
5. Add Zo AI only after the core file-management workflow is stable.

### User Uninstall and Data Removal

Uninstalling a device-level CLI or removing a browser shortcut is already safe: it removes only local program files and never touches the Zo data root. The account-level flows below apply when a user asks to remove Zo Drive itself.

The reusable [Zo Drive installation skill](../skills/zo-drive-install/SKILL.md) governs installation, verification, updates, and these removal paths. It must be used whenever Zo Drive is deployed or removed.

The account page implements the nuclear path: it requires the current password plus the exact text `DELETE MY DRIVE`, removes only `v1/users/{userId}/`, removes the account record, and invalidates the browser session. The corresponding API test verifies that the old session cannot access drive routes after deletion.

### Option A: Remove Zo Drive, keep the files

The user disconnects from Zo Drive while retaining their stored files.

1. Confirm that files will remain in the Zo data root and show the retained data location.
2. Revoke Zo Drive sessions, API tokens, and device authorizations.
3. Delete only Zo Drive application metadata: preferences, cached search data, and optional database records that are not necessary to retain access to the files.
4. Preserve the user's data directory unchanged, or explicitly hand it off to a user-owned Zo location.
5. Show an export/recovery path so the user can retrieve the preserved files without the Zo Drive application.

This option requires a product-level ownership decision: users must retain direct Zo file access, or the application must provide an explicit export/handoff flow. Keeping files in an application-owned data root without either mechanism would be misleading because the user could no longer access them after the application is removed.

### Option B: Nuclear removal — remove everything

The user permanently deletes their Zo Drive account and all associated data.

1. Require recent authentication plus an explicit irreversible confirmation, for example typing `DELETE MY DRIVE`.
2. Revoke active sessions, API tokens, public links, and shared access first.
3. Create a deletion job scoped exclusively to `v1/users/{userId}/`.
4. Enumerate and delete every file and directory under that path; never accept an arbitrary path from the client.
5. Delete associated database metadata, sharing records, preferences, and workflow/AI artifacts.
6. Remove the Zo Drive account profile only after storage deletion succeeds; retain the minimum non-content audit event needed to confirm completion.
7. Report completion only after a final directory listing confirms that no user files remain.

The implementation must be idempotent and retry-safe. It must be tested with two users to prove that deleting one account cannot delete another user's objects. Nuclear removal is permanent; a future product decision can add a clearly labelled retention window, but it must not be presented as immediate permanent deletion.

## Inputs Required Before Phase A Implementation

- The approved data-root directory on the deployed Zo server and how it is made persistent.
- The deployment flow for the Zo Site or Service.
- Confirmation whether this starts as the private owner-only drive or a public multi-user product.
- Confirmation of the end-user ownership/handoff model required for the "remove Zo Drive, keep files" option.

## Definition of Done

- Phase A is complete when the live CLI workflow passes against the deployed Zo data root.
- Phase B is complete when the GUI performs the same workflow through the shared SDK.
- The browser has no direct access to the Zo server filesystem.
- All user objects are authorization-scoped and inaccessible across users.
