# CLI Changelog

All notable changes to the `zo-drive` command-line tool are recorded here.

## Unreleased

## v1.2.2 - 2026-07-22

### Changed

- Expanded the CLI guide with file operations, dry runs, health and capacity
  checks, script automation, and the boundary with GUI-managed product
  workspaces.

## v1.2.1 - 2026-07-21

### Changed

- `zo-drive logo` now prints the Pegasus-over-cloud artwork with the large Zo
  Drive ASCII wordmark underneath, while normal help keeps the compact logo.

## v1.2.0 - 2026-07-20

### Added

- `zo-drive cp` copies a Drive file server-side, with an explicit `--force`
  option for replacing an existing destination.
- `zo-drive ls` now supports familiar Drive-compatible flags including `-l`,
  `-a`, `-R`, `-r`, `-S`, `-t`, `-F`, `-p`, `-d`, and `--sort`.
- Bash-style `zo-drive -lrt` shorthand now maps to `zo-drive ls -lrt`.
- Uploads of 1 MB or more now show a live terminal progress bar.
- `zo-drive upload --dry-run` and `zo-drive download --dry-run` validate an
  upload or download without transferring or writing file data.
- `zo-drive exists` checks whether an exact file key is present and returns a
  scriptable success or failure exit code.
- `zo-drive stat` prints file metadata, with `--json` for structured output.
- `zo-drive health` reports API latency, authenticated Drive access, storage,
  and filesystem capacity.
- `zo-drive mv` moves a file to an exact destination key without downloading
  and uploading it again.
- `zo-drive rm` moves a file to Trash using familiar terminal syntax.
- `zo-drive status` confirms connectivity and shows storage usage.
- `zo-drive logo` prints the Zo Drive terminal logo without requiring a Drive
  configuration.

### Changed

- Updated the terminal logo to a concise Zo Drive ASCII design selected for
  CLI readability.
- CLI help now opens with the Zo Drive logo and lists the supported help and
  version aliases.
- `zo-drive configure` now explains how to create a device key and identify the
  public Drive URL before prompting for either value.
- CLI authentication failures now explain how to create a replacement device
  key and reconnect with `zo-drive configure`.
- Successful CLI configuration now tells users how to verify the device key
  with `zo-drive status` or `zo-drive health`.
- Storage and latency output now uses readable units such as MB and seconds.
- Dry-run output now uses simpler language and clearly states that no file was
  uploaded or downloaded.
- Upload dry runs now state that a missing destination folder will be created.
- Documented CLI file checks, moves, and safe removal in the README and browser
  documentation.

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
