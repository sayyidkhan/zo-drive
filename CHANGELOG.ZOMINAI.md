# ZominAI Changelog

Concise release milestones for the private local-AI product. ZominAI is
versioned independently from the Zo Drive GUI and CLI; detailed commit history
remains available in Git.

## Unreleased

No user-facing changes.

## v1.10.0 - 2026-07-24

### Added

- Added owner-only managed installation and removal for the selected Bonsai
  model version, with the private runtime stored outside Drive quota.

## v1.9.0 - 2026-07-23

### Added

- Added deterministic recursive Drive inventory summaries for reliable file
  ranking, listing, comparison, count, and size answers.
- Added model warm-up, an explicit ready state, and retryable warm-up failures
  before the first chat message.

## v1.7.0 - 2026-07-22

### Added

- Added authenticated time and Drive tools, streaming response cancellation,
  reliable follow-up context, and tokens-per-second response metadata.

### Fixed

- Kept slow local-model streams alive through the Zo HTTP edge and surfaced
  runtime failures as retryable chat responses.

## v1.5.0 - 2026-07-22

### Added

- Added runtime-backed model selection, bounded custom system instructions,
  and local storage and file-count answers through authenticated read-only
  tools.

## v1.3.0 - 2026-07-22

### Added

- Added server-sent response streaming, elapsed-time feedback, and retry for
  failed replies.

## v1.0.0 - 2026-07-22

### Added

- Established ZominAI as an independently versioned local-AI product with a
  private Bonsai runtime, browser-local chat history, and read-only Drive
  context.
