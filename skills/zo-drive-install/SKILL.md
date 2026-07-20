---
name: zo-drive-install
description: Install, configure, verify, update, or remove the Zo Drive application. Use when setting up Zo Drive locally or on a Zo server, choosing an external data root, validating the API/CLI/web stack, or handling a request to uninstall while keeping files or permanently deleting all user data.
---
# Zo Drive Install

Use this skill from the Zo Drive repository. Treat [README.md](../../README.md) as the current runnable-command reference and [docs/PLAN.md](../../docs/PLAN.md) as the product-lifecycle specification.

## Choose the operation

Classify the request before changing anything:

- **Install or update:** configure and start Zo Drive.
- **Verify:** test the existing deployment without changing user data.
- **Remove program, keep files:** remove application access while preserving the external data root.
- **Nuclear removal:** permanently remove one user's Zo Drive data after explicit confirmation.

Do not treat removal of a local CLI binary or browser shortcut as account deletion; those actions must not affect stored files.

## Install or update

1. Read the repository README and confirm the target is local development or a Zo Site/Service.
2. Choose an absolute `ZO_DRIVE_DATA_ROOT` outside the Git repository. Reject the repository directory, a source-code subdirectory, the filesystem root, and an unresolved path.
3. Configure a stable `ZO_DRIVE_OWNER_ID`; never use a client-provided ID to select a data directory.
4. Keep the initial Zo deployment private. Do not publish a shared or public service until server-side multi-user authentication is implemented.
5. Install dependencies, run the full test/typecheck/build suite, and start the API and web application using the documented environment variables.
6. Verify the health endpoint and run an upload → list → download/byte-compare → delete sequence using the shared CLI or SDK.
7. Confirm that the final storage usage returns to its prior value and that no test file remains in the data root.

## Data-root invariants

Enforce this layout under the configured root:

```text
v1/users/{owner-or-authenticated-user-id}/files/...
```

- Resolve every requested path relative to the user's `files` directory.
- Reject absolute paths, `..`, backslashes, NUL bytes, and paths that escape the user namespace.
- Keep source code, deployment configuration, and user files in separate directories.
- Do not put credentials in source files, Git, browser bundles, or CLI output.

## Remove program, keep files

1. Show the exact external data-root location that will be retained.
2. Stop and unregister the Zo Drive API/site/service, revoke application sessions or tokens, and remove only application code and nonessential application metadata.
3. Leave `v1/users/{userId}/files/` unchanged.
4. Provide the retained location and a recovery/export path before declaring completion.

Do not promise retained files are accessible after removal unless the user has direct Zo file access or an explicit export/handoff path.

## Nuclear removal

Require recent authentication and an explicit typed confirmation such as `DELETE MY DRIVE`. Do not accept a generic “yes.”

Before deleting:

1. Resolve and display the exact target directory: `v1/users/{userId}/` below the configured data root.
2. Confirm it is not the data-root parent, repository root, a home directory, or another user's namespace.
3. Stop active application access and revoke sessions, tokens, links, and shares.

Then perform an idempotent deletion job that removes only that user directory and associated metadata. Verify completion with a final directory listing. Report that the deletion is permanent and retain only the minimum non-content audit record required by the deployment.

Never recursively delete an unresolved path or a broad storage root. Test the deletion logic with at least two users to prove one account cannot remove another user's data.
