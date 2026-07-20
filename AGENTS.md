# Zo Drive Release Guide

## Release tracks

Zo Drive is one repository with independent user-facing release tracks:

- GUI: `apps/web`, package version `@zo-drive/web`, Git tag `gui-vX.Y.Z`.
- CLI: `apps/cli`, package version `@zo-drive/cli`, Git tag `cli-vX.Y.Z`.
- API, SDK, and types are compatibility dependencies. Version them when their
  public contract changes, but do not use their version as a GUI or CLI release
  number.

Keep the GUI and CLI versions independent. A GUI-only release must not require
local CLI users to update, and a CLI-only release must not imply a browser UI
change.

## Choosing the increment

Use semantic versioning within the affected release track.

| Change | Increment | Examples |
| --- | --- | --- |
| Backwards-compatible fix or published-doc change | Patch | visual fix, corrected copy, safer validation, CLI bug fix |
| Backwards-compatible capability | Minor | GUI feature, CLI command or option, new supported workflow |
| Breaking behaviour or contract | Major | removed or renamed CLI command, changed auth/config requirement, incompatible API response |

If a change affects both surfaces, evaluate each track separately. For example,
an API change may require a CLI major increment while the GUI only receives a
patch, or no GUI release at all.

## Release workflow

1. Identify which user-facing surface changed: GUI, CLI, both, or neither.
2. Select the smallest justified semantic version increment for each affected
   track.
3. Update the matching package version and any displayed version constant.
4. Add an entry to `CHANGELOG.GUI.md`, `CHANGELOG.CLI.md`, or both before
   committing.
5. Run `pnpm test`, `pnpm typecheck`, and `pnpm build`.
6. Commit the verified change, push `main`, and create an annotated tag for
   each affected track: `gui-vX.Y.Z` and/or `cli-vX.Y.Z`.
7. Restart the Zo Drive service for a GUI/API deployment. A CLI-only release
   still needs its tag pushed but does not require a service restart.

Do not create a GUI or CLI version for internal refactors, tests, CI changes,
or repository-only documentation unless the change is published in that
surface's user-facing documentation.

## Compatibility rules

- Preserve backwards compatibility in patch and minor releases.
- Document an upgrade path before making a major release.
- When the API changes, test the currently released CLI against it before
  tagging either track.
- `zo-drive --version` must report the CLI package version.
- The GUI documentation page must show the active GUI and CLI versions.

## Changelog rules

- Keep `CHANGELOG.GUI.md` and `CHANGELOG.CLI.md` concise and user-facing.
- Add entries under the relevant `Unreleased` heading while work is in
  progress.
- If one change affects both surfaces, record it in both changelogs and
  release each track independently.
- On release, move those entries into the relevant tagged section with the
  release date.
- Use `Added`, `Changed`, `Fixed`, `Deprecated`, `Removed`, and `Security`
  headings where useful.
