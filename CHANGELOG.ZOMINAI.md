# ZominAI Changelog

All notable changes to ZominAI are recorded here. ZominAI follows its own
semantic-versioned release track, independent of the Zo Drive GUI and CLI.

## v1.9.0 - 2026-07-23

### Added

- Added deterministic recursive Drive inventory retrieval for file ranking,
  comparison, listing, and aggregate questions.
- Added exact largest, smallest, newest, oldest, file-count, and total-size
  summaries plus sortable bounded file metadata for more reliable local-model
  answers.

## v1.8.0 - 2026-07-23

### Added

- Added an authenticated one-token warm-up request when chat opens so the
  selected local model is ready before the first user message.
- Added rotating rainbow Pegasus warm-up messages, an explicit **Ready** state,
  and a retryable failure state without saving warm-up output to chat history.

## v1.7.1 - 2026-07-23

### Fixed

- Opened each chat stream immediately and sent periodic keep-alives while the
  local model evaluates its prompt, preventing Zo's HTTP edge from returning a
  false HTTP 503 before the first generated token.
- Forwarded runtime failures inside the open stream so failed turns remain
  visible and retryable instead of ending as empty responses.

### Changed

- Omitted the full read-only Drive tool schema for ordinary conversation while
  preserving it for prompts about files, folders, storage, databases, and the
  Zo Computer.

## v1.7.0 - 2026-07-22

### Added

- Added an authenticated current-time tool so machine date, time, day, and
  timezone questions use the Zo Computer clock instead of being guessed.
- Added end-to-end response cancellation. **Stop generating** aborts browser
  streaming, gateway forwarding, and local model generation while keeping the
  stopped turn retryable.
- Added complete TPS metadata beside elapsed time. Runtime timing is preferred,
  estimates are labelled, and older replies explicitly show when TPS was never
  recorded.

### Changed

- Made recent conversation history authoritative for follow-up questions and
  excluded stopped partial responses from future model context.

## v1.6.0 - 2026-07-22

### Added

- Added bounded browser-local system instructions that customise response style
  without overriding ZominAI's privacy, truthfulness, or read-only tool rules.
- Added accurate tokens-per-second metrics from the local llama runtime beside
  each completed response's elapsed time.
- Made current Zo Drive file counts reliably available through deterministic,
  authenticated read-only tool routing. MCP is not required for these tools.

## v1.5.0 - 2026-07-22

### Added

- Added runtime-backed model discovery and a persistent model selector in the
  chat header.
- Allowed each chat request to use any model confirmed as loaded by the private
  ZominAI runtime, while rejecting unavailable model names.

## v1.4.0 - 2026-07-22

### Added

- Added a **Try again** action to failed replies, including failures already
  saved in browser chat history.
- Retrying replaces the failed response in place, preserves the original prompt,
  and excludes error text from later model context.

## v1.3.0 - 2026-07-22

### Added

- Streamed local model responses through Zo Drive as server-sent events.
- Added live elapsed time while ZominAI is thinking or responding and recorded
  completion time on each assistant reply.

### Fixed

- Preserved `type: "function"` when returning read-only Drive tool results to the
  local model, preventing follow-up requests from failing validation with HTTP 400.
- Omitted redundant tool definitions from storage questions after storage data is
  already available, reducing prompt-evaluation work for the local model.

## v1.2.2 - 2026-07-22

### Fixed

- Added a supervised private Bonsai 8B runtime launcher for Zo Computer and
  streamlined setup around its server-side health check.

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
