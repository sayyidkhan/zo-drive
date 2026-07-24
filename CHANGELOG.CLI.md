# CLI Changelog

Concise release milestones for the `zo-drive` command-line tool. Detailed
commit history remains available in Git.

## Unreleased

### Fixed

- `usage`, `status`, and `health` report current Drive files while retaining
  Trash and internal Zo feature storage in quota totals.

## v1.3.0 - 2026-07-22

### Added

- Added terminal command families for Zo Paste, Zo Transfer, Zo Shared Drives,
  Zo Databases, and Zo Functions, with CRUD operations and JSON output for
  automation.

## v1.2.0 - 2026-07-20

### Added

- Added familiar Drive file operations, server-side copy and move,
  Trash-backed removal, dry runs, progress reporting, file inspection, and
  health and capacity checks.

## v1.1.0 - 2026-07-20

### Changed

- Added secure interactive configuration for the Zo Drive URL and a scoped
  device API key, stored with owner-only local permissions.

## v1.0.0 - 2026-07-20

### Security

- Replaced password-based terminal login with scoped, revocable per-device API
  keys.

## v0.1.0 - 2026-07-20

### Added

- Established the independent CLI release track, `zo-drive --version`, and
  installation, connection, and update guidance.
