# CLI Changelog

All notable changes to the `zo-drive` command-line tool are recorded here.

## Unreleased

## v1.1.1 - 2026-07-20

### Fixed

- Global `zo-drive` commands now run correctly when the CLI is installed with
  `npm link`.

### Changed

- Clarified that npm linking is a developer workflow and documented the
  planned single-package global npm installation experience.

## v1.1.0 - 2026-07-20

### Added

- `zo-drive configure` now asks for the Zo Drive URL and device API key, then
  saves the connection locally.

### Security

- API key input is hidden during interactive setup, avoiding shell history and
  terminal output. Environment variables remain supported for automation.

## v1.0.0 - 2026-07-20

### Changed

- Replaced password-based terminal login with scoped, revocable device API
  keys.

### Security

- `zo-drive configure` stores each machine's connection at
  `~/.config/zo-drive/config.json` with owner-only permissions.

## v0.1.3 - 2026-07-20

### Added

- Independent CLI release track and `cli-v0.1.3` Git tag.
- `zo-drive --version`, available before cloud configuration.

### Changed

- CLI installation, local-to-Zo connection, and update documentation now use
  CLI-specific release tags.

## Legacy Unified Releases

### v0.1.1 - 2026-07-20

- Documented local computer connections to Zo Drive.

### v0.1.0 - 2026-07-20

- Documented CLI installation, cloud connection, and update workflows.
