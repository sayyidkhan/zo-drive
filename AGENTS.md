# Zo Drive Release Guide

## Release tracks

Zo Drive is one repository with independent user-facing release tracks:

- GUI: `apps/web`, package version `@zo-drive/web`, Git tag `gui-vX.Y.Z`.
- CLI: `apps/cli`, package version `@zo-drive/cli`, Git tag `cli-vX.Y.Z`.
- ZominAI: local-AI product version in `apps/web/src/drive-app.tsx`, Git tag
  `zominai-vX.Y.Z`.
- API, SDK, and types are compatibility dependencies. Version them when their
  public contract changes, but do not use their version as a GUI or CLI release
  number.

Keep the GUI, CLI, and ZominAI versions independent. A ZominAI-only release
must not require local CLI users to update. A GUI integration change that makes
ZominAI visible or changes its browser behaviour requires a GUI release too.

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
4. Add an entry to `CHANGELOG.GUI.md`, `CHANGELOG.CLI.md`,
   `CHANGELOG.ZOMINAI.md`, or the relevant combination before committing.
5. Run `pnpm test`, `pnpm typecheck`, and `pnpm build`.
6. Commit the verified change, push `main`, and create an annotated tag for
   each affected track: `gui-vX.Y.Z`, `cli-vX.Y.Z`, and/or `zominai-vX.Y.Z`.
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
- The public documentation pages must show the active GUI, CLI, and ZominAI
  versions.

## Changelog rules

- Keep `CHANGELOG.GUI.md`, `CHANGELOG.CLI.md`, and `CHANGELOG.ZOMINAI.md`
  concise and user-facing.
- Add entries under the relevant `Unreleased` heading while work is in
  progress.
- If one change affects both surfaces, record it in both changelogs and
  release each track independently.
- On release, move those entries into the relevant tagged section with the
  release date.
- Use `Added`, `Changed`, `Fixed`, `Deprecated`, `Removed`, and `Security`
  headings where useful.
