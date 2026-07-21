# GUI Changelog

All notable changes to the Zo Drive browser experience are recorded here.

## Unreleased

## v1.17.0 - 2026-07-21

### Added

- Show persistent local ZominAI model download progress and explain that the
  Mac runtime continues when the browser page is closed.

## v1.16.2 - 2026-07-21

### Added

- Link the ZominAI setup to PrismML, the Bonsai model and licence, and the
  local runtime documentation; clarify that models and inference stay local.

## v1.16.1 - 2026-07-21

### Fixed

- Use a dedicated high-numbered local port for ZominAI, correct the Mac runtime
  setup, and explain when another local service occupies the selected port.

## v1.16.0 - 2026-07-21

### Added

- Added ZominAI settings with local-runtime verification, install guidance,
  browser-local connection preferences, and browser-local removal.

## v1.15.0 - 2026-07-21

### Added

- Added a ZominAI entry button to the private Zo Drive header.

## v1.14.0 - 2026-07-21

### Added

- Open each database in its own full-width workspace, with a back action to
  the database overview.

## v1.13.0 - 2026-07-21

### Added

- Made Shared Drives pairing clearer: choose approved Drive folders before
  generating one-time pairing keys, or join folders another owner has shared
  with you.

### Fixed

- Added clearer spacing between the database view switcher and the instances
  workspace.

## v1.12.5 - 2026-07-21

### Fixed

- Count only active Drive files in the sidebar, excluding folders, Trash, and
  internal database, function, and Zo Originals records.

## v1.12.4 - 2026-07-21

### Fixed

- Added a direct logout icon in the authenticated Drive header.

## v1.12.3 - 2026-07-21

### Fixed

- Keep the landing page and documentation public; visitors now see the landing
  page before the private workspace sign-in screen.

## v1.12.2 - 2026-07-21

### Fixed

- Show the Redis key type and value in the in-Drive record preview.

## v1.12.1 - 2026-07-21

### Fixed

- Added an explicit in-app confirmation for permanent database deletion and
  made native-engine records directly viewable in the workspace.
- Keep a database registered until its runtime files have been stopped and
  removed successfully.

## v1.12.0 - 2026-07-21

### Added

- Added native in-Drive run workspaces for every installed database engine,
  alongside scoped HTTPS endpoint and key management.

## v1.11.2 - 2026-07-21

### Changed

- Simplified the Zo Databases catalogue footer.

## v1.11.1 - 2026-07-21

### Fixed

- Added clearer vertical separation between the Zo Databases view tabs and the
  catalogue workspace.

## v1.11.0 - 2026-07-21

### Added

- Completed Zo Cluster Storage with one-time folder pairing, server-held
  peer credentials, recursive two-way file operations, and explicit
  disconnect/revocation.
- Show mounted folder activity in Recent and received cluster folders under
  Shared with me.

## v1.10.1 - 2026-07-21

### Fixed

- Fixed Redis installation on long Zo data-root paths by using a short private
  runtime socket while keeping database data persistent in Drive storage.

## v1.10.0 - 2026-07-21

### Added

- Added a dedicated Function Logs workspace with manual, public, and scheduled
  invocation history, status, duration, output, and runtime logs.
- Added editable Zo Paste links, letting anyone with a public or
  passcode-protected link update a shared notepad without an account.
- Added a Zo Cluster Databases workspace for the upcoming private,
  folder-scoped connection flow between trusted Zo Computers.
- Added real persistent runtimes for SQLite, DuckDB, libSQL, PGlite, LanceDB,
  LevelDB, Redis, and Kuzu, with versioned installation and updates.
- Added database creation and scoped HTTPS execution for every engine.

### Changed

- Count Zo Databases, Zo Functions, and owner-owned Zo Originals data towards Drive storage usage and quota, with dedicated categories in the storage breakdown.
- Keep the table and SQL preview workspace exclusive to SQLite. Other engines
  expose their native command contract through Backend access without a fake
  preview.

## v1.7.3 - 2026-07-21

### Added

- Added a direct crontab.guru helper link beside the UTC cron schedule in Zo Functions.

## v1.7.2 - 2026-07-21

### Changed

- Show the exact public Function POST URL after creation, its pending activation state before saving, and the JSON request-body wrapper for function parameters.

## v1.7.1 - 2026-07-21

### Changed

- Placed Zo Functions and Zo Databases side by side in the landing-page SaaS Killer Features panel.

## v1.7.0 - 2026-07-20

### Added

- Made every catalogued engine installable per Drive and added Redis plus Kuzu. SQLite remains the first engine with an interactive workspace; other installed engines are clearly marked as awaiting their workspace.

## v1.6.0 - 2026-07-21

### Added

- Added Zo Functions: save and run JavaScript or Python handlers, invoke them privately or through a public endpoint, and schedule enabled functions with UTC cron. Added a dedicated Functions story and launch points on the Drive landing page.

## v1.5.0 - 2026-07-20

### Added

- Added an install-first SQLite workflow. Install SQLite from the catalog before opening its workspace, creating a database, importing a file, or running SQL.

## v1.4.3 - 2026-07-20

### Changed

- Restyled the Zo Databases catalog with the same high-contrast hero and workspace composition as Zo Transfer.

## v1.4.2 - 2026-07-20

### Added

- Added Zo Databases to the Zo Drive SaaS Killer Features panel on the landing page.

## v1.4.1 - 2026-07-20

### Fixed

- Restored visible hover and keyboard-focus labels for every collapsed sidebar icon.

## v1.4.0 - 2026-07-20

### Added

- Added an open-source lightweight database catalog, with SQLite available now and planned engines clearly labelled.
- Added validated SQLite import and consistent `.sqlite` export from Database Engines, with an owner-configurable import limit.

### Changed

- Simplified Database Engines into a compact instance rail and focused workspace tabs.

## v1.3.1 - 2026-07-20

### Added

- Added a copyable Zo Drive URL to API Keys for quick CLI and automation setup.

## v1.3.0 - 2026-07-20

### Added

- Added database-scoped API credentials, copyable HTTPS query endpoints, and Node.js connection examples in Database Engines.

## v1.1.5 - 2026-07-20

### Added

- Published an agent-facing `/drive/llms.txt` index covering Zo Drive's
  supported workflows, API surface, authentication, and safety rules.

### Changed

- Moved the GUI and CLI changelogs into dedicated versioned release-history pages, linked from the top-right of the documentation header.
- Updated the browser CLI guide with file checks, server-side moves, and
  Trash-backed removal.

## v1.2.0 - 2026-07-20

### Added

- Added Database Engines in the account menu. Create private SQLite databases, inspect tables and rows, and run SQL from the Zo Drive workspace.

## v1.1.4 - 2026-07-20

### Changed

- Simplified the CLI connection guide to a single interactive setup command.

## v1.1.3 - 2026-07-20

### Added

- Added a Documentation link to the top-right account menu.

## v1.1.2 - 2026-07-20

### Changed

- Expanded Profile & controls to fill the available Drive workspace width.

## v1.1.1 - 2026-07-20

### Changed

- Moved Profile & controls into the full-width Drive workspace and aligned its layout with API Keys.

## v1.1.0 - 2026-07-20

### Added

- Restored Profile & controls in the account menu, including username and password management, drive details, and the protected account-deletion flow.

## v1.0.0 - 2026-07-20

### Removed

- The Profile & controls screen. API Keys is now the sole account-management workspace.

### Added

- Labelled Zo Paste and Zo Transfer as Zo Drive SaaS Killer Features on the landing page.

## v0.3.2 - 2026-07-20

### Changed

- Removed file view controls from API Keys and expanded the page to the full Drive content width.

## v0.3.1 - 2026-07-20

### Changed

- Moved API Keys from the Drive sidebar into the account menu.

## v0.3.0 - 2026-07-20

### Added

- An API Keys page in the Drive sidebar for provisioning and revoking
  per-device access.

### Security

- Device keys are only shown once, stored as hashes, scoped, expiry-aware, and
  revocable without changing the browser password.

## v0.2.3 - 2026-07-20

### Fixed

- The Storage breakdown dialog now stays within the viewport and scrolls its content.

## v0.2.2 - 2026-07-20

### Added

- A visible Landing page link in the documentation header.

## v0.2.1 - 2026-07-20

### Added

- In-product GUI and CLI changelog sections in the documentation, each with
  its own release history and direct sidebar entry.

## v0.2.0 - 2026-07-20

### Added

- Independent GUI release track and visible GUI version in the browser guide.
- GUI release documentation and `gui-v0.2.0` Git tag.

### Changed

- Moved landing-page navigation from the Drive header into the account menu;
  the Zo Drive brand remains a link to the landing page.

## Legacy Unified Releases

### v0.1.2 - 2026-07-20

- Added landing-page navigation to the signed-in Drive.
