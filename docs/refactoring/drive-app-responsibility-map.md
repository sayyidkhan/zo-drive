# `drive-app.tsx` Responsibility Map

Status: living map, updated after the Functions and upload/storage extractions on 2026-07-24.

## Entry points and URL ownership

`DriveApp` is the public React entry point. `apps/web/src/main.tsx` renders it. It creates the React Query client and default `ZoDriveClient`, then selects a screen from pathname and query parameters.

| URL or state | Owner | Behaviour |
| --- | --- | --- |
| `/landing-page-2` | `LandingPageTwo` | Alternate public landing page. |
| `/landing-page-3` | `LandingPageThree` | Alternate public landing page. |
| `?share=<id>` | `SharedFilePage` | Public shared-file or shared-paste access. |
| `?form=<id>` | `PublicFormPage` | Public form rendering and submission. |
| `?docs=1` | `DocsPage` | GUI, CLI, or ZominAI documentation. |
| `?releases=1` | `DocsPage` | GUI, CLI, or ZominAI release history. |
| `?login=1` | `DriveGate` | Authentication gate without the public fallback. |
| `?app=1` | `DriveGate` | Authenticated Drive workspace with the public landing fallback. |
| `?section=<name>` | `DriveScreen` | Selects the authenticated product area. |
| `?database=<id>&databasePanel=<name>&databaseView=<name>&table=<name>` | `Databases` | Persists database workspace navigation. |

## Responsibility and dependency map

Line ranges describe the pre-extraction baseline and are navigation aids, not contracts.

| Section | Components and responsibility | State, effects, and services | Depends on | Extraction risk |
| --- | --- | --- | --- | --- |
| Application composition, lines 240-334 | URL helpers, `DriveApp`, client and provider composition | Query client; pathname and query inspection | React Query, SDK client, public pages, auth gate | High: every route converges here, but it should eventually become composition only. |
| Public-site shell, lines 335-668 | `DriveMark`, theme overrides, landing sections, product showcases and closing calls to action | Particle animation effect; no API calls | Landing-page modules, URL helpers, release constants, static assets | Medium: mostly presentational, but dense shared markup and asset/URL globals remain. |
| Documentation and changelogs, lines 669-768 | Product/mode switches, guides, changelogs, ZominAI docs, `CodeBlock` | No product state or API calls | Release history, URL helpers, static runtime command | Low to medium: pages are self-contained but share branding and navigation. |
| Authentication gate, lines 769-839 | `DriveGate`, loading/error states, `AuthScreen` | Auth query, login/register/logout mutations | `AuthClient`, React Query, `DriveScreen` | Medium: session cache invalidation and fallback behaviour must remain exact. |
| Account and access, lines 841-960 | Profile/password/account deletion, member administration, rows, settings cards | Form state; profile/password/delete and member CRUD mutations | `AuthClient`, `UserAccessClient`, authenticated user roles | Medium: owner/demo protections and destructive confirmations are security-sensitive. |
| Theme system, lines 961-1050 | Theme selection controls and generated theme CSS | Reads and writes `zo-drive:theme:v1` in local storage | `DriveTheme`, root DOM theme application in `DriveScreen` | Medium: UI is simple, but persistence and global styling are coupled to the shell. |
| ZominAI domain and infrastructure, formerly lines 1051-1673 | Composition imports typed services from `features/zomin-ai` | No persistence, stream parsing, tool execution or installation requests remain in `drive-app.tsx` | Authenticated `/zominai/*` gateway; narrow read-only tool client | Low: domain, persistence, transport, tools and installation each have an explicit module boundary. |
| ZominAI chat UI, formerly lines 1674-1959 | Composition renders `ZominAiChatDrawer` | Drawer-local chat, warm-up, resize and history state | ZominAI services and `ZominAiToolClient` | Medium: stateful UI is isolated and directly backed by characterised service contracts. |
| ZominAI workspace, formerly lines 1960-2080 | Composition renders `ZominAiWorkspace` | Workspace-local install, preferences and verification state | Installation service, browser configuration, leaf components | Low: runtime lifecycle and settings ownership are contained within the feature. |
| Drive application shell, lines 2081-2709 | Navigation, global search, home/My Drive/starred/shared/trash/pastes dispatch, dialogs, upload orchestration and native-editor launch | Zustand path/view state; many queries, mutations, refs and browser effects | Most `DriveClient` file/share/trash/folder/form methods and every authenticated feature | Very high: primary orchestration boundary and current frontend dependency hub. Extract child features before reducing it. |
| Functions, formerly lines 2710-2812 | Composition delegates to `features/functions` | No function-local state remains in `drive-app.tsx` | Narrow `FunctionsClient` capability contract | Low: the app shell selects the feature; its hook and components own the workflow. |
| Shared Drives, lines 2813-3527 | Shared/connected folder tabs, invitations, peers, mounts, remote browser, upload/download/rename/delete | Queries, mutations, file input refs and local selection state | Cluster client methods plus owner folder listing | High: permissions, invitation lifecycle and remote file operations share one 700-line component. |
| Databases, lines 3528-4026 | Catalogue, instances, panels, import/export, table/data runner, connection keys and settings | URL-synchronised selection; engine/database/table queries and mutations | Database client methods, React Table, download APIs | High: several internal subdomains are visible and should move behind a feature module incrementally. |
| Drive API keys, lines 4027-4125 | Scoped device-key creation, one-time secret display, active-key revocation | Form state; list/create/revoke mutations | API-key client methods, current origin | Medium: security-sensitive one-time display, but feature boundary is clear. |
| Upload and storage usage, formerly lines 4126-4322 | Composition delegates to `features/upload` and `features/storage` | Upload orchestration and quota cache updates remain in `DriveScreen` | Browser `DataTransfer`, usage types, formatting | Low: presentation, traversal and estimation are isolated; the shell retains only cross-feature orchestration. |
| Zo Transfer and file-list views, lines 4323-4606 | Transfer workflow, paste list, breadcrumbs, file/recent/trash entries, filters, empty state and sharing dialogs | Transfer selection/upload/share mutations; dialog-local state | File/share client methods, shell callbacks, formatting | Medium to high: list views are mostly prop-driven; transfer and sharing contain service calls. |
| Public share and form pages, lines 4607-4725 | Shared download/paste, published forms, questions and submission | Public queries/mutations and passcode/form state | `SharedClient`, `PublicFormClient`, preview dialog | High: public URL, passcode, expiry and editable-share behaviour must remain stable. |
| Preview and native editors, lines 4726-5281 | File preview, document/spreadsheet/presentation/paste/form editors and response/settings panels | Keyboard effects, editor state, autosave timer, preview object URLs | Native content schema, formula engine, save/rename/share/form callbacks | High: multiple editor products share one implementation area; split by native file type after tests isolate save/state behaviour. |

## Current dependency direction

The intended direction is application composition to features to SDK/services. The current file violates that boundary because the application shell, feature UI, domain operations and browser infrastructure all live in one module. Notable coupling points are:

- `DriveScreen` directly coordinates file, folder, upload, trash, sharing, forms, Shared Drives and editor operations.
- ZominAI UI directly owns endpoint construction, fetch streaming, local persistence and Drive-tool execution.
- Feature selection uses query parameters and `history.replaceState` rather than isolated route modules.
- Shared presentation primitives and feature-specific components are private to the entry file, forcing unrelated edits into the same module.
- No feature imports `drive-app.tsx`; preserving that direction is required during extraction.

## First low-risk leaves

| Component | Destination | Dependencies | Why low risk |
| --- | --- | --- | --- |
| `CodeBlock` | `features/public-site/components/code-block.tsx` | Props and `Code2` icon | Pure documentation rendering. |
| `SettingsCard` | `features/account/components/settings-card.tsx` | Props and `ReactNode` | Pure account/settings layout. |
| `ZominAiCheck` | `features/zomin-ai/components/zomin-ai-check.tsx` | Props and status icons | Pure runtime-status rendering. |
| `FunctionWorkspaceTabs` | `features/functions/components/function-workspace-tabs.tsx` | Props and local tab type | Pure controlled tab navigation. |
| `EmptyState` | `shared/components/empty-state.tsx` | Props and `Cloud` icon | Reusable controlled empty-state presentation. |

None of these components owns routing, global state, service calls, persistence, authentication, authorisation or side effects.

## Completed bounded slices

### Functions

- `features/functions/functions.tsx` is now composition only.
- `use-functions-workspace.ts` owns queries, mutations, selection and editor state.
- `functions-client.ts` defines the smallest SDK capability contract accepted by the feature.
- Overview, editor, tabs and run history are presentational component modules.
- The feature never imports `drive-app.tsx`, preserving the intended dependency direction.

### Upload and storage

- `features/upload` owns drag-and-drop traversal, upload types, the upload dialog and progress estimation.
- `features/storage/storage-usage.tsx` owns usage and quota presentation and validation.
- `DriveScreen` still coordinates uploads and updates the shared React Query quota cache, which is application-level work.

### ZominAI

- `zomin-ai-types.ts` contains the feature model rather than leaking it from the app shell.
- `zomin-ai-chat-domain.ts` owns titles, compaction, context windows and metrics labels.
- `zomin-ai-config.ts` and `zomin-ai-persistence.ts` own browser storage keys, validation and migration.
- `zomin-ai-gateway.ts` owns endpoint validation, health/warm-up, SSE parsing, tool-call protocol and cancellation.
- `zomin-ai-tool-runner.ts` adapts the smallest read-only Drive/database client contract.
- `zomin-ai-installation-service.ts` owns runtime installation and verification requests.
- `zomin-ai-chat-drawer.tsx` and `zomin-ai-workspace.tsx` own the feature UI.
- Direct tests characterise context compaction, persistence hardening, endpoint validation, streaming metrics, tool follow-ups and abort propagation.

## Recommended next extraction

Split Shared Drives next by introducing a narrow cluster client contract, a query/mutation hook and separate pairing, connected-folder and remote-browser views. Its permission and invitation lifecycle should be characterised before moving handlers.

After Shared Drives, apply the same pattern to Databases. Leave native editors until save, autosave and object-URL lifecycle tests exist for each file type.
