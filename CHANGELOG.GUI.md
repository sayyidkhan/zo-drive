# GUI Changelog

All notable changes to the Zo Drive browser experience are recorded here.

## v1.41.1 - 2026-07-23

### Changed

- Replaced the landing-page SaaS comparison with the six-subscription versus
  one-private-suite story, including the US$104+ published-price comparison.

## v1.41.0 - 2026-07-23

### Added

- Added a separate Neumorphic landing-page concept at `/landing-page-2` for
  testing the six-product Zo Drive story without replacing the current landing
  page.

## v1.40.1 - 2026-07-23

### Changed

- Reframed the landing-page conclusion as a direct two-column comparison of
  six fragmented SaaS products versus the six integrated Zo Drive features.

## v1.40.0 - 2026-07-23

### Added

- Made ZominAI retrieve the current recursive Drive inventory before answering
  file ranking, comparison, listing, and aggregate questions.
- Added computed largest, smallest, newest, oldest, file-count, and total-size
  summaries so the local model answers from exact metadata instead of guessing.

## v1.39.2 - 2026-07-23

### Fixed

- Corrected the Zo Transfer comparison to show WeTransfer Ultimate's current
  US$25 monthly price and the matching monthly saving.

## v1.39.1 - 2026-07-23

### Changed

- Enlarged the ZominAI Pegasus in the empty chat state so the product identity
  is more prominent when a new conversation opens.

## v1.39.0 - 2026-07-23

### Added

- Opened the ZominAI drawer immediately and displayed a rotating Pegasus
  warm-up bubble while the selected local model becomes ready.
- Locked the composer until the real model warm-up succeeds, with an explicit
  **Ready** state and a retry action when warm-up fails.

## v1.38.3 - 2026-07-23

### Fixed

- Opening a Shared Drive file from Recent or Shared with me now previews that
  file directly instead of sending the user to the Shared Drives management
  screen.

### Changed

- Applied Google Drive's red, yellow, green, and blue palette to the primary
  controls, selected navigation, and workspace rail instead of using it only
  as a decorative preview.
- Reintroduced **Google Drive** as a dark, four-colour Google theme inspired
  by Gemini's red, yellow, green, and blue visual language.
- Replaced the landing-page SaaS card grid with individual, animated workflow
  walkthroughs for Zo Paste, Zo Transfer, Zo Shared Drives, Zo Databases, and
  ZominAI, alongside the existing Zo Functions story.

## v1.38.1 - 2026-07-22

### Changed

- Replaced the near-duplicate Google Drive theme with **ZominAI Drive**, using
  ZominAI's distinct cyan palette across the workspace.

## v1.38.0 - 2026-07-22

### Added

- Added a browser-local **Google Drive** theme with familiar white surfaces,
  Google-blue actions, and pale-blue selection states.

## v1.37.0 - 2026-07-22

### Added

- Added a private, bounded LRU cache for connected Shared Drive folders.
  Previously opened remote files and the last folder tree remain available when
  the source Zo is offline, without replicating them into My Drive or using the
  recipient's Drive quota.
- Added an offline cached-state indicator in the mounted-folder view.
- Added authenticated Zo Computer clock answers and stronger follow-up context
  to ZominAI.
- Added a **Stop generating** control that cancels browser streaming, gateway
  forwarding, and local model generation while keeping the turn retryable.
- Added complete TPS metadata beside elapsed time, including labelled estimates
  when runtime timings are omitted and an unavailable state for older history.

## v1.36.0 - 2026-07-22

### Added

- Added the current Zo Drive URL and a one-click copy action to each newly
  generated shared-folder pairing-key delivery panel.

## v1.35.0 - 2026-07-22

### Added

- Added folder rename and Trash controls. Renaming preserves nested files,
  favourites, native file types, and shared-file links; deleted folders remain
  recoverable from Trash for 30 days.

## v1.34.0 - 2026-07-22

### Added

- Added one public demo account whose username and password are shown on the
  sign-in page, with one-click credential filling.
- Added explicit User access warnings and server-enforced regular, read-only
  restrictions for demo accounts.

## v1.33.0 - 2026-07-22

### Added

- Added a browser-local ZominAI system-instructions editor with a 2,000-character
  limit, visible usage counter, and one-click default restoration.
- Added runtime-reported token generation speed beside each completed response's
  elapsed time.

### Fixed

- Routed file-count questions through the authenticated storage tool so ZominAI
  can answer with the current Zo Drive count and clearly state its scope.

## v1.32.0 - 2026-07-22

### Added

- Replaced the ZominAI chat subtitle with a model dropdown populated from the
  models currently loaded by the private runtime.
- Saved the selected model in this browser and applied it to subsequent messages.

## v1.31.0 - 2026-07-22

### Added

- Added one-click retry for failed ZominAI replies. Retrying resends the original
  prompt and replaces the error instead of duplicating the conversation.

### Fixed

- Constrained the ZominAI conversation column so messages scroll independently
  while the header, context meter, and composer remain visible.
- Made the main search field filter Zo Transfer, Functions, Databases, and
  Shared Drives, including files across every connected Shared Drive.
- Limited the Drive Upload button to Recent, My Drive, Starred, Shared with
  others, and Trash.

## v1.30.0 - 2026-07-22

### Added

- Streamed ZominAI responses into the chat as they are generated and added live
  elapsed time plus a completion time on each reply.

### Fixed

- Preserved the required function-call type in Drive tool follow-ups, preventing
  the HTTP 400 failure shown after Bonsai selected a read-only tool.
- Removed redundant tool definitions from storage questions after the current
  storage data has already been retrieved, reducing local prompt-evaluation time.

## v1.29.2 - 2026-07-22

### Fixed

- Simplified ZominAI setup around the managed Zo Computer runtime and removed
  browser WebGPU and disk-space checks that do not affect server inference.

## v1.29.1 - 2026-07-22

### Fixed

- Added a Refresh connection control to the ZominAI drawer and corrected the
  storage-question request shape so the local runtime can answer it.

## v1.29.0 - 2026-07-22

### Added

- Added a ZominAI storage-usage tool so chat can answer machine capacity, free
  space, and Zo Drive allocation questions from the current account.

## v1.28.1 - 2026-07-22

### Fixed

- Kept the ZominAI chat transcript and composer aligned to the full drawer
  height, preventing the empty chat view from leaving unused space below the
  composer.

## v1.28.0 - 2026-07-22

### Added

- Added Zo's built-in Light, Dark, and System theme choices alongside the
  existing Zo Drive and Zo Computer appearances.

## v1.27.0 - 2026-07-22

### Added

- Added a browser-local Theme page with the existing Zo Drive appearance and a
  Zo Computer brand theme.

## v1.26.2 - 2026-07-22

### Fixed

- Restricted the User access menu and workspace to super users only.

## v1.26.1 - 2026-07-22

### Fixed

- Let read-only account members use explicitly read-only database queries and
  runtime requests without granting them write access.

## v1.26.0 - 2026-07-22

### Added

- Added account-level User access management with individual sign-ins, read-only
  and read & write Drive permissions, and super-user access administration.
- Protected the original account owner from role changes, access removal, and
  deletion while preserving shared access to the same Drive data for members.

## v1.25.0 - 2026-07-22

### Added

- Route authenticated ZominAI web and mobile chats through Zo Drive to the
  private Bonsai 8B runtime on the Zo Computer.

### Fixed

- Show only current Drive files in the headline count; Trash and internal Zo
  feature records remain visible in the storage breakdown and quota total.

## v1.24.6 - 2026-07-22

### Changed

- Moved Zo Drive release history out of the documentation flow into a dedicated
  Releases route, while keeping legacy changelog links working.

## v1.24.5 - 2026-07-22

### Changed

- Updated the public CLI guide for Zo Originals terminal CRUD support. ZominAI
  remains a separate browser product and is not included in the CLI.

## v1.24.4 - 2026-07-22

### Changed

- Grouped the GUI documentation list menu into Zo Drive, Zo Originals, and
  More from Zo.

## v1.24.3 - 2026-07-22

### Changed

- Expanded the GUI guide to cover file organisation, Zo Paste, Zo Transfer, Zo
  Shared Drives, Zo Databases, Zo Functions, and ZominAI.

## v1.24.2 - 2026-07-22

### Changed

- Separated documentation products from Zo Drive modes: ZominAI is now a
  product, while GUI and CLI remain the two Zo Drive modes.

## v1.24.1 - 2026-07-22

### Added

- Added ZominAI's dedicated public documentation and changelog routes, with an
  independent ZominAI version and release history.

## v1.24.0 - 2026-07-22

### Added

- Made ZominAI chat history an overlay so it no longer takes permanent space
  from the conversation.
- Added automatic chat titles, manual title rename and deletion, and
  date-and-time timestamps for every conversation.
- Added estimated active-context usage and local context compaction, preserving
  recent messages while reducing the context sent to the local runtime.

## v1.23.9 - 2026-07-22

### Fixed

- Added a live ZominAI connection indicator in the chat header, with clear
  green, amber, and red states based on the local Bonsai runtime.

## v1.23.8 - 2026-07-22

### Fixed

- Kept file actions visible in Drive, Starred, Recent, and Zo Paste lists.
- Moved Trash restore and permanent-delete controls into a dedicated,
  right-aligned Actions column.

## v1.23.7 - 2026-07-22

### Changed

- Removed the duplicate View your databases action from the database catalogue hero.

## v1.23.6 - 2026-07-22

### Changed

- Moved Function Editor save and delete controls to a right-aligned footer.

## v1.23.5 - 2026-07-22

### Changed

- Removed the duplicate Zo Paste creation button from its hero panel.

## v1.23.4 - 2026-07-22

### Changed

- Credited Synology NAS Drive as the inspiration for Zo Shared Drives.

## v1.23.3 - 2026-07-22

### Changed

- Added a clear ZominAI pronunciation cue and credited Google Gemini as the
  inspiration for its local-AI workspace.
- Reorganised Zo Functions into dedicated Editor, Function runs, and Logs
  tabs, so source editing, test execution, and invocation detail stay separate.

### Fixed

- Made desktop ZominAI resizing track the pointer smoothly and refined the chat
  boundary to a single, app-consistent divider.

## v1.23.2 - 2026-07-22

### Changed

- Cleaned up Zo Databases catalogue actions with aligned full-width primary
  controls and compact update buttons.

## v1.23.1 - 2026-07-22

### Fixed

- Made the desktop ZominAI drawer boundary and resize rail clearly visible, so
  it reads as a distinct workspace beside Drive content.

## v1.23.0 - 2026-07-22

### Added

- Connected ZominAI to the signed-in Drive through local, read-only tools.
  ZominAI can browse and search Drive files, read supported text and Zo-native
  content, inspect database schemas, and run read-only database queries. Tool
  results are sent only to the local Bonsai runtime.

## v1.22.0 - 2026-07-22

### Changed

- Removed the duplicate full-page **Talk to ZominAI** screen. ZominAI chat now
  opens from its drawer, while the full workspace focuses on setup and runtime
  management.
- Made the desktop ZominAI drawer resizable from its left edge. The chosen
  width is remembered in the browser.

## v1.21.6 - 2026-07-22

### Fixed

- Kept Upload directly beside the list and grid controls in the dashboard
  whenever ZominAI chat is open.

## v1.21.5 - 2026-07-22

### Fixed

- Removed the forced desktop sidebar scrollbar and tightened navigation spacing.
  The storage summary stays anchored at the bottom when room allows, and steps
  aside on shorter screens so navigation remains fully visible.

## v1.21.4 - 2026-07-22

### Fixed

- Kept the Drive workspace inside the browser viewport. The file list,
  navigation, and ZominAI conversation now scroll independently when needed.
- Moved Upload into the dashboard controls while ZominAI is open, preventing it
  from floating over the file list or chat.

## v1.21.3 - 2026-07-22

### Changed

- Reworked the ZominAI drawer into a cleaner full-width chat. Conversation
  history now opens only from its dedicated History control.
- Kept the fixed Upload action aligned with the Drive workspace while the
  ZominAI drawer is open on desktop.

## v1.21.2 - 2026-07-21

### Fixed

- Connected Shared Drive folders now refresh into Recent and Shared with me,
  with the Drive owner and effective Read only or Read & write access shown on
  each shared file.

## v1.21.1 - 2026-07-21

### Changed

- Made the ZominAI panel a true desktop drawer that expands the layout and
  moves Drive content left, with a motion-safe open and close transition.
- Replaced generic robot imagery in ZominAI chat with the ZominAI Pegasus.

## v1.21.0 - 2026-07-21

### Added

- Moved ZominAI into a right-side chat drawer with browser-local history and
  a New chat action. The header button opens or closes the drawer when the
  local runtime is ready, and opens installation when it is not.

## v1.20.1 - 2026-07-21

### Fixed

- Reworked shared-link cards so file details and actions stay clear and within
  the phone viewport.

## v1.20.0 - 2026-07-21

### Added

- Added a private Talk to ZominAI workspace that connects only to the user's
  local Bonsai runtime. Conversations stay in the open browser tab and Drive
  files are not automatically sent or exposed.

### Fixed

- Kept file-list rows within the phone viewport while retaining file actions.

## v1.19.2 - 2026-07-21

### Fixed

- Made each Recent filter use half of the available filter bar width.

## v1.19.1 - 2026-07-21

### Fixed

- Placed advanced search settings beside the search field on phone and desktop
  layouts.

## v1.19.0 - 2026-07-21

### Added

- Added a persistent Shared Drives list of exposed folders. Owners can cancel
  unused pairing keys and revoke active recipients from the same view.

### Changed

- Moved the PrismML, Bonsai model and licence, and runtime documentation links
  into the top ZominAI card so they are available throughout ZominAI.

## v1.18.2 - 2026-07-21

### Fixed

- Kept phone header controls together on the right: ZominAI sits beside search
  settings, with the overflow menu beside sign out.

## v1.18.1 - 2026-07-21

### Fixed

- Reworked the private Drive workspace for phone screens with a slide-out
  navigation drawer, a dedicated search row, compact spacing, and touch-visible
  file actions.

## v1.18.0 - 2026-07-21

### Added

- Shared Drive folder invitations now assign Viewer or Editor access. Owners can
  label, change, and revoke each accepted pairing; Viewer restrictions are
  enforced by the owner Drive API.

## v1.17.0 - 2026-07-21

### Added

- Show persistent local ZominAI model download progress and explain that the
  Mac runtime continues when the browser page is closed.

## v1.16.2 - 2026-07-21

### Added

- Link the ZominAI setup to PrismML, the Bonsai model and licence, and the
  local runtime documentation; clarify that models and inference stay local.

## v1.16.1 - 2026-07-21

### Fixed

- Use a dedicated high-numbered local port for ZominAI, correct the Mac runtime
  setup, and explain when another local service occupies the selected port.

## v1.16.0 - 2026-07-21

### Added

- Added ZominAI settings with local-runtime verification, install guidance,
  browser-local connection preferences, and browser-local removal.

## v1.15.0 - 2026-07-21

### Added

- Added a ZominAI entry button to the private Zo Drive header.

## v1.14.0 - 2026-07-21

### Added

- Open each database in its own full-width workspace, with a back action to
  the database overview.

## v1.13.0 - 2026-07-21

### Added

- Made Shared Drives pairing clearer: choose approved Drive folders before
  generating one-time pairing keys, or join folders another owner has shared
  with you.

### Fixed

- Added clearer spacing between the database view switcher and the instances
  workspace.

## v1.12.5 - 2026-07-21

### Fixed

- Count only active Drive files in the sidebar, excluding folders, Trash, and
  internal database, function, and Zo Originals records.

## v1.12.4 - 2026-07-21

### Fixed

- Added a direct logout icon in the authenticated Drive header.

## v1.12.3 - 2026-07-21

### Fixed

- Keep the landing page and documentation public; visitors now see the landing
  page before the private workspace sign-in screen.

## v1.12.2 - 2026-07-21

### Fixed

- Show the Redis key type and value in the in-Drive record preview.

## v1.12.1 - 2026-07-21

### Fixed

- Added an explicit in-app confirmation for permanent database deletion and
  made native-engine records directly viewable in the workspace.
- Keep a database registered until its runtime files have been stopped and
  removed successfully.

## v1.12.0 - 2026-07-21

### Added

- Added native in-Drive run workspaces for every installed database engine,
  alongside scoped HTTPS endpoint and key management.

## v1.11.2 - 2026-07-21

### Changed

- Simplified the Zo Databases catalogue footer.

## v1.11.1 - 2026-07-21

### Fixed

- Added clearer vertical separation between the Zo Databases view tabs and the
  catalogue workspace.

## v1.11.0 - 2026-07-21

### Added

- Completed Zo Cluster Storage with one-time folder pairing, server-held
  peer credentials, recursive two-way file operations, and explicit
  disconnect/revocation.
- Show mounted folder activity in Recent and received cluster folders under
  Shared with me.

## v1.10.1 - 2026-07-21

### Fixed

- Fixed Redis installation on long Zo data-root paths by using a short private
  runtime socket while keeping database data persistent in Drive storage.

## v1.10.0 - 2026-07-21

### Added

- Added a dedicated Function Logs workspace with manual, public, and scheduled
  invocation history, status, duration, output, and runtime logs.
- Added editable Zo Paste links, letting anyone with a public or
  passcode-protected link update a shared notepad without an account.
- Added a Zo Cluster Databases workspace for the upcoming private,
  folder-scoped connection flow between trusted Zo Computers.
- Added real persistent runtimes for SQLite, DuckDB, libSQL, PGlite, LanceDB,
  LevelDB, Redis, and Kuzu, with versioned installation and updates.
- Added database creation and scoped HTTPS execution for every engine.

### Changed

- Count Zo Databases, Zo Functions, and owner-owned Zo Originals data towards Drive storage usage and quota, with dedicated categories in the storage breakdown.
- Keep the table and SQL preview workspace exclusive to SQLite. Other engines
  expose their native command contract through Backend access without a fake
  preview.

## v1.7.3 - 2026-07-21

### Added

- Added a direct crontab.guru helper link beside the UTC cron schedule in Zo Functions.

## v1.7.2 - 2026-07-21

### Changed

- Show the exact public Function POST URL after creation, its pending activation state before saving, and the JSON request-body wrapper for function parameters.

## v1.7.1 - 2026-07-21

### Changed

- Placed Zo Functions and Zo Databases side by side in the landing-page SaaS Killer Features panel.

## v1.7.0 - 2026-07-20

### Added

- Made every catalogued engine installable per Drive and added Redis plus Kuzu. SQLite remains the first engine with an interactive workspace; other installed engines are clearly marked as awaiting their workspace.

## v1.6.0 - 2026-07-21

### Added

- Added Zo Functions: save and run JavaScript or Python handlers, invoke them privately or through a public endpoint, and schedule enabled functions with UTC cron. Added a dedicated Functions story and launch points on the Drive landing page.

## v1.5.0 - 2026-07-20

### Added

- Added an install-first SQLite workflow. Install SQLite from the catalog before opening its workspace, creating a database, importing a file, or running SQL.

## v1.4.3 - 2026-07-20

### Changed

- Restyled the Zo Databases catalog with the same high-contrast hero and workspace composition as Zo Transfer.

## v1.4.2 - 2026-07-20

### Added

- Added Zo Databases to the Zo Drive SaaS Killer Features panel on the landing page.

## v1.4.1 - 2026-07-20

### Fixed

- Restored visible hover and keyboard-focus labels for every collapsed sidebar icon.

## v1.4.0 - 2026-07-20

### Added

- Added an open-source lightweight database catalog, with SQLite available now and planned engines clearly labelled.
- Added validated SQLite import and consistent `.sqlite` export from Database Engines, with an owner-configurable import limit.

### Changed

- Simplified Database Engines into a compact instance rail and focused workspace tabs.

## v1.3.1 - 2026-07-20

### Added

- Added a copyable Zo Drive URL to API Keys for quick CLI and automation setup.

## v1.3.0 - 2026-07-20

### Added

- Added database-scoped API credentials, copyable HTTPS query endpoints, and Node.js connection examples in Database Engines.

## v1.1.5 - 2026-07-20

### Added

- Published an agent-facing `/drive/llms.txt` index covering Zo Drive's
  supported workflows, API surface, authentication, and safety rules.

### Changed

- Moved the GUI and CLI changelogs into dedicated versioned release-history pages, linked from the top-right of the documentation header.
- Updated the browser CLI guide with file checks, server-side moves, and
  Trash-backed removal.

## v1.2.0 - 2026-07-20

### Added

- Added Database Engines in the account menu. Create private SQLite databases, inspect tables and rows, and run SQL from the Zo Drive workspace.

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
