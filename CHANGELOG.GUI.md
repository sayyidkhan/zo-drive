# GUI Changelog

Concise release milestones for the Zo Drive browser experience. Detailed commit
history remains available in Git.

## Unreleased

## v1.46.0 - 2026-08-12

### Added

- Added a scoped remote MCP endpoint for Codex, Claude, Cursor, and other MCP
  clients, backed by the existing Zo Drive device-key model.
- Updated the public landing page to present GUI, CLI, and MCP as three
  interfaces to the same private Drive.

### Security

- Kept MCP read and write authority aligned with device-key scopes and omitted
  permanent deletion from the MCP tool catalogue.

## v1.45.1 - 2026-08-05

### Fixed

- Recorded demo sign-in attempts rejected while Demo Mode is off in the
  super-admin audit trail.

## v1.45.0 - 2026-08-05

### Added

- Upgraded Demo Mode to a writable, isolated 1 GB sandbox with synthetic seed
  data, manual reset, and a super-admin emergency session kill switch.
- Added a persistent super-admin audit trail for sign-ins and account actions.

### Security

- Kept credential features visible to demo visitors while preventing the
  browser and server from listing, creating, or revoking their secrets.
- Stopped Demo Mode from exposing or changing production files and quotas.

## v1.44.0 - 2026-08-05

### Added

- Added a super-admin Demo Mode that enforces a reversible 1 GB account-wide
  storage cap across the browser, API, and CLI.

## v1.43.2 - 2026-07-30

### Fixed

- Moved the public Zo Drive walkthrough to YouTube for more reliable playback.

## v1.43.1 - 2026-07-25

### Fixed

- Served the public Zo Drive walkthrough as a binary MP4 so it plays correctly
  through Zo Computer hosting.

## v1.43.0 - 2026-07-24

### Added

- Added a public architecture page covering the Zo Drive stack, Zo Computer
  ownership model, external CLI access, and Shared Drive cluster flow.

## v1.42.26 - 2026-07-24

### Changed

- Consolidated the GUI release history into durable product milestones and
  removed repetitive visual-tweak release notes.

## v1.42.25 - 2026-07-24

### Changed

- Completed the current Zo Drive product presentation: cobalt landing page,
  animated remote-access terminal, source-code link, and clear six-product
  owner-controlled system story.
- Reworked Zo Shared Drives with nested folder views, a compact share-or-join
  flow, full-width workspace, and a Zo Transfer-style collaboration header.
- Improved the shared transfer flow and restored sidebar tooltips.

## v1.42.0 - 2026-07-23

### Added

- Added the selectable six-product suite, ownership comparison, remote CLI
  access guidance, and product-specific walkthroughs to the landing page.

## v1.38.0 - 2026-07-22

### Added

- Added Shared Drive offline cache, folder lifecycle controls, User access
  roles, browser themes, and a Google Drive-inspired appearance.
- Added the in-product ZominAI workspace, read-only Drive tools, streaming
  chat, retry, model selection, and runtime status controls.

## v1.10.0 - 2026-07-21

### Added

- Added persistent Zo Database runtimes and workspaces, scoped HTTPS access,
  Zo Functions, Zo Paste links, and Shared Drive pairing and permissions.

## v0.3.0 - 2026-07-20

### Added

- Added the API Keys workspace for scoped, revocable, expiry-aware device
  credentials.

## v0.1.0 - 2026-07-20

### Added

- Established the public landing page, private Drive workspace, and initial
  browser documentation.
