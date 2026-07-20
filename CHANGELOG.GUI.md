# GUI Changelog

All notable changes to the Zo Drive browser experience are recorded here.

## Unreleased

## v1.1.5 - 2026-07-20

### Added

- Published an agent-facing `/drive/llms.txt` index covering Zo Drive's
  supported workflows, API surface, authentication, and safety rules.

### Changed

- Moved the GUI and CLI changelogs into dedicated versioned release-history pages, linked from the top-right of the documentation header.
- Updated the browser CLI guide with file checks, server-side moves, and
  Trash-backed removal.

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
