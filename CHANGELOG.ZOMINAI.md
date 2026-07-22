# ZominAI Changelog

All notable changes to ZominAI are recorded here. ZominAI follows its own
semantic-versioned release track, independent of the Zo Drive GUI and CLI.

## v1.2.1 - 2026-07-22

### Fixed

- Retrieve storage usage before asking the local runtime to respond, avoiding
  an unsupported forced-function request.

### Added

- Added an on-demand connection refresh control in the ZominAI chat header.

## v1.2.0 - 2026-07-22

### Added

- Added a read-only storage-usage tool for machine capacity, free space, and
  Zo Drive quota questions.

## v1.1.0 - 2026-07-22

### Changed

- Made the 1-bit Bonsai 8B runtime on the Zo Computer the default for all
  signed-in web and mobile clients.
- Replaced browser-local inference routing with an authenticated Zo Drive
  gateway that keeps the model port private.

## v1.0.1 - 2026-07-22

### Changed

- Moved ZominAI into its own documentation product selector, separate from Zo
  Drive's GUI and CLI modes.

## v1.0.0 - 2026-07-22

### Added

- Established ZominAI as an independently versioned local-AI product.
- Added dedicated public documentation and an in-product changelog route.
- Documented the local Bonsai runtime, authenticated read-only Drive tools,
  live connection status, browser-local chat history, and context compaction.
