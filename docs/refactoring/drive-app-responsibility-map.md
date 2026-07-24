# `drive-app.tsx` Responsibility Map

Status: baseline captured before the first frontend leaf extraction on 2026-07-24.

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
| ZominAI domain helpers, lines 1051-1673 | Settings/session types, local chat persistence, endpoint validation, tool schemas, completion parsing and read-only Drive tool runner | Browser storage, fetch and stream parsing, abort signals | Authenticated `/zominai/*` gateway; read-only `DriveClient` methods | High: mixes domain logic, infrastructure and browser persistence; service extraction should precede UI movement. |
| ZominAI chat UI, lines 1674-1959 | `ZominAiChat`, `ZominAiChatDrawer`, history/settings/context controls | Chat/session state, resize and media-query effects, local storage, polling | ZominAI helpers, local runtime gateway, Drive tool runner | High: large stateful component with streaming, cancellation and persistence side effects. |
| ZominAI workspace, lines 1960-2080 | Install, settings, uninstall and verification panes; runtime status components | Installation polling, verification, settings persistence | Authenticated ZominAI endpoints, local storage, formatting helpers | Medium: panes have clear boundaries, but runtime lifecycle side effects need characterisation. |
| Drive application shell, lines 2081-2709 | Navigation, global search, home/My Drive/starred/shared/trash/pastes dispatch, dialogs, upload orchestration and native-editor launch | Zustand path/view state; many queries, mutations, refs and browser effects | Most `DriveClient` file/share/trash/folder/form methods and every authenticated feature | Very high: primary orchestration boundary and current frontend dependency hub. Extract child features before reducing it. |
| Functions, lines 2710-2812 | Workspace tabs, function list/editor/run/log views | Selected function/tab/editor state; function CRUD and run queries/mutations | Function client methods, URL builder, confirmations | Medium: recognisable feature boundary; presentational leaves are low risk, handlers are moderately coupled. |
| Shared Drives, lines 2813-3527 | Shared/connected folder tabs, invitations, peers, mounts, remote browser, upload/download/rename/delete | Queries, mutations, file input refs and local selection state | Cluster client methods plus owner folder listing | High: permissions, invitation lifecycle and remote file operations share one 700-line component. |
| Databases, lines 3528-4026 | Catalogue, instances, panels, import/export, table/data runner, connection keys and settings | URL-synchronised selection; engine/database/table queries and mutations | Database client methods, React Table, download APIs | High: several internal subdomains are visible and should move behind a feature module incrementally. |
| Drive API keys, lines 4027-4125 | Scoped device-key creation, one-time secret display, active-key revocation | Form state; list/create/revoke mutations | API-key client methods, current origin | Medium: security-sensitive one-time display, but feature boundary is clear. |
| Upload and storage usage, lines 4126-4322 | Upload drop-zone/progress, usage card and quota breakdown | Drag/drop callbacks and quota update callbacks supplied by shell | Browser `DataTransfer`, usage types, formatting | Low to medium: presentational components are leaves; upload orchestration remains in `DriveScreen`. |
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

## Recommended next extraction

Extract the Functions feature as the next bounded slice: move `Functions`, `FunctionRunRow`, `FunctionLogs` and `FunctionLogEntry` into `features/functions`, then move function API coordination into a focused hook. Existing tests already exercise editor, runs and logs tabs. Keep URL construction and client calls behaviour-identical, and do not combine this with Shared Drives, Databases, or API changes.
