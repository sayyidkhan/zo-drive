import { QueryClient, QueryClientProvider, useMutation, useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from "@tanstack/react-table";
import {
  ArrowLeft,
  ArrowUp,
  ArrowUpRight,
  Bold,
  Check,
  Cloud,
  Clock3,
  Code2,
  Database,
  Copy,
  Cpu,
  Download,
  Eye,
  EyeOff,
  ExternalLink,
  File,
  FileAudio,
  FileImage,
  FileText,
  Maximize2,
  Folder,
  FolderPlus,
  FolderUp,
  Grid2X2,
  Github,
  HardDrive,
  History,
  Info,
  KeyRound,
  Italic,
  List,
  ListOrdered,
  LoaderCircle,
  LockKeyhole,
  LogOut,
  MonitorUp,
  MoreHorizontal,
  Minimize2,
  Network,
  Pencil,
  Plus,
  Palette,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Send,
  Settings2,
  ShieldCheck,
  Sigma,
  CreditCard,
  SlidersHorizontal,
  Square,
  RotateCcw,
  RefreshCw,
  ScrollText,
  Share2,
  ShieldAlert,
  Star,
  Trash2,
  Terminal,
  Upload,
  Underline,
  UserRound,
  UsersRound,
  X
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent, type PointerEvent as ReactPointerEvent } from "react";
import { toast, Toaster } from "sonner";
import { create } from "zustand";

import { ZoDriveClient } from "@zo-drive/sdk";
import type { AccountAccess, AccountMember, AccountRole, ApiKeyScope, AuthStatus, ClusterInvitation, ClusterMount, ClusterRole, DatabaseApiKey, DatabaseApiKeyScope, DatabaseEngine, DatabaseEngineId, DatabaseExecuteResult, DatabaseImportSettings, DatabaseRows, DriveApiKey, DriveDatabase, DriveFolder, DriveObject, DriveShare, DriveTrashItem, DriveUser, FormResponse, NativeFileType, PublicShare, PublishedForm, ShareAccess } from "@zo-drive/types";
import { LandingPageThree, useParticleField } from "./landing-page-three.js";
import { LandingPageTwo } from "./landing-page-two.js";
import { createDriveUrls, normalizeAppBasePath } from "./app-urls.js";
import { formatBytes, formatDate, formatDuration, formatRecentActivity, formatTrashExpiry, recentFileLocation, ttlToDate } from "./drive-formatting.js";
import { CLI_CHANGELOG, CLI_VERSION, GUI_CHANGELOG, GUI_VERSION, ZOMINAI_CHANGELOG, ZOMINAI_VERSION } from "./release-history.js";
import { formulaDisplay } from "./spreadsheet-formulas.js";
import { SettingsCard } from "./features/account/components/settings-card.js";
import { Functions } from "./features/functions/functions.js";
import { CodeBlock } from "./features/public-site/components/code-block.js";
import { StorageBreakdownDialog, UsageCard } from "./features/storage/storage-usage.js";
import { collectDroppedFiles } from "./features/upload/dropped-files.js";
import { UploadDialog } from "./features/upload/upload-dialog.js";
import { UploadProgress } from "./features/upload/upload-progress.js";
import type { UploadTask } from "./features/upload/upload-types.js";
import { ZominAiChatDrawer } from "./features/zomin-ai/zomin-ai-chat-drawer.js";
import {
  readZominAiSettings,
  writeZominAiSettings,
  zominAiButtonUrl,
  zominAiRuntimeCommand,
} from "./features/zomin-ai/zomin-ai-config.js";
import {
  checkZominAiConnection
} from "./features/zomin-ai/zomin-ai-gateway.js";
import {
  getZominAiDownloadStatus
} from "./features/zomin-ai/zomin-ai-installation-service.js";
import { ZominAiWorkspace } from "./features/zomin-ai/zomin-ai-workspace.js";
import type { DriveTheme } from "./features/theme/theme-types.js";
import type {
  ZominAiConnection,
  ZominAiPane,
  ZominAiSettings
} from "./features/zomin-ai/zomin-ai-types.js";
import { EmptyState } from "./shared/components/empty-state.js";
import { copyText } from "./shared/lib/copy-text.js";
import { matchesSearch } from "./shared/lib/matches-search.js";

export { formulaDisplay };

type DriveClient = Pick<ZoDriveClient, "createApiKey" | "createFolder" | "createNativeFile" | "createShare" | "delete" | "download" | "emptyTrash" | "getUsage" | "list" | "listApiKeys" | "listFolders" | "listFormResponses" | "listShares" | "listStarred" | "listTrash" | "permanentlyDeleteTrash" | "publishForm" | "rename" | "restoreTrash" | "revokeApiKey" | "revokeShare" | "saveNativeFile" | "setQuota" | "star" | "unstar" | "updateSharePasscode" | "upload"> & Partial<Pick<ZoDriveClient, "createClusterFolder" | "createClusterInvitation" | "createClusterMount" | "deleteClusterInvitation" | "deleteClusterMount" | "deleteClusterObject" | "deleteClusterPeer" | "downloadClusterObject" | "getClusterMountAccess" | "listClusterInvitations" | "listClusterMounts" | "listClusterObjects" | "listClusterPeers" | "renameClusterObject" | "updateClusterPeerRole" | "uploadClusterObject" | "createDatabase" | "createDatabaseApiKey" | "deleteDatabase" | "executeDatabase" | "exportDatabase" | "getDatabaseImportSettings" | "importDatabase" | "installDatabaseEngine" | "listDatabaseApiKeys" | "listDatabaseEngines" | "listDatabases" | "listDatabaseRows" | "listDatabaseTables" | "queryDatabase" | "revokeDatabaseApiKey" | "setDatabaseImportLimit" | "updateDatabaseEngine" | "createFunction" | "deleteFunction" | "listFunctions" | "listFunctionRuns" | "runFunction" | "updateFunction" | "deleteFolder" | "renameFolder">>;
type AuthClient = Pick<ZoDriveClient, "changePassword" | "deleteAccount" | "getAuthStatus" | "login" | "logout" | "registerInitialUser" | "updateProfile">;
type UserAccessClient = Pick<ZoDriveClient, "createAccountMember" | "deleteAccountMember" | "listAccountMembers" | "updateAccountMember">;
type SharedClient = Pick<ZoDriveClient, "downloadShared" | "getPublicShare" | "openSharedPaste" | "saveSharedPaste">;
type PublicFormClient = Pick<ZoDriveClient, "getPublicForm" | "submitFormResponse">;
type ViewMode = "grid" | "list";
type DriveSection = "api-keys" | "cluster-databases" | "databases" | "functions" | "home" | "my-drive" | "pastes" | "profile" | "shared" | "starred" | "theme" | "transfer" | "trash" | "user-access" | "zominai";
type DatabasePanel = "data" | "run" | "sql" | "access";
type DatabaseView = "catalog" | "instances";
type AdvancedFileType = "document" | "spreadsheet" | "presentation" | "form" | "paste" | "image" | "video" | "audio" | "pdf" | "other";
type AdvancedFilters = {
  contentQuery: string;
  inTrash: boolean;
  location: "anywhere" | "current";
  modified: "any" | "today" | "week" | "month" | "year";
  starred: boolean;
  type: AdvancedFileType | "any";
};

type RecentFilters = {
  modified: AdvancedFilters["modified"];
  source: "any" | "uploaded" | "zo-native";
  type: AdvancedFileType | "any";
};

type SharedWorkspaceTab = "incoming" | "links";

type SharedDriveFile = DriveObject & {
  mountAuthor: string | null;
  mountFolder: string;
  mountId: string;
  mountRole: ClusterRole;
};

type PasteShareSettings = {
  access: ShareAccess;
  editable: boolean;
  passcode: string;
  ttl: string;
};

type NativeFileContent = Record<string, unknown> & {
  format: "zo-native";
  type: NativeFileType;
  version: 1;
};

const defaultAdvancedFilters: AdvancedFilters = {
  contentQuery: "",
  inTrash: false,
  location: "anywhere",
  modified: "any",
  starred: false,
  type: "any"
};

const defaultRecentFilters: RecentFilters = {
  modified: "any",
  source: "any",
  type: "any"
};

const driveSections: DriveSection[] = ["api-keys", "cluster-databases", "databases", "functions", "home", "my-drive", "pastes", "profile", "shared", "starred", "theme", "transfer", "trash", "user-access", "zominai"];
const databasePanels: DatabasePanel[] = ["data", "run", "sql", "access"];
const databaseViews: DatabaseView[] = ["catalog", "instances"];

function currentDriveSection(): DriveSection {
  const section = new URLSearchParams(window.location.search).get("section");
  return driveSections.includes(section as DriveSection) ? section as DriveSection : "my-drive";
}

function currentDatabasePanel(): DatabasePanel {
  const panel = new URLSearchParams(window.location.search).get("databasePanel");
  return databasePanels.includes(panel as DatabasePanel) ? panel as DatabasePanel : "data";
}

function currentDatabaseView(): DatabaseView {
  const view = new URLSearchParams(window.location.search).get("databaseView");
  if (databaseViews.includes(view as DatabaseView)) return view as DatabaseView;
  return new URLSearchParams(window.location.search).get("database") ? "instances" : "catalog";
}

function updateDriveUrl(changes: Record<string, string | null>) {
  const url = new URL(window.location.href);
  for (const [key, value] of Object.entries(changes)) {
    if (value) url.searchParams.set(key, value);
    else url.searchParams.delete(key);
  }
  window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
}

function collapsedNavigationTooltip(open: boolean): string {
  if (open) return "";
  return "relative after:pointer-events-none after:absolute after:left-[calc(100%+0.625rem)] after:top-1/2 after:z-50 after:-translate-y-1/2 after:whitespace-nowrap after:rounded-lg after:bg-slate-900 after:px-2.5 after:py-1.5 after:text-xs after:font-semibold after:text-white after:opacity-0 after:shadow-lg after:transition-opacity after:content-[attr(data-tooltip)] hover:after:opacity-100 focus-visible:after:opacity-100";
}

type DriveUiState = {
  currentPath: string;
  viewMode: ViewMode;
  setCurrentPath: (path: string) => void;
  setViewMode: (mode: ViewMode) => void;
};

const useDriveUi = create<DriveUiState>((set) => ({
  currentPath: "",
  viewMode: "list",
  setCurrentPath: (currentPath) => set({ currentPath }),
  setViewMode: (viewMode) => set({ viewMode })
}));

const appBasePath = normalizeAppBasePath(
  import.meta.env.VITE_ZO_DRIVE_APP_BASE_PATH ?? (import.meta.env.DEV ? "/" : "/drive")
);
const { docsUrl, driveAppUrl, driveHomeUrl, formLink, landingUrl, loginUrl, releasesUrl, shareLink, zominAiDocsUrl, zominAiReleasesUrl } = createDriveUrls(appBasePath);
const driveCloudLogoUrl = `${appBasePath}/zo-drive-pegasus-cloud.svg`;
const drivePegasusLogoUrl = `${appBasePath}/zo-pegasus.svg`;
const nativeIllustrationUrl = (type: NativeFileType) => `${appBasePath}/native-illustrations/${type}.png`;
// Local development uses Vite's same-origin proxy so browsers never need to
// make a cross-port request. Deployed builds use the routed app prefix.
const apiBaseUrl = import.meta.env.DEV
  ? window.location.origin
  : import.meta.env.VITE_ZO_DRIVE_API_URL ?? `${window.location.origin}${appBasePath}`;

export function DriveApp({ client, authClient }: { client?: DriveClient; authClient?: AuthClient }) {
  const [queryClient] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: 1 } } }));
  const defaultClient = useMemo(() => new ZoDriveClient({ baseUrl: apiBaseUrl }), []);
  const driveClient = client ?? defaultClient;
  const sessionClient = authClient ?? defaultClient;
  const query = new URLSearchParams(window.location.search);
  const shareId = query.get("share");
  const formId = query.get("form");
  const isDocs = query.get("docs") === "1";
  const isReleases = query.get("releases") === "1";
  const isLogin = query.get("login") === "1";
  const isLandingPageTwo = window.location.pathname === "/landing-page-2" || window.location.pathname === `${appBasePath}/landing-page-2`;
  const isLandingPageThree = window.location.pathname === "/landing-page-3" || window.location.pathname === `${appBasePath}/landing-page-3`;
  // Supplying a client is only used by the embedded test harness. The hosted
  // app defaults to the public landing page until the user chooses Zo Drive.
  const isDrive = query.get("app") === "1" || Boolean(client || authClient);

  return (
    <QueryClientProvider client={queryClient}>
      {formId ? <PublicFormPage client={defaultClient} formId={formId} /> : shareId ? <SharedFilePage client={defaultClient} shareId={shareId} /> : isLandingPageTwo ? <LandingPageTwo currentLandingUrl={landingUrl()} docsUrl={docsUrl()} driveUrl={driveAppUrl()} loginUrl={loginUrl()} logoCloudUrl={driveCloudLogoUrl} logoPegasusUrl={drivePegasusLogoUrl} /> : isLandingPageThree ? <LandingPageThree currentLandingUrl={landingUrl()} docsUrl={docsUrl()} driveUrl={driveAppUrl()} loginUrl={loginUrl()} logoCloudUrl={driveCloudLogoUrl} logoPegasusUrl={drivePegasusLogoUrl} /> : isDocs || isReleases ? <DocsPage mode={query.get("mode") === "cli" ? "cli" : "gui"} page={isReleases || query.get("page") === "changelog" ? "changelog" : "docs"} product={query.get("product") === "zominai" || query.get("mode") === "zominai" ? "zominai" : "drive"} /> : isLogin ? <DriveGate client={driveClient} authClient={sessionClient} /> : isDrive ? <DriveGate client={driveClient} authClient={sessionClient} fallback={query.get("app") === "1" ? <LandingPage /> : undefined} /> : <LandingPage />}
      <Toaster position="bottom-right" richColors />
    </QueryClientProvider>
  );
}

function DriveMark({ compact = false }: { compact?: boolean }) {
  return <a className="flex items-center gap-2.5 text-lg font-semibold tracking-tight text-slate-950" href={landingUrl()}>
    <span className={`relative block shrink-0 ${compact ? "h-9 w-9" : "h-10 w-10"}`} role="img" aria-label="Zo Drive Pegasus on a cloud">
      <img className="absolute inset-0 h-full w-full" src={driveCloudLogoUrl} alt="" />
      <img className="absolute left-[5.94%] top-0 h-[88.44%] w-[88.44%]" src={drivePegasusLogoUrl} alt="" />
    </span>
    Zo Drive
  </a>;
}

function DocsProductSwitch({ activeProduct, page = "docs" }: { activeProduct: "drive" | "zominai"; page?: "docs" | "changelog" }) {
  return <nav aria-label="Choose documentation product" className="inline-flex items-center rounded-lg border border-slate-200 bg-white p-0.5 shadow-sm">
    <a aria-current={activeProduct === "drive" ? "page" : undefined} className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-sm font-semibold transition ${activeProduct === "drive" ? "bg-slate-950 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"}`} href={page === "changelog" ? releasesUrl("gui") : docsUrl("gui")}><HardDrive size={16} /> Zo Drive</a>
    <a aria-current={activeProduct === "zominai" ? "page" : undefined} className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-sm font-semibold transition ${activeProduct === "zominai" ? "bg-cyan-950 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"}`} href={page === "changelog" ? zominAiReleasesUrl() : zominAiDocsUrl()}><Cpu size={16} /> ZominAI</a>
  </nav>;
}

function DriveModeSwitch({ guiHref = docsUrl("gui"), mode, page = "docs" }: { guiHref?: string; mode: "gui" | "cli"; page?: "docs" | "changelog" }) {
  return <nav aria-label="Choose Zo Drive mode" className="inline-flex items-center rounded-lg border border-slate-200 bg-white p-0.5 shadow-sm">
    <a aria-current={mode === "gui" ? "page" : undefined} className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-sm font-semibold transition ${mode === "gui" ? "bg-slate-950 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"}`} href={guiHref}><MonitorUp size={16} /> GUI</a>
    <a aria-current={mode === "cli" ? "page" : undefined} className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-sm font-semibold transition ${mode === "cli" ? "bg-slate-950 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"}`} href={docsUrl("cli", page)}><Terminal size={16} /> CLI</a>
  </nav>;
}

function LandingTheme() {
  return <style>{`
    .zo-landing-theme { background: #f5f8fc; }
    .zo-landing-theme > div:first-child > .pointer-events-none { background: #eef6ff !important; }
    .zo-landing-theme > div:first-child > header { border-bottom: 1px solid rgba(148, 163, 184, .24); }
    .zo-landing-theme h1 .text-emerald-950 { color: #12314c; }
    .zo-landing-theme h1 .text-orange-500 { color: #2563eb; }
    .zo-landing-theme [aria-label="The ownership advantage"] { border-block: 1px solid #dbe6f2; background: #f7faff !important; }
    .zo-landing-theme [aria-label="The ownership advantage"] > div > div:first-child > p { color: #2563eb; }
    .zo-landing-theme [aria-label="The ownership advantage"] h2 { color: #10233d; }
    .zo-landing-theme [aria-label="The ownership advantage"] h2 .text-emerald-950 { color: #2563eb; }
    .zo-landing-theme [aria-label="The ownership advantage"] > div > div:last-child { border-color: #dbe6f2; background: #ffffff; }
    .zo-landing-theme [aria-label="The ownership advantage"] article { border-color: #e2eaf3; }
    .zo-landing-theme [aria-label="The ownership advantage"] article .text-orange-500 { color: #2563eb; }
    .zo-landing-theme [aria-label="The ownership advantage"] article h3 { color: #1e3a5f; }
    .zo-landing-theme [aria-label="The ownership advantage"] article .text-stone-600 { color: #61758d; }
    .zo-landing-theme [aria-label="The ownership advantage"] + section > div:last-child { border-color: #dbe6f2; box-shadow: 0 24px 52px rgba(30, 58, 95, .08); }
    .zo-landing-theme section[aria-label="Zo Drive product suite"] { background: #0b1f33 !important; }
    .zo-landing-theme section[aria-label="Zo Drive product suite"] .text-emerald-200 { color: #a5f3fc; }
    .zo-landing-theme section[aria-label="Zo Drive product suite"] button[aria-pressed="true"] { color: #a5f3fc !important; }
    .zo-landing-theme section[aria-label="Zo Drive product suite"] article.bg-gradient-to-br { background-image: linear-gradient(135deg, #123052 0%, #174f7e 100%) !important; box-shadow: 0 24px 48px rgba(1, 15, 31, .38); }
    .zo-landing-theme section.order-\\[55\\] { background: #0b1f33 !important; }
    .zo-landing-theme section.order-\\[55\\] .text-orange-300 { color: #cbd5e1; }
    .zo-landing-theme section[aria-label="Zo Drive closing call to action"] { background: #eef6ff !important; }
    .zo-landing-theme section[aria-label="Zo Drive closing call to action"] > div[aria-hidden="true"] { opacity: .72; }
    .zo-landing-theme > footer { border-color: #dbe6f2; background: #f8fbff; }
    @keyframes zo-remote-terminal-line-1 { 0%, 2% { clip-path: inset(0 100% 0 0); opacity: 0; } 10%, 86% { clip-path: inset(0 0 0 0); opacity: 1; } 96%, 100% { clip-path: inset(0 100% 0 0); opacity: 0; } }
    @keyframes zo-remote-terminal-line-2 { 0%, 10% { clip-path: inset(0 100% 0 0); opacity: 0; } 19%, 86% { clip-path: inset(0 0 0 0); opacity: 1; } 96%, 100% { clip-path: inset(0 100% 0 0); opacity: 0; } }
    @keyframes zo-remote-terminal-line-3 { 0%, 19% { clip-path: inset(0 100% 0 0); opacity: 0; } 28%, 86% { clip-path: inset(0 0 0 0); opacity: 1; } 96%, 100% { clip-path: inset(0 100% 0 0); opacity: 0; } }
    @keyframes zo-remote-terminal-line-4 { 0%, 37% { clip-path: inset(0 100% 0 0); opacity: 0; } 49%, 86% { clip-path: inset(0 0 0 0); opacity: 1; } 96%, 100% { clip-path: inset(0 100% 0 0); opacity: 0; } }
    @keyframes zo-remote-terminal-line-5 { 0%, 49% { clip-path: inset(0 100% 0 0); opacity: 0; } 58%, 86% { clip-path: inset(0 0 0 0); opacity: 1; } 96%, 100% { clip-path: inset(0 100% 0 0); opacity: 0; } }
    @keyframes zo-remote-terminal-line-6 { 0%, 58% { clip-path: inset(0 100% 0 0); opacity: 0; } 67%, 86% { clip-path: inset(0 0 0 0); opacity: 1; } 96%, 100% { clip-path: inset(0 100% 0 0); opacity: 0; } }
    @keyframes zo-remote-terminal-cursor { 0%, 45% { opacity: 1; } 46%, 100% { opacity: 0; } }
    @media (prefers-reduced-motion: no-preference) {
      .zo-remote-terminal > div > p { animation-duration: 12s; animation-iteration-count: infinite; animation-timing-function: steps(48, end); animation-fill-mode: both; }
      .zo-remote-terminal > div:first-child > p:nth-child(1) { animation-name: zo-remote-terminal-line-1; }
      .zo-remote-terminal > div:first-child > p:nth-child(2) { animation-name: zo-remote-terminal-line-2; }
      .zo-remote-terminal > div:first-child > p:nth-child(3) { animation-name: zo-remote-terminal-line-3; }
      .zo-remote-terminal > div:last-child > p:nth-child(1) { animation-name: zo-remote-terminal-line-4; }
      .zo-remote-terminal > div:last-child > p:nth-child(2) { animation-name: zo-remote-terminal-line-5; }
      .zo-remote-terminal > div:last-child > p:nth-child(3) { animation-name: zo-remote-terminal-line-6; }
      .zo-remote-terminal > div > p:first-child::after { content: "_"; margin-left: .25rem; color: #67e8f9; animation: zo-remote-terminal-cursor 900ms steps(1, end) infinite; }
    }
    @media (min-width: 1024px) {
      .zo-landing-theme > div.relative.isolate > header,
      .zo-landing-theme > div.relative.isolate > section,
      .zo-landing-theme [aria-label="The ownership advantage"] > div,
      .zo-landing-theme [aria-label="Remote local-machine access"] > div,
      .zo-landing-theme [aria-label="Zo Drive product suite"] > div,
      .zo-landing-theme > footer > div { max-width: 72rem !important; }
      .zo-landing-theme section.order-\[55\] > div { max-width: 57.6rem !important; }
      .zo-landing-theme [aria-label="Zo Drive closing call to action"] > div:not([aria-hidden="true"]) { max-width: 64.8rem !important; }
      .zo-landing-theme > div.relative.isolate > section > div.relative.mx-auto { max-width: 29.16rem !important; }
      .zo-landing-theme > div.relative.isolate h1,
      .zo-landing-theme [aria-label="The ownership advantage"] h2 { font-size: 4.05rem !important; }
      .zo-landing-theme [aria-label="Remote local-machine access"] h2 { font-size: 2.7rem !important; }
      .zo-landing-theme [aria-label="Zo Drive product suite"] h2 { font-size: 3.375rem !important; }
      .zo-landing-theme section.order-\[55\] h2 { font-size: 2.7rem !important; }
      .zo-landing-theme [aria-label="Zo Drive closing call to action"] h2 { font-size: 5.4rem !important; }
    }
  `}</style>;
}

function LandingPage() {
  const { heroRef, canvasRef } = useParticleField<HTMLDivElement>();

  useEffect(() => {
    const standaloneFunctions = Array.from(document.querySelectorAll<HTMLElement>("main > section")).find((section) => section.querySelector("h2")?.textContent?.includes("Automations that live beside your data."));
    standaloneFunctions?.classList.add("hidden");
    return () => standaloneFunctions?.classList.remove("hidden");
  }, []);

  return <main className="zo-landing-theme flex min-h-screen flex-col overflow-hidden bg-[#f7fafc] text-slate-900">
    <LandingTheme />
    <div className="relative isolate" ref={heroRef}>
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[43rem] overflow-hidden bg-[#ecf7ff]"><div className="absolute -left-36 -top-32 size-[34rem] rounded-full bg-sky-300/30 blur-3xl" /><div className="absolute right-[-8rem] top-24 size-[30rem] rounded-full bg-blue-300/35 blur-3xl" /></div>
      <canvas aria-hidden="true" className="landing-particle-field pointer-events-none absolute inset-0 z-0 size-full opacity-70 sm:opacity-100" ref={canvasRef} />
      <header className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8">
        <DriveMark />
        <DriveModeSwitch guiHref={driveAppUrl()} mode="gui" />
      </header>

      <section className="relative z-10 mx-auto grid max-w-7xl items-center gap-12 px-5 pb-20 pt-16 sm:px-8 lg:grid-cols-[1.05fr_.95fr] lg:pb-32 lg:pt-24">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-white/75 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.14em] text-sky-800"><Cloud size={14} /> Decentralised cloud, on your Zo</span>
          <h1 className="mt-6 max-w-3xl text-5xl font-semibold leading-[1.02] tracking-[-0.05em] text-slate-950 sm:text-6xl lg:text-7xl">Own the <span className="font-serif font-normal italic text-emerald-950">cloud.</span><br />Keep the <span className="text-orange-500">leverage.</span></h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-slate-600">Keep your files, products and workflows on the Zo Computer you control, with the custody and portability to build, share and automate on your own terms.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-600/25 transition hover:-translate-y-0.5 hover:bg-blue-700" href={loginUrl()}><HardDrive size={18} /> Sign in to Zo Drive</a>
            <a className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50" href={docsUrl()}>Read the docs <ArrowUpRight size={17} /></a>
            <a className="inline-flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-slate-800" href="https://github.com/sayyidkhan/zo-drive" rel="noreferrer" target="_blank"><Github size={17} /> View source</a>
          </div>
          <div className="mt-10 flex flex-wrap gap-x-6 gap-y-3 text-sm font-medium text-slate-600 lg:flex-nowrap"><span className="inline-flex items-center gap-2 whitespace-nowrap"><Check size={16} className="text-blue-600" /> Data stays on your Zo</span><span className="inline-flex items-center gap-2 whitespace-nowrap"><Check size={16} className="text-blue-600" /> Folder-preserving uploads</span><span className="inline-flex items-center gap-2 whitespace-nowrap"><Check size={16} className="text-blue-600" /> GUI &amp; CLI Access</span></div>
        </div>

        <div className="relative mx-auto w-full max-w-[32.4rem]">
          <div className="absolute -inset-5 -z-10 rounded-[2.5rem] bg-white/70 blur-xl" />
          <div className="overflow-hidden rounded-[1.65rem] border border-white/90 bg-white shadow-2xl shadow-blue-950/15">
            <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4"><span className="size-2.5 rounded-full bg-red-300" /><span className="size-2.5 rounded-full bg-amber-300" /><span className="size-2.5 rounded-full bg-emerald-300" /><span className="ml-2 text-xs font-semibold text-slate-400">My Drive</span></div>
            <div className="p-5 sm:p-6">
              <div className="flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-blue-600">Your private workspace</p><h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">My Drive</h2></div><span className="grid size-10 place-items-center rounded-xl bg-blue-600 text-white"><Cloud size={20} /></span></div>
              <div className="mt-6 overflow-hidden rounded-2xl border border-slate-100"><div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-3.5 py-2.5"><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Folders</p><span className="text-[10px] font-semibold text-slate-400">29 items</span></div><div className="divide-y divide-slate-100">{[['Product/Launch', '4 files', 'bg-amber-100 text-amber-700'], ['Design/Assets', '18 files', 'bg-violet-100 text-violet-700'], ['Reports/2026', '7 files', 'bg-emerald-100 text-emerald-700']].map(([name, count, tone]) => <div className="flex items-center gap-3 px-3.5 py-3" key={name}><span className={`grid size-8 place-items-center rounded-lg ${tone}`}><Folder size={16} /></span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-slate-800">{name}</span><span className="text-xs text-slate-400">{count}</span></span><MoreHorizontal size={17} className="text-slate-300" /></div>)}</div></div>
              <div className="mt-5"><div className="mb-2.5 flex items-center justify-between"><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Built-in tools</p><span className="text-[10px] font-semibold text-slate-400">6 tools</span></div><div className="grid grid-cols-2 gap-2">{[{ name: 'Zo Paste', icon: <Code2 size={15} />, tone: 'bg-cyan-50 text-cyan-700', href: `${driveAppUrl()}&section=pastes` }, { name: 'Zo Transfer', icon: <Send size={15} />, tone: 'bg-blue-50 text-blue-700', href: `${driveAppUrl()}&section=transfer` }, { name: 'Zo Functions', icon: <Terminal size={15} />, tone: 'bg-violet-50 text-violet-700', href: `${driveAppUrl()}&section=functions` }, { name: 'Zo Databases', icon: <Database size={15} />, tone: 'bg-emerald-50 text-emerald-700', href: `${driveAppUrl()}&section=databases&databaseView=catalog` }, { name: 'Zo Shared Drives', icon: <Network size={15} />, tone: 'bg-sky-50 text-sky-700', href: `${driveAppUrl()}&section=cluster-databases` }, { name: 'ZominAI', icon: <Cpu size={15} />, tone: 'bg-amber-50 text-amber-700', href: `${driveAppUrl()}&section=zominai` }].map(({ name, icon, tone, href }) => <a aria-label={`Open ${name}`} className="group flex min-w-0 items-center gap-2 rounded-lg border border-slate-100 bg-slate-50 px-2.5 py-2.5 transition hover:border-slate-200 hover:bg-white" href={href} key={name}><span className={`grid size-7 shrink-0 place-items-center rounded-md ${tone}`}>{icon}</span><span className="min-w-0 flex-1 truncate text-xs font-semibold text-slate-700">{name}</span><ArrowUpRight size={13} className="shrink-0 text-slate-300 transition group-hover:text-slate-600" /></a>)}</div></div>
            </div>
          </div>
        </div>
      </section>
    </div>

    <OwnershipAdvantage />

    <section className="mx-auto max-w-7xl px-5 py-16 sm:px-8"><div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end"><div><p className="text-sm font-bold uppercase tracking-[0.15em] text-blue-600">One Drive. Two ways to work.</p><h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">Manage visually. Automate precisely.</h2></div><p className="max-w-xl text-sm leading-6 text-slate-600">Both interfaces use the same private Drive. Pick the surface that fits the job, without moving the work or giving up control.</p></div><div className="mt-8 grid overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-xl shadow-slate-900/5 lg:grid-cols-2"><article className="p-6 sm:p-8"><div className="flex items-center justify-between"><span className="grid size-10 place-items-center rounded-xl bg-blue-50 text-blue-700"><MonitorUp size={19} /></span><span className="font-mono text-xs font-semibold text-slate-400">01 / GUI</span></div><h3 className="mt-9 text-2xl font-semibold tracking-tight text-slate-950">Work in context.</h3><p className="mt-3 max-w-md text-sm leading-6 text-slate-600">Browse, upload, share and manage all six products visually, including browser-only ZominAI.</p><div className="mt-7 overflow-hidden rounded-xl border border-slate-200 bg-slate-50"><div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 text-xs font-semibold text-slate-500"><span className="flex items-center gap-2"><Folder size={15} className="text-blue-600" /> Product/Launch</span><span className="rounded-full bg-blue-50 px-2 py-1 text-[10px] font-bold text-blue-700">4 files</span></div><div className="grid grid-cols-3 gap-px bg-slate-200 text-center text-xs font-semibold text-slate-600"><span className="bg-slate-50 px-3 py-3">Upload</span><span className="bg-slate-50 px-3 py-3">Organise</span><span className="bg-slate-50 px-3 py-3">Share</span></div></div><a className="mt-6 inline-flex items-center gap-1.5 text-sm font-bold text-blue-700 hover:text-blue-900" href={docsUrl()}>Explore GUI <ArrowUpRight size={15} /></a></article><article className="bg-slate-950 p-6 text-white sm:p-8"><div className="flex items-center justify-between"><span className="grid size-10 place-items-center rounded-xl bg-white/10 text-cyan-300"><Terminal size={19} /></span><span className="font-mono text-xs font-semibold text-slate-500">02 / CLI</span></div><h3 className="mt-9 text-2xl font-semibold tracking-tight">Run repeatable work.</h3><p className="mt-3 max-w-md text-sm leading-6 text-slate-300">Script file work, checks and automation across Drive, Paste, Transfer, Shared Drives, Databases and Functions.</p><div className="mt-7 overflow-hidden rounded-xl border border-white/10 bg-[#070b1d] p-4 font-mono text-xs leading-6 text-slate-200"><p><span className="text-slate-500">$ </span><span className="text-cyan-300">zo-drive</span> upload ./launch-plan.pdf <span className="text-amber-300">--path</span> Product/Launch</p><p className="mt-3 text-emerald-300">✓ Uploaded Product/Launch/launch-plan.pdf</p><p className="text-slate-400">✓ Ready for the next job</p></div><a className="mt-6 inline-flex items-center gap-1.5 text-sm font-bold text-cyan-300 hover:text-white" href={docsUrl("cli")}>Explore CLI <ArrowUpRight size={15} /></a></article></div></section>

    <section className="mx-auto grid max-w-7xl gap-10 px-5 py-20 sm:px-8 lg:grid-cols-[.92fr_1.08fr] lg:items-center lg:py-28"><div><p className="text-sm font-bold uppercase tracking-[0.15em] text-violet-700">Zo Functions</p><h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">Automations that live beside your data.</h2><p className="mt-4 max-w-xl text-base leading-7 text-slate-600">Write a small handler, keep the source in your Drive, then run it manually, on a schedule, or through a deliberate public endpoint. No separate server to deploy or maintain.</p><div className="mt-7 space-y-3 text-sm font-medium text-slate-700"><p className="flex items-center gap-3"><span className="grid size-6 place-items-center rounded-full bg-violet-100 text-violet-700"><Check size={14} /></span> JavaScript and Python handlers</p><p className="flex items-center gap-3"><span className="grid size-6 place-items-center rounded-full bg-violet-100 text-violet-700"><Check size={14} /></span> Private by default, public only when you choose</p><p className="flex items-center gap-3"><span className="grid size-6 place-items-center rounded-full bg-violet-100 text-violet-700"><Check size={14} /></span> UTC cron schedules and visible run history</p></div><a aria-label="Open Zo Functions workspace" className="mt-8 inline-flex items-center gap-2 rounded-xl bg-violet-700 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-700/20 transition hover:-translate-y-0.5 hover:bg-violet-800" href={`${driveAppUrl()}&section=functions`}><Terminal size={17} /> Open Zo Functions <ArrowUpRight size={16} /></a></div><div className="overflow-hidden rounded-[1.6rem] border border-slate-800 bg-slate-950 shadow-2xl shadow-violet-950/15"><div className="flex items-center justify-between border-b border-white/10 bg-slate-900 px-5 py-4"><div className="flex items-center gap-2 text-sm font-semibold text-white"><Terminal size={17} className="text-violet-300" /> weekly-report.js</div><span className="rounded-full bg-violet-300/10 px-2.5 py-1 text-xs font-semibold text-violet-200">private</span></div><div className="grid gap-5 p-5 sm:grid-cols-[minmax(0,1fr)_10rem]"><pre className="overflow-x-auto rounded-xl bg-[#111827] p-4 text-xs leading-6 text-slate-200"><code><span className="text-violet-300">export default async function</span> <span className="text-sky-300">handler</span>(input) {'{'}{`\n`}  <span className="text-violet-300">return</span> {'{'}{`\n`}    report: <span className="text-amber-300">"weekly"</span>,{`\n`}    generatedAt: <span className="text-sky-300">new Date</span>().toISOString(){`\n`}  {'}'};{`\n`}{'}'}</code></pre><div className="space-y-3"><div className="rounded-xl border border-white/10 bg-white/5 p-3"><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Schedule</p><code className="mt-2 block text-sm font-semibold text-violet-200">0 9 * * 1</code><p className="mt-1 text-xs leading-5 text-slate-400">Every Monday, 09:00 UTC</p></div><div className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-3"><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-300">Latest run</p><p className="mt-2 text-sm font-semibold text-emerald-100">Success</p><p className="mt-1 text-xs text-emerald-200/70">Completed in 143 ms</p></div></div></div></div></section>

    <RemoteAccessSection />
    <KillerFeatureStories />
    <ZoDriveComparisonCta />
    <ZoDriveClosingCta />

    <footer className="order-[60] border-t border-slate-200 bg-white"><div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-7 text-sm text-slate-500 sm:px-8"><DriveMark compact /><span>Your decentralised cloud on Zo.</span><a className="font-semibold text-slate-600 hover:text-blue-700" href={docsUrl()}>Documentation</a></div></footer>
  </main>;
}

function OwnershipAdvantage() {
  const benefits = [
    { number: "01", icon: <HardDrive size={21} />, title: "Storage you control", body: "Your Drive data lives on your Zo machine, not inside a conventional centralised file silo." },
    { number: "02", icon: <MonitorUp size={21} />, title: "Your machine, every workflow", body: "Use the browser, command line or TypeScript SDK to work with the same private storage." },
    { number: "03", icon: <LockKeyhole size={21} />, title: "Private by default", body: "Your workspace stays private until you deliberately create a share link." },
    { number: "04", icon: <Send size={21} />, title: "Share on your terms", body: "Use Zo Transfer for public or passcode-protected links with expiry controls." }
  ];

  return <section aria-label="The ownership advantage" className="bg-[#fcfaf6] py-20 sm:py-28"><div className="mx-auto max-w-7xl px-5 sm:px-8"><div className="grid gap-8 lg:grid-cols-[.38fr_1fr] lg:items-end"><p className="text-sm font-bold uppercase tracking-[0.15em] text-orange-500">The ownership advantage</p><h2 className="max-w-5xl text-4xl font-semibold leading-[0.98] tracking-[-0.06em] text-[#121512] sm:text-6xl lg:text-7xl">A cloud should increase your <span className="font-serif font-normal italic text-emerald-950">agency,</span> not your dependency.</h2></div><div className="mt-12 grid overflow-hidden rounded-[1.7rem] border border-[#ebe7df] bg-[#f4f1eb] sm:grid-cols-2 lg:grid-cols-4">{benefits.map((benefit) => <article className="min-h-64 border-b border-[#e4dfd6] p-6 last:border-b-0 sm:min-h-72 sm:border-b-0 sm:border-r sm:even:border-r-0 sm:p-9 lg:even:border-r lg:last:border-r-0" key={benefit.number}><div className="flex items-start justify-between gap-4"><p className="font-serif text-4xl italic text-orange-500">{benefit.number}</p><span className="grid size-11 place-items-center rounded-2xl bg-blue-100 text-blue-700">{benefit.icon}</span></div><h3 className="mt-12 text-xl font-semibold tracking-tight text-[#202220]">{benefit.title}</h3><p className="mt-4 max-w-sm text-sm leading-6 text-stone-600">{benefit.body}</p></article>)}</div></div></section>;
}

function RemoteAccessSection() {
  return <section aria-label="Remote local-machine access" className="border-y border-slate-200 bg-[#f7faff] py-20 sm:py-24"><div className="mx-auto grid max-w-7xl gap-10 px-5 sm:px-8 lg:grid-cols-[.88fr_1.12fr] lg:items-center"><div><p className="text-sm font-bold uppercase tracking-[0.15em] text-blue-600">Remote machine access</p><h2 className="mt-3 max-w-xl text-4xl font-semibold leading-[0.98] tracking-[-0.06em] text-slate-950 sm:text-5xl">Work locally. <span className="font-serif font-normal italic text-blue-700">Keep Zo authoritative.</span></h2><p className="mt-5 max-w-xl text-base leading-7 text-slate-600">Connect the Zo Drive CLI on your local machine to your Zo Computer, then work against the same private folders, files and product data from your terminal. Zo remains the source of truth.</p><div className="mt-8 grid grid-cols-[1fr_auto_1fr] items-center gap-3"><div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><MonitorUp size={20} className="text-blue-600" /><p className="mt-4 text-sm font-semibold text-slate-900">Your local machine</p><p className="mt-1 text-xs leading-5 text-slate-500">Use the CLI where you already work.</p></div><span className="grid size-10 place-items-center rounded-full border border-cyan-200 bg-cyan-50 text-cyan-700"><Network size={18} /></span><div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><HardDrive size={20} className="text-blue-600" /><p className="mt-4 text-sm font-semibold text-slate-900">Your Zo Computer</p><p className="mt-1 text-xs leading-5 text-slate-500">Keeps the private Drive and data.</p></div></div><a className="mt-8 inline-flex items-center gap-1.5 text-sm font-bold text-blue-700 hover:text-blue-900" href={docsUrl("cli")}>Read the remote CLI guide <ArrowUpRight size={15} /></a></div><div className="overflow-hidden rounded-[1.6rem] border border-slate-800 bg-[#0b1f33] shadow-2xl shadow-slate-900/15"><div className="flex items-center justify-between border-b border-white/10 px-5 py-4"><span className="flex items-center gap-2 text-sm font-semibold text-white"><Terminal size={17} className="text-cyan-300" /> Remote Zo Drive connection</span><span className="rounded-full bg-cyan-300/10 px-2.5 py-1 text-xs font-semibold text-cyan-200">private</span></div><div className="zo-remote-terminal space-y-5 p-5 font-mono text-xs leading-7 sm:p-6"><div><p className="text-slate-400"><span className="text-slate-500">$ </span><span className="text-cyan-300">zo-drive</span> configure</p><p className="mt-2 text-slate-300">Zo Drive URL: <span className="text-white">https://your-zo.example</span></p><p className="text-emerald-300">✓ Secure connection saved on this machine</p></div><div className="border-t border-white/10 pt-5"><p className="text-slate-400"><span className="text-slate-500">$ </span><span className="text-cyan-300">zo-drive</span> upload ./launch-plan.pdf <span className="text-amber-300">--path</span> Product/Launch</p><p className="mt-2 text-emerald-300">✓ Uploaded to your Zo Computer</p><p className="text-slate-400">✓ Ready for the next job</p></div></div><div className="grid border-t border-white/10 text-xs sm:grid-cols-3"><div className="border-b border-white/10 px-5 py-4 sm:border-b-0 sm:border-r"><p className="font-bold uppercase tracking-[0.14em] text-slate-500">Configure once</p><p className="mt-2 font-semibold text-slate-200">Local device key</p></div><div className="border-b border-white/10 px-5 py-4 sm:border-b-0 sm:border-r"><p className="font-bold uppercase tracking-[0.14em] text-slate-500">Operate remotely</p><p className="mt-2 font-semibold text-slate-200">Files and workflows</p></div><div className="px-5 py-4"><p className="font-bold uppercase tracking-[0.14em] text-slate-500">Data stays on Zo</p><p className="mt-2 font-semibold text-slate-200">One private source</p></div></div></div></div></section>;
}

function KillerFeatureStories() {
  return <ProductSuite />;

  const features = [
    { eyebrow: "Zo Functions", title: "Automations that live beside your data.", body: "Write a JavaScript or Python handler beside your data, run it manually or on a UTC schedule, and expose it only when you deliberately choose to.", benefits: ["Private or deliberate public endpoints", "UTC cron schedules and visible run history"], href: `${driveAppUrl()}&section=functions`, cta: "Explore Zo Functions", icon: <Terminal size={20} />, file: "weekly-report.js", command: "zo-drive function create --name weekly-report --source-file ./weekly-report.js", lines: ["Private JavaScript function created", "Schedule: 0 9 * * 1 UTC", "Ready to run or invoke"], accent: "cyan" },
    { eyebrow: "Zo Paste", title: "Share notes and code with control.", body: "Create a private text paste, then share exactly that note or snippet without exposing the rest of your Drive.", benefits: ["View-only or editable links", "Passcode, expiry, and revocation"], href: `${driveAppUrl()}&section=pastes`, cta: "Explore Zo Paste", icon: <Code2 size={20} />, file: "launch-notes.md", command: "zo-drive paste create launch-notes.md --editable", lines: ["Creating private paste…", "Link access: editable", "Passcode protection enabled"], accent: "cyan" },
    { eyebrow: "Zo Transfer", title: "Deliver files without opening a folder.", body: "Choose an existing Drive file or upload a new one, then send a purpose-built delivery link that expires when you say it should.", benefits: ["Public or passcode access", "Clear expiry and revocation controls"], href: `${driveAppUrl()}&section=transfer`, cta: "Explore Zo Transfer", icon: <Send size={20} />, file: "launch-brief.pdf", command: "zo-drive transfer create launch-brief.pdf --expires 7d", lines: ["Preparing delivery link…", "Access: passcode protected", "Expires in 7 days"], accent: "blue" },
    { eyebrow: "Zo Shared Drives", title: "Collaborate without making copies.", body: "Share selected folders as live remote mounts so the people you choose can work from the source folder you control.", benefits: ["Viewer and editor access", "Private bounded cache for opened content"], href: `${driveAppUrl()}&section=cluster-databases`, cta: "Explore Zo Shared Drives", icon: <Network size={20} />, file: "Research / shared", command: "zo-drive shared invite Research --role editor", lines: ["Pairing key created", "Role: Read & write", "Source folder stays live"], accent: "cyan" },
    { eyebrow: "Zo Databases", title: "Put application data beside your files.", body: "Install a supported runtime, create a private persistent database, and manage it from the same workspace as the files it supports.", benefits: ["Real private engine runtimes", "Database-scoped HTTPS credentials"], href: `${driveAppUrl()}&section=databases&databaseView=catalog`, cta: "Explore Zo Databases", icon: <Database size={20} />, file: "product.sqlite", command: "zo-drive database create product --engine sqlite", lines: ["SQLite runtime ready", "Private database created", "Scoped access key issued"], accent: "emerald" },
    { eyebrow: "ZominAI", title: "Ask your Drive. Keep the write boundary.", body: "Use a model running on your Zo Computer to understand storage, search Drive context, and inspect supported databases without granting write access.", benefits: ["Local model runtime on your Zo", "Authenticated, read-only Drive tools"], href: `${driveAppUrl()}&section=zominai`, cta: "Explore ZominAI", icon: <Cpu size={20} />, file: "ZominAI · local", command: "What changed in Product/Launch?", lines: ["Searching Product/Launch…", "Reading 4 supported files", "Ready with a sourced answer"], accent: "amber" }
  ];
  const featureOrder = ["Zo Paste", "Zo Transfer", "Zo Functions", "Zo Databases", "Zo Shared Drives", "ZominAI"];
  const orderedFeatures = [...features].sort((left, right) => featureOrder.indexOf(left.eyebrow) - featureOrder.indexOf(right.eyebrow));

  return <section className="order-20 border-t border-slate-200 bg-[#f7fafc] py-20 sm:py-24" id="killer-features">
    <style>{`
      @keyframes zo-terminal-line { 0%, 11% { opacity: 0; transform: translateY(7px); } 18%, 100% { opacity: 1; transform: translateY(0); } }
      @keyframes zo-terminal-cursor { 0%, 45% { opacity: 1; } 46%, 100% { opacity: 0; } }
      @keyframes zo-terminal-glow { 0%, 100% { box-shadow: 0 24px 56px rgba(15, 23, 42, .16); } 50% { box-shadow: 0 28px 68px rgba(37, 99, 235, .25); } }
      @media (prefers-reduced-motion: no-preference) {
        .zo-terminal { animation: zo-terminal-glow 4s ease-in-out infinite; }
        .zo-terminal-line { animation: zo-terminal-line 5.2s cubic-bezier(.2,.7,.2,1) infinite both; }
        .zo-terminal-cursor { animation: zo-terminal-cursor 900ms steps(1, end) infinite; }
      }
      main > section:nth-of-type(2) { display: none; }
      main > section:nth-of-type(3) { order: 10; }
      main > section:nth-of-type(1) { order: 50; }
      main > footer { order: 60; }
    `}</style>
    <div className="mx-auto max-w-7xl px-5 sm:px-8">
      <div className="max-w-3xl">
        <p className="text-sm font-bold uppercase tracking-[0.15em] text-blue-600">Six products. One private cloud.</p>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">Every capability earns its place beside your data.</h2>
        <p className="mt-4 text-base leading-7 text-slate-600">The order follows the feature shelf above. Every product has a browser workflow, a command-line path or a deliberate GUI-only boundary, and a transparent comparison with the paid SaaS it replaces.</p>
      </div>
      <div className="mt-14 space-y-20 lg:space-y-28">
        {orderedFeatures.map((feature, featureIndex) => <article className="grid gap-10 lg:grid-cols-[.92fr_1.08fr] lg:items-center" key={feature.eyebrow}>
          <div className={featureIndex % 2 === 1 ? "lg:order-2" : undefined}>
            <span className={`grid size-11 place-items-center rounded-xl ${feature.accent === "emerald" ? "bg-emerald-100 text-emerald-700" : feature.accent === "amber" ? "bg-amber-100 text-amber-700" : feature.accent === "blue" ? "bg-blue-100 text-blue-700" : "bg-cyan-100 text-cyan-700"}`}>{feature.icon}</span>
            <p className={`mt-6 text-sm font-bold uppercase tracking-[0.15em] ${feature.accent === "emerald" ? "text-emerald-700" : feature.accent === "amber" ? "text-amber-700" : feature.accent === "blue" ? "text-blue-700" : "text-cyan-700"}`}>{feature.eyebrow}</p>
            <h3 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">{feature.title}</h3>
            <p className="mt-4 max-w-xl text-base leading-7 text-slate-600">{feature.body}</p>
            <div className="mt-7 space-y-3 text-sm font-medium text-slate-700">{feature.benefits.map((benefit) => <p className="flex items-center gap-3" key={benefit}><span className={`grid size-6 place-items-center rounded-full ${feature.accent === "emerald" ? "bg-emerald-100 text-emerald-700" : feature.accent === "amber" ? "bg-amber-100 text-amber-700" : feature.accent === "blue" ? "bg-blue-100 text-blue-700" : "bg-cyan-100 text-cyan-700"}`}><Check size={14} /></span>{benefit}</p>)}</div>
            <a aria-label={feature.cta} className={`mt-8 inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-white shadow-lg transition hover:-translate-y-0.5 ${feature.accent === "emerald" ? "bg-emerald-700 shadow-emerald-700/20 hover:bg-emerald-800" : feature.accent === "amber" ? "bg-amber-600 shadow-amber-600/20 hover:bg-amber-700" : feature.accent === "blue" ? "bg-blue-600 shadow-blue-600/20 hover:bg-blue-700" : "bg-cyan-700 shadow-cyan-700/20 hover:bg-cyan-800"}`} href={feature.href}>{feature.cta} <ArrowUpRight size={16} /></a>
          </div>
          <div className={featureIndex % 2 === 1 ? "lg:order-1" : undefined}>
            <FeatureShowcase command={feature.command} file={feature.file} lines={feature.lines} product={feature.eyebrow} />
          </div>
        </article>)}
      </div>
    </div>
  </section>;
}

function ProductSuite() {
  const products = [
    { name: "Zo Paste", verb: "Publish", title: "Share notes and code with control.", body: "Create a private text paste, then share exactly that note or snippet without exposing the rest of your Drive.", href: `${driveAppUrl()}&section=pastes`, cta: "Open Zo Paste", icon: <Code2 size={20} />, file: "launch-notes.md", command: "zo-drive paste create launch-notes.md --editable", lines: ["Creating private paste…", "Link access: editable", "Passcode protection enabled"], tone: "cyan" },
    { name: "Zo Transfer", verb: "Deliver", title: "Deliver files without opening a folder.", body: "Send a purpose-built delivery link with passcodes, expiry and revocation controls.", href: `${driveAppUrl()}&section=transfer`, cta: "Open Zo Transfer", icon: <Send size={20} />, file: "launch-brief.pdf", command: "zo-drive transfer create launch-brief.pdf --expires 7d", lines: ["Preparing delivery link…", "Access: passcode protected", "Expires in 7 days"], tone: "blue" },
    { name: "Zo Functions", verb: "Automate", title: "Automations that live beside your data.", body: "Write JavaScript or Python handlers beside your files, then run them manually or on a schedule.", href: `${driveAppUrl()}&section=functions`, cta: "Open Zo Functions", icon: <Terminal size={20} />, file: "weekly-report.js", command: "zo-drive function create --name weekly-report --source-file ./weekly-report.js", lines: ["Private JavaScript function created", "Schedule: 0 9 * * 1 UTC", "Ready to run or invoke"], tone: "cyan" },
    { name: "Zo Databases", verb: "Build", title: "Persistent data without another cloud account.", body: "Install supported database runtimes, create private instances and issue scoped credentials from one workspace.", href: `${driveAppUrl()}&section=databases&databaseView=catalog`, cta: "Open Zo Databases", icon: <Database size={20} />, file: "product.sqlite", command: "zo-drive database create product --engine sqlite", lines: ["SQLite runtime ready", "Private database created", "Scoped access key issued"], tone: "emerald" },
    { name: "Zo Shared Drives", verb: "Collaborate", title: "Collaborate without making copies.", body: "Share selected folders as live remote mounts while the source stays under your control.", href: `${driveAppUrl()}&section=cluster-databases`, cta: "Open Zo Shared Drives", icon: <Network size={20} />, file: "Research / shared", command: "zo-drive shared invite Research --role editor", lines: ["Pairing key created", "Role: Read & write", "Source folder stays live"], tone: "cyan" },
    { name: "ZominAI", verb: "Understand", title: "Ask your Drive. Keep the write boundary.", body: "Use a local model to understand Drive context and supported databases without granting write access.", href: `${driveAppUrl()}&section=zominai`, cta: "Open ZominAI", icon: <Cpu size={20} />, file: "ZominAI · local", command: "What changed in Product/Launch?", lines: ["Searching Product/Launch…", "Reading 4 supported files", "Ready with a sourced answer"], tone: "amber" }
  ];
  const [selectedIndex, setSelectedIndex] = useState(3);
  const selected = products[selectedIndex]!;
  const tone = selected.tone === "emerald" ? "from-emerald-950 to-[#103a35]" : selected.tone === "amber" ? "from-amber-950 to-[#49331d]" : selected.tone === "blue" ? "from-blue-950 to-[#1b3f71]" : "from-cyan-950 to-[#123c47]";

  return <section aria-label="Zo Drive product suite" className="order-20 bg-[#101410] py-14 text-white sm:py-16" id="killer-features"><div className="mx-auto max-w-7xl px-5 sm:px-8"><div className="grid gap-6 border-b border-white/10 pb-8 lg:grid-cols-[1.2fr_.8fr] lg:items-end"><div><p className="text-sm font-bold uppercase tracking-[0.15em] text-emerald-200">The Zo Drive product family</p><h2 className="mt-3 text-4xl font-semibold leading-[.92] tracking-[-0.065em] sm:text-6xl">One home.<span className="block font-serif font-normal italic text-emerald-200">Six focused tools.</span></h2></div><p className="max-w-xl text-sm leading-6 text-white/65">Every product has a clear job. Together they form one owner-controlled system around the same identity, files and private context, without handing your data to a new SaaS vendor at every step.</p></div><div className="mt-8 grid gap-6 lg:grid-cols-[.35fr_.65fr] lg:items-center"><div className="divide-y divide-white/10 border-y border-white/10 lg:self-center">{products.map((product, index) => <button aria-pressed={selectedIndex === index} aria-label={`Select ${product.name}`} className={`flex w-full items-center gap-4 px-0 py-3.5 text-left transition ${selectedIndex === index ? "text-emerald-200" : "text-white/65 hover:text-white"}`} key={product.name} onClick={() => setSelectedIndex(index)} type="button"><span className="w-6 font-mono text-xs font-semibold">{String(index + 1).padStart(2, "0")}</span><span className="flex-1 text-base font-semibold">{product.name}</span><span className="text-xs font-bold uppercase tracking-[.13em]">{product.verb}</span></button>)}</div><article className={`w-full overflow-hidden rounded-[1.5rem] bg-gradient-to-br ${tone} p-5 shadow-2xl shadow-black/20 sm:p-6`}><div className="flex items-start justify-between gap-5"><span className="grid size-11 place-items-center rounded-xl bg-white/10 text-emerald-200">{selected.icon}</span><span className="rounded-full border border-white/15 px-3 py-1 text-xs font-bold uppercase tracking-[.14em] text-white/70">{selected.verb}</span></div><p className="mt-6 text-sm font-bold uppercase tracking-[.15em] text-emerald-200">{selected.name}</p><h3 className="mt-3 max-w-2xl text-3xl font-semibold leading-[.98] tracking-[-.05em] sm:text-4xl">{selected.title}</h3><p className="mt-3 max-w-2xl text-sm leading-6 text-white/70">{selected.body}</p><div className="mt-5"><FeatureShowcase command={selected.command} file={selected.file} lines={selected.lines} product={selected.name} /></div><a className="mt-5 inline-flex items-center gap-2 text-sm font-bold uppercase tracking-[.13em] text-emerald-200 hover:text-white" href={selected.href}>{selected.cta} <ArrowUpRight size={16} /></a></article></div></div></section>;
}

type FeatureSurfaceTab = "gui" | "cli" | "cost";

function isGuiFeatureTab(tab: FeatureSurfaceTab): boolean {
  return tab === "gui";
}

function FeatureShowcase({ command, file, lines, product }: { command: string; file: string; lines: string[]; product: string }) {
  const views: Record<string, { action: string; fields: string[]; status: string }> = {
    "Zo Paste": { action: "New paste", fields: ["Markdown", "Passcode protected", "Expires in 7 days"], status: "Private until shared" },
    "Zo Transfer": { action: "Create transfer", fields: ["launch-brief.pdf", "Passcode access", "Expires in 7 days"], status: "Ready to send" },
    "Zo Functions": { action: "New function", fields: ["JavaScript", "0 9 * * 1 UTC", "Private endpoint"], status: "Schedule enabled" },
    "Zo Databases": { action: "Create database", fields: ["SQLite", "Persistent runtime", "Scoped HTTPS key"], status: "Private database" },
    "Zo Shared Drives": { action: "Invite collaborator", fields: ["Research folder", "Read & write", "Pairing key"], status: "Live source folder" },
    ZominAI: { action: "Ask ZominAI", fields: ["What changed in Launch?", "Read-only Drive tools", "Bonsai local runtime"], status: "Local and private" }
  };
  const comparisons: Record<string, { alternative: string; cost: string; note: string; savings: string; savingsDetail: string; zoDetail: string }> = {
    "Zo Paste": { alternative: "Pastebin Pro", cost: "Price unavailable", note: "Pastebin says Pro accounts are currently sold out.", savings: "Avoid another subscription", savingsDetail: "The comparable plan does not publish a current price.", zoDetail: "Private pastes live beside your files." },
    "Zo Transfer": { alternative: "WeTransfer Ultimate", cost: "US$25/month", note: "US monthly list price. Includes unlimited transfers, no transfer-size limit, and unlimited transfer expiry.", savings: "Save US$25/month", savingsDetail: "Against WeTransfer Ultimate's current US monthly list price.", zoDetail: "Create public or passcode-protected delivery links from the Drive you control, with expiry and revocation controls." },
    "Zo Functions": { alternative: "Vercel Pro", cost: "US$20/month", note: "Usage charges can apply beyond included credits.", savings: "Save US$20/month", savingsDetail: "Before any additional usage charges.", zoDetail: "Run scheduled work beside your data." },
    "Zo Databases": { alternative: "Supabase Pro", cost: "From US$25/month", note: "Usage-based charges can apply beyond included allowances.", savings: "Save from US$25/month", savingsDetail: "Before any additional usage charges.", zoDetail: "Keep private databases on your Zo." },
    "Zo Shared Drives": { alternative: "Google Workspace Standard", cost: "US$14/user/month", note: "Annual commitment price; US monthly-flexible price is US$16.80/user.", savings: "Save US$14/user/month", savingsDetail: "At the annual-commitment list price.", zoDetail: "Share selected folders, not your whole cloud." },
    ZominAI: { alternative: "ChatGPT Plus", cost: "US$20/month", note: "Separate cloud subscription; ZominAI is a local model workspace.", savings: "Save US$20/month", savingsDetail: "For a separate cloud AI subscription.", zoDetail: "Ask private questions against your Drive." }
  };
  const tabs: Array<{ id: FeatureSurfaceTab; label: string }> = [{ id: "gui", label: "GUI version" }, { id: "cli", label: product === "ZominAI" ? "CLI boundary" : "CLI version" }, { id: "cost", label: "Cost comparison" }];
  const tabOrder: FeatureSurfaceTab[] = ["gui", "cli", "cost"];
  const [activeTab, setActiveTab] = useState<FeatureSurfaceTab>("gui");
  const view = views[product] ?? views["Zo Paste"]!;
  const comparison = comparisons[product] ?? comparisons["Zo Paste"]!;

  useEffect(() => {
    setActiveTab("gui");
  }, [product]);

  useEffect(() => {
    if (typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => {
      setActiveTab((current) => tabOrder[(tabOrder.indexOf(current) + 1) % tabOrder.length]!);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [activeTab]);

  if (isGuiFeatureTab(activeTab)) return <FeatureGuiShowcase product={product} onSelectTab={setActiveTab} />;

  return <section aria-label={`${product} feature views`} className="overflow-hidden rounded-[1.6rem] border border-slate-200 bg-white shadow-xl shadow-slate-900/5"><style>{`@keyframes feature-tab-progress { from { stroke-dashoffset: 100; } to { stroke-dashoffset: 0; } }`}</style><header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3.5 sm:px-5"><div aria-label={`${product} product views`} className="flex min-w-0 items-center gap-1 overflow-x-auto rounded-lg bg-slate-100 p-1" role="tablist">{tabs.map((tab) => <button aria-controls={`${product}-${tab.id}`} aria-selected={activeTab === tab.id} className={`shrink-0 rounded-md px-2.5 py-1.5 text-xs font-semibold transition sm:px-3 ${activeTab === tab.id ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"}`} id={`${product}-${tab.id}-tab`} key={tab.id} onClick={() => setActiveTab(tab.id)} role="tab" type="button">{tab.label}</button>)}</div><span aria-label="Next feature view in 5 seconds" className="grid size-7 shrink-0 place-items-center"><svg className="size-7 -rotate-90" viewBox="0 0 32 32"><circle className="stroke-slate-200" cx="16" cy="16" fill="none" pathLength="100" r="11" strokeWidth="3" /><circle className="stroke-blue-600" cx="16" cy="16" fill="none" key={activeTab} pathLength="100" r="11" strokeDasharray="100" strokeDashoffset="100" strokeLinecap="round" strokeWidth="3" style={{ animation: "feature-tab-progress 5s linear forwards" }} /></svg></span></header><div className="min-h-[15rem] p-5 sm:p-6" id={`${product}-${activeTab}`} role="tabpanel" aria-labelledby={`${product}-${activeTab}-tab`}>{activeTab === "gui" ? <><div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2 text-sm font-semibold text-slate-900"><MonitorUp size={17} className="text-blue-600" /> {view.action}</div><button className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white" type="button">{product === "ZominAI" ? "Ask" : "Create"}</button></div><div className="mt-5 grid gap-2 sm:grid-cols-3">{view.fields.map((field) => <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-600" key={field}>{field}</div>)}</div><div className="mt-5 flex items-center gap-2 border-t border-slate-100 pt-4 text-xs font-semibold text-emerald-700"><Check size={14} /> {view.status}</div></> : activeTab === "cli" ? <div className="rounded-xl bg-slate-950 p-4 font-mono text-xs leading-7 text-slate-200 sm:p-5 sm:text-sm"><div className="mb-3 flex items-center justify-between gap-3 border-b border-white/10 pb-3 font-sans text-xs font-semibold text-slate-300"><span className="flex items-center gap-2"><Terminal size={16} className="text-cyan-300" /> {file}</span><span className="rounded-full bg-emerald-300/10 px-2 py-1 text-emerald-200">live</span></div>{product === "ZominAI" ? <p className="text-slate-300">ZominAI intentionally has no CLI. Use its private browser workspace so the local runtime and read-only Drive tools stay behind authenticated access.</p> : <><p className="zo-terminal-line text-cyan-300" style={{ animationDelay: "0ms" }}><span className="text-slate-500">$ </span>{command}<span className="zo-terminal-cursor ml-0.5 inline-block text-cyan-200">_</span></p>{lines.map((line, index) => <p className="zo-terminal-line text-slate-300" key={line} style={{ animationDelay: `${(index + 1) * 850}ms` }}><span className="mr-2 text-emerald-300">✓</span>{line}</p>)}</>}</div> : <div className="space-y-4"><div className="grid gap-3 lg:grid-cols-[1fr_auto_1fr] lg:items-stretch"><article className="rounded-xl border border-slate-200 bg-slate-50 p-4"><p className="text-[0.68rem] font-bold uppercase tracking-[0.14em] text-slate-500">Existing SaaS</p><p className="mt-3 text-sm font-semibold text-slate-900">{comparison.alternative}</p><p className="mt-1 text-lg font-bold text-slate-800">{comparison.cost}</p><p className="mt-3 text-xs leading-5 text-slate-500">{comparison.note}</p></article><div aria-hidden="true" className="grid place-items-center py-1 text-sm font-bold text-slate-400 lg:px-1">-&gt;</div><article className="rounded-xl border border-emerald-200 bg-emerald-50 p-4"><p className="text-[0.68rem] font-bold uppercase tracking-[0.14em] text-emerald-700">Zo Drive</p><p className="mt-3 text-sm font-semibold text-slate-900">{product}</p><p className="mt-1 text-lg font-bold text-emerald-800">US$0 extra</p><p className="mt-3 text-xs leading-5 text-emerald-800/70">{comparison.zoDetail} Included with Zo Drive on your Zo Computer.</p></article></div><div aria-label={`${product} monthly cost saving`} className="rounded-xl bg-slate-950 px-4 py-3 text-center text-white"><p className="text-[0.68rem] font-bold uppercase tracking-[0.14em] text-cyan-300">Monthly saving</p><p className="mt-1 text-lg font-bold">{comparison.savings}</p><p className="mt-1 text-xs text-slate-300">{comparison.savingsDetail}</p></div></div>}</div></section>;
}

function FeatureGuiShowcase({ onSelectTab, product }: { onSelectTab: (tab: FeatureSurfaceTab) => void; product: string }) {
  const tabs: Array<{ id: FeatureSurfaceTab; label: string }> = [{ id: "gui", label: "GUI version" }, { id: "cli", label: product === "ZominAI" ? "CLI boundary" : "CLI version" }, { id: "cost", label: "Cost comparison" }];
  const content = product === "Zo Paste" ? <div className="space-y-3"><div className="flex items-center justify-between border-b border-slate-100 pb-3"><span className="flex items-center gap-2 text-sm font-semibold text-slate-900"><FileText size={16} className="text-cyan-700" /> launch-notes.md</span><span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-emerald-700">Private</span></div><div className="rounded-xl border border-slate-200 bg-slate-50 p-3 font-mono text-xs leading-6 text-slate-600"><span className="text-cyan-700">#</span> Launch notes{`\n\n`}The brief is ready for review.</div><div className="flex flex-wrap gap-2"><span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">Markdown</span><span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">Editable link</span><button className="ml-auto rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white" type="button">Share</button></div></div> : product === "Zo Transfer" ? <div className="space-y-3"><div className="flex items-center justify-between rounded-xl border border-blue-100 bg-blue-50 p-3"><span className="flex items-center gap-2 text-sm font-semibold text-slate-900"><File size={17} className="text-blue-600" /> launch-brief.pdf</span><span className="text-xs font-medium text-slate-500">24.8 MB</span></div><div className="rounded-xl border border-slate-200 p-3"><p className="text-[10px] font-bold uppercase tracking-[.14em] text-slate-400">Delivery link</p><p className="mt-2 truncate font-mono text-xs text-slate-700">zo.drive/t/launch-brief</p></div><div className="flex flex-wrap gap-2 text-xs"><span className="rounded-md bg-amber-50 px-2 py-1 font-medium text-amber-700">Passcode required</span><span className="rounded-md bg-slate-100 px-2 py-1 font-medium text-slate-600">Expires in 7 days</span><button className="ml-auto rounded-lg bg-blue-600 px-3 py-1.5 font-semibold text-white" type="button">Copy link</button></div></div> : product === "Zo Functions" ? <div className="overflow-hidden rounded-2xl bg-slate-950 text-white"><div className="flex items-center justify-between border-b border-white/10 px-4 py-3"><span className="flex items-center gap-2 text-sm font-semibold"><Terminal size={16} className="text-violet-300" /> weekly-report.js</span><span className="rounded-full bg-violet-300/10 px-2 py-1 text-xs font-semibold text-violet-200">private</span></div><div className="grid gap-4 p-4 sm:grid-cols-[minmax(0,1fr)_10rem]"><pre className="overflow-x-auto rounded-xl bg-slate-900 p-4 text-xs leading-7 text-slate-200"><code><span className="text-violet-300">export default async function</span> <span className="text-cyan-300">handler</span>(input) {'{'}{`\n`}  <span className="text-violet-300">return</span> {'{'} report: <span className="text-amber-300">"weekly"</span> {'}'};{`\n`}{'}'}</code></pre><div className="space-y-3"><div className="rounded-xl border border-white/10 bg-white/5 p-3"><p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[.14em] text-slate-400"><Clock3 size={12} /> Schedule</p><code className="mt-2 block text-sm font-semibold text-violet-200">0 9 * * 1</code><p className="mt-1 text-xs leading-5 text-slate-400">Every Monday, 09:00 UTC</p></div><div className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-3"><p className="text-[10px] font-bold uppercase tracking-[.14em] text-emerald-300">Latest run</p><p className="mt-2 text-sm font-semibold text-emerald-100">Success</p><p className="mt-1 text-xs text-emerald-200/70">Completed in 143 ms</p></div></div></div></div> : product === "Zo Databases" ? <div className="space-y-3"><div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 p-3"><span className="flex items-center gap-2 text-sm font-semibold text-slate-900"><Database size={17} className="text-emerald-700" /> product.sqlite</span><span className="rounded-full bg-white px-2 py-1 text-[10px] font-bold text-emerald-700">ONLINE</span></div><div className="grid grid-cols-3 gap-2">{[["Engine", "SQLite"], ["Tables", "8"], ["Storage", "14.2 MB"]].map(([label, value]) => <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5" key={label}><p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</p><p className="mt-1 text-xs font-semibold text-slate-800">{value}</p></div>)}</div><div className="flex items-center justify-between border-t border-slate-100 pt-3 text-xs"><span className="font-medium text-emerald-700">Scoped HTTPS key active</span><button className="rounded-lg bg-emerald-600 px-3 py-1.5 font-semibold text-white" type="button">Open data</button></div></div> : product === "Zo Shared Drives" ? <div className="space-y-3"><div className="flex items-center justify-between rounded-xl border border-cyan-100 bg-cyan-50 p-3"><span className="flex items-center gap-2 text-sm font-semibold text-slate-900"><Folder size={17} className="text-cyan-700" /> Research</span><span className="text-xs font-medium text-cyan-700">Source live</span></div><div className="space-y-2">{[["SK", "Sayyid", "Owner"], ["AM", "Amira", "Read & write"]].map(([initials, name, role]) => <div className="flex items-center gap-3 rounded-lg border border-slate-100 p-2.5" key={name}><span className="grid size-7 place-items-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-600">{initials}</span><span className="flex-1 text-xs font-semibold text-slate-800">{name}</span><span className="text-[10px] font-medium text-slate-500">{role}</span></div>)}</div><button className="w-full rounded-lg border border-cyan-200 px-3 py-2 text-xs font-semibold text-cyan-800" type="button">Invite collaborator</button></div> : <div className="space-y-3"><div className="flex items-center justify-between border-b border-slate-100 pb-3"><span className="flex items-center gap-2 text-sm font-semibold text-slate-900"><Cpu size={16} className="text-cyan-700" /> ZominAI</span><span className="rounded-full bg-cyan-50 px-2 py-1 text-[10px] font-bold text-cyan-800">LOCAL</span></div><div className="rounded-xl bg-slate-950 p-3 text-xs leading-5 text-slate-100"><p className="text-cyan-200">What changed in Product/Launch?</p><p className="mt-3 rounded-lg bg-white/10 p-2.5 text-slate-200">Four files changed. The launch brief and report are ready for review.</p></div><div className="flex items-center gap-2 text-xs text-emerald-700"><ShieldCheck size={14} /> Read-only Drive tools</div></div>;
  return <section aria-label={`${product} feature views`} className="overflow-hidden rounded-[1.6rem] border border-slate-200 bg-white shadow-xl shadow-slate-900/5"><style>{`@keyframes feature-tab-progress { from { stroke-dashoffset: 100; } to { stroke-dashoffset: 0; } }`}</style><header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3.5 sm:px-5"><div aria-label={`${product} product views`} className="flex min-w-0 items-center gap-1 overflow-x-auto rounded-lg bg-slate-100 p-1" role="tablist">{tabs.map((tab) => <button aria-selected={tab.id === "gui"} className={`shrink-0 rounded-md px-2.5 py-1.5 text-xs font-semibold transition sm:px-3 ${tab.id === "gui" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"}`} key={tab.id} onClick={() => onSelectTab(tab.id)} role="tab" type="button">{tab.label}</button>)}</div><span aria-label="Next feature view in 5 seconds" className="grid size-7 shrink-0 place-items-center"><svg className="size-7 -rotate-90" viewBox="0 0 32 32"><circle className="stroke-slate-200" cx="16" cy="16" fill="none" pathLength="100" r="11" strokeWidth="3" /><circle className="stroke-blue-600" cx="16" cy="16" fill="none" pathLength="100" r="11" strokeDasharray="100" strokeDashoffset="100" strokeLinecap="round" strokeWidth="3" style={{ animation: "feature-tab-progress 5s linear forwards" }} /></svg></span></header><div className="min-h-[15rem] p-5 sm:p-6">{content}</div></section>;
}

function FunctionFeatureShowcase() {
  const [tab, setTab] = useState<FeatureSurfaceTab>("gui");
  return <section aria-label="Zo Functions feature views" className="overflow-hidden rounded-[1.6rem] border border-slate-200 bg-white shadow-xl shadow-slate-900/5"><header className="border-b border-slate-100 px-4 py-3.5 sm:px-5"><div aria-label="Zo Functions product views" className="flex gap-1 overflow-x-auto rounded-lg bg-slate-100 p-1" role="tablist">{(["gui", "cli", "cost"] as const).map((item) => <button aria-selected={tab === item} className={`shrink-0 rounded-md px-3 py-1.5 text-xs font-semibold transition ${tab === item ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`} key={item} onClick={() => setTab(item)} role="tab" type="button">{item === "gui" ? "GUI version" : item === "cli" ? "CLI version" : "Cost comparison"}</button>)}</div></header><div className="p-5 sm:p-6">{tab === "gui" ? <div className="overflow-hidden rounded-2xl bg-slate-950 text-white"><div className="flex items-center justify-between border-b border-white/10 px-4 py-3"><span className="flex items-center gap-2 text-sm font-semibold"><Terminal size={16} className="text-violet-300" /> weekly-report.js</span><span className="rounded-full bg-violet-300/10 px-2 py-1 text-xs font-semibold text-violet-200">private</span></div><div className="grid gap-4 p-4 sm:grid-cols-[minmax(0,1fr)_10rem]"><pre className="overflow-x-auto rounded-xl bg-slate-900 p-4 text-xs leading-7 text-slate-200"><code><span className="text-violet-300">export default async function</span> <span className="text-cyan-300">handler</span>(input) {'{'}{`\n`}  <span className="text-violet-300">return</span> {'{'}{`\n`}    report: <span className="text-amber-300">\"weekly\"</span>,{`\n`}    generatedAt: <span className="text-cyan-300">new Date</span>().toISOString(){`\n`}  {'}'};{`\n`}{'}'}</code></pre><div className="space-y-3"><div className="rounded-xl border border-white/10 bg-white/5 p-3"><p className="text-[10px] font-bold uppercase tracking-[.14em] text-slate-400">Schedule</p><code className="mt-2 block text-sm font-semibold text-violet-200">0 9 * * 1</code><p className="mt-1 text-xs leading-5 text-slate-400">Every Monday, 09:00 UTC</p></div><div className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-3"><p className="text-[10px] font-bold uppercase tracking-[.14em] text-emerald-300">Latest run</p><p className="mt-2 text-sm font-semibold text-emerald-100">Success</p><p className="mt-1 text-xs text-emerald-200/70">Completed in 143 ms</p></div></div></div></div> : tab === "cli" ? <div className="rounded-xl bg-slate-950 p-4 font-mono text-xs leading-7 text-slate-200"><span className="text-slate-500">$ </span><span className="text-cyan-300">zo-drive function create</span> --name weekly-report --source-file ./weekly-report.js<p className="mt-3 text-emerald-300">✓ Private JavaScript function created</p><p className="text-slate-300">✓ Schedule: 0 9 * * 1 UTC</p></div> : <div className="space-y-4"><div className="grid gap-3 lg:grid-cols-[1fr_auto_1fr]"><article className="rounded-xl border border-slate-200 bg-slate-50 p-4"><p className="text-[.68rem] font-bold uppercase tracking-[.14em] text-slate-500">Existing SaaS</p><p className="mt-3 font-semibold text-slate-900">Vercel Pro</p><p className="mt-1 text-lg font-bold text-slate-800">US$20/month</p></article><div className="grid place-items-center text-slate-400">-&gt;</div><article className="rounded-xl border border-emerald-200 bg-emerald-50 p-4"><p className="text-[.68rem] font-bold uppercase tracking-[.14em] text-emerald-700">Zo Drive</p><p className="mt-3 font-semibold text-slate-900">Zo Functions</p><p className="mt-1 text-lg font-bold text-emerald-800">US$0 extra</p></article></div><div aria-label="Zo Functions monthly cost saving" className="rounded-xl bg-slate-950 px-4 py-3 text-center text-white"><p className="text-[.68rem] font-bold uppercase tracking-[.14em] text-cyan-300">Monthly saving</p><p className="mt-1 text-lg font-bold">Save US$20/month</p></div></div>}</div></section>;
}

function FeatureGuiPreview({ product }: { product: string }) {
  const views: Record<string, { action: string; fields: string[]; status: string }> = {
    "Zo Paste": { action: "New paste", fields: ["Markdown", "Passcode protected", "Expires in 7 days"], status: "Private until shared" },
    "Zo Transfer": { action: "Create transfer", fields: ["launch-brief.pdf", "Passcode access", "Expires in 7 days"], status: "Ready to send" },
    "Zo Functions": { action: "New function", fields: ["JavaScript", "0 9 * * 1 UTC", "Private endpoint"], status: "Schedule enabled" },
    "Zo Databases": { action: "Create database", fields: ["SQLite", "Persistent runtime", "Scoped HTTPS key"], status: "Private database" },
    "Zo Shared Drives": { action: "Invite collaborator", fields: ["Research folder", "Read & write", "Pairing key"], status: "Live source folder" },
    ZominAI: { action: "Ask ZominAI", fields: ["What changed in Launch?", "Read-only Drive tools", "Bonsai local runtime"], status: "Local and private" }
  };
  const view = views[product] ?? views["Zo Paste"]!;
  return <section aria-label={`${product} GUI version`} className="mb-5 overflow-hidden rounded-[1.6rem] border border-slate-200 bg-white shadow-xl shadow-slate-900/5"><header className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5"><div className="flex items-center gap-2 text-sm font-semibold text-slate-800"><MonitorUp size={17} className="text-blue-600" /> GUI version</div><span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">Browser</span></header><div className="p-5"><div className="flex items-center justify-between gap-3"><p className="text-sm font-semibold text-slate-900">{view.action}</p><button className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white" type="button">{product === "ZominAI" ? "Ask" : "Create"}</button></div><div className="mt-4 grid gap-2 sm:grid-cols-3">{view.fields.map((field) => <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-600" key={field}>{field}</div>)}</div><div className="mt-4 flex items-center gap-2 border-t border-slate-100 pt-3 text-xs font-semibold text-emerald-700"><Check size={14} /> {view.status}</div></div></section>;
}

function FeatureCostComparison({ product }: { product: string }) {
  const comparisons: Record<string, { alternative: string; cost: string; note: string }> = {
    "Zo Paste": { alternative: "Pastebin Pro", cost: "Price unavailable", note: "Pastebin says Pro accounts are currently sold out." },
    "Zo Transfer": { alternative: "WeTransfer Ultimate", cost: "US$25/month", note: "Current US monthly list price; regional pricing and taxes may vary." },
    "Zo Functions": { alternative: "Vercel Pro", cost: "US$20/month", note: "Usage charges can apply beyond included credits." },
    "Zo Databases": { alternative: "Supabase Pro", cost: "From US$25/month", note: "Usage-based charges can apply beyond included allowances." },
    "Zo Shared Drives": { alternative: "Google Workspace Standard", cost: "US$14/user/month", note: "Annual commitment price; US monthly-flexible price is US$16.80/user." },
    ZominAI: { alternative: "ChatGPT Plus", cost: "US$20/month", note: "Separate cloud subscription; ZominAI is a local model workspace." }
  };
  const comparison = comparisons[product] ?? comparisons["Zo Paste"]!;
  return <section aria-label={`${product} cost comparison`} className="mt-5 overflow-hidden rounded-[1.35rem] border border-slate-200 bg-white shadow-sm"><header className="flex items-center gap-2 border-b border-slate-100 px-5 py-3.5 text-sm font-semibold text-slate-800"><CreditCard size={17} className="text-amber-600" /> Cost comparison</header><div className="overflow-x-auto"><table className="w-full min-w-[32rem] text-left text-xs"><thead className="bg-slate-50 text-slate-500"><tr><th className="px-5 py-3 font-bold uppercase tracking-[0.12em]">Comparable SaaS</th><th className="px-5 py-3 font-bold uppercase tracking-[0.12em]">Starting paid cost</th><th className="px-5 py-3 font-bold uppercase tracking-[0.12em]">Zo Drive</th></tr></thead><tbody><tr className="border-t border-slate-100 align-top"><td className="px-5 py-4 font-semibold text-slate-800">{comparison.alternative}<p className="mt-1 font-normal leading-5 text-slate-500">{comparison.note}</p></td><td className="px-5 py-4 font-semibold text-slate-700">{comparison.cost}</td><td className="px-5 py-4 font-semibold text-emerald-700">US$0 extra<p className="mt-1 font-normal leading-5 text-slate-500">Included with Zo Drive on your Zo Computer.</p></td></tr></tbody></table></div></section>;
}

function ZoDriveComparisonCta() {
  const regularSaas = [
    ["Pastebin Pro", "Price unavailable"],
    ["WeTransfer Ultimate", "US$25 / month"],
    ["Vercel Pro", "US$20 / month"],
    ["Supabase Pro", "US$25 / month"],
    ["Google Workspace", "US$14/user / month"],
    ["ChatGPT Plus", "US$20 / month"]
  ];
  const zoFeatures = [["Zo Paste", "US$0"], ["Zo Transfer", "US$0"], ["Zo Functions", "US$0"], ["Zo Databases", "US$0"], ["Zo Shared Drives", "US$0"], ["ZominAI", "US$0"]];

  return <section className="order-[55] bg-slate-950 py-20 text-white sm:py-24"><div className="mx-auto max-w-[64rem] px-5 sm:px-8"><div className="max-w-3xl"><p className="text-sm font-bold uppercase tracking-[0.15em] text-cyan-300">Why Zo Drive</p><h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-5xl">Six subscriptions become one private suite.</h2><p className="mt-5 text-base leading-7 text-slate-300">Keep the workflows. Remove the repeated accounts, scattered data and avoidable monthly SaaS spend.</p></div><div className="mt-10 grid gap-5 lg:grid-cols-2"><article aria-label="Fragmented SaaS subscriptions" className="rounded-2xl border border-white/10 bg-white/5 p-5 sm:p-7"><p className="text-xs font-bold uppercase tracking-[0.15em] text-orange-300">Before / fragmented SaaS</p><h3 className="mt-2 text-2xl font-semibold">Six vendors</h3><ul className="mt-6 divide-y divide-white/10">{regularSaas.map(([name, cost]) => <li className="flex items-center justify-between gap-4 py-3.5" key={name}><span className="font-semibold text-slate-100">{name}</span><span className="text-right text-sm text-slate-400">{cost}</span></li>)}</ul><div className="mt-6 rounded-xl bg-black/50 px-4 py-4"><p className="text-xs font-bold uppercase tracking-[0.15em] text-slate-400">Published starting prices</p><p className="mt-2 text-3xl font-semibold tracking-tight text-white">US$104+ <span className="text-lg font-medium text-slate-400">/ month</span></p><p className="mt-2 text-sm leading-6 text-slate-400">Before Pastebin Pro and additional usage charges.</p></div></article><article aria-label="Zo Drive private suite" className="rounded-2xl border border-cyan-300/30 bg-cyan-300/[0.08] p-5 shadow-2xl shadow-cyan-400/5 sm:p-7"><p className="text-xs font-bold uppercase tracking-[0.15em] text-cyan-200">After / Zo Drive</p><h3 className="mt-2 text-2xl font-semibold text-cyan-50">One private system</h3><ul className="mt-6 divide-y divide-cyan-200/15">{zoFeatures.map(([name, cost]) => <li className="flex items-center justify-between gap-4 py-3.5" key={name}><span className="font-semibold text-cyan-50">{name}</span><span className="shrink-0 text-sm font-semibold text-cyan-200">{cost}</span></li>)}</ul><div className="mt-6 rounded-xl bg-cyan-950/70 px-4 py-4"><p className="text-xs font-bold uppercase tracking-[0.15em] text-cyan-100/70">Additional SaaS cost</p><p className="mt-2 text-3xl font-semibold tracking-tight text-cyan-50">US$0 <span className="text-lg font-medium text-cyan-100/70">extra / feature</span></p><p className="mt-2 text-sm leading-6 text-cyan-100/70">Included with Zo Drive on your Zo Computer.</p></div></article></div></div></section>;
}

function ZoDriveClosingCta() {
  return <section aria-label="Zo Drive closing call to action" className="order-[59] relative isolate overflow-hidden bg-[#f4f8ff] px-5 py-24 text-center sm:px-8 sm:py-32"><div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"><div className="absolute left-[8%] top-[-14rem] size-[28rem] rounded-full bg-sky-200/40 blur-3xl" /><div className="absolute bottom-[-16rem] right-[8%] size-[30rem] rounded-full bg-blue-200/45 blur-3xl" /></div><div className="mx-auto max-w-6xl"><p className="inline-flex items-center gap-2 font-mono text-xs font-semibold uppercase tracking-[0.15em] text-blue-700"><span className="size-2 rounded-full bg-blue-500" /> Bring your cloud home</p><h2 className="mt-7 text-5xl font-semibold leading-[0.94] tracking-[-0.065em] text-slate-950 sm:text-7xl lg:text-8xl">The workspace you own. <span className="block font-serif text-[1.05em] font-normal italic tracking-[-0.06em]">The work you can move.</span></h2><div className="mt-10 flex flex-wrap justify-center gap-3"><a className="inline-flex items-center gap-3 rounded-xl bg-blue-600 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-blue-600/25 transition hover:-translate-y-0.5 hover:bg-blue-700" href={loginUrl()}>Open Zo Drive <ArrowUpRight size={18} /></a><a className="inline-flex items-center gap-3 rounded-xl border border-slate-300 bg-white/80 px-6 py-3.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-400 hover:bg-white" href="#killer-features">See how it works <ArrowUp size={18} /></a></div></div></section>;
}

function DocsPage({ mode, page, product }: { mode: "gui" | "cli"; page: "docs" | "changelog"; product: "drive" | "zominai" }) {
  if (product === "zominai") return page === "changelog" ? <ZominAiDocsChangelogPage /> : <ZominAiDocsPage />;
  return page === "changelog" ? <DocsChangelogPage mode={mode} /> : <><DocsProductBar /><DocsChangelogLink mode={mode} /><style>{`#changelog, a[href="#changelog"] { display: none; }`}</style><DocsGuidesPage mode={mode} /></>;
}

function DocsProductBar() {
  return <div className="fixed right-5 top-3 z-30 hidden sm:block sm:right-8"><p className="mb-1 px-1 text-xs font-bold uppercase tracking-[0.14em] text-slate-400">Product</p><DocsProductSwitch activeProduct="drive" /></div>;
}

function ZominAiDocsModeSwitch({ page = "docs" }: { page?: "docs" | "changelog" }) {
  return <DocsProductSwitch activeProduct="zominai" page={page} />;
}

function DocsChangelogLink({ mode }: { mode: "gui" | "cli" }) {
  const version = mode === "gui" ? GUI_VERSION : CLI_VERSION;
  const label = mode === "gui" ? "GUI" : "CLI";
  return <a aria-label={`${label} releases version ${version}`} className="fixed right-5 top-[4.75rem] z-30 inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 sm:right-8" href={releasesUrl(mode)}><ScrollText size={16} /> Releases <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-bold text-slate-600">v{version}</span></a>;
}

function DocsGuidesPage({ mode }: { mode: "gui" | "cli" }) {
  const serverUrl = `${window.location.origin}${appBasePath}`;
  const cliInstall = `git clone https://github.com/sayyidkhan/zo-drive.git\ncd zo-drive\npnpm install\npnpm build\n(cd apps/cli && npm link)\nzo-drive --help`;
  const cliConnect = `zo-drive configure\n\n# Zo Drive URL: ${serverUrl}\n# Zo Drive API key: [input hidden]`;
  const cliUpload = `zo-drive health\nzo-drive upload ./launch-plan.pdf --path Product/Launch\nzo-drive exists Product/Launch/launch-plan.pdf\nzo-drive stat Product/Launch/launch-plan.pdf --json\nzo-drive mv Product/Launch/launch-plan.pdf Archive/2026/launch-plan.pdf\nzo-drive rm Archive/2026/launch-plan.pdf`;
  const cliUpdate = `cd zo-drive\ngit pull --ff-only\npnpm install --frozen-lockfile\npnpm build\nzo-drive --help`;
  const cliRelease = `cd zo-drive\ngit fetch origin --tags\ngit tag --sort=-v:refname | head -n 1\ngit checkout <release-tag>\npnpm install --frozen-lockfile\npnpm build`;
  const sdkUpload = `import { readFile } from "node:fs/promises";\nimport { ZoDriveClient } from "@zo-drive/sdk";\n\nconst client = new ZoDriveClient({\n  baseUrl: "${serverUrl}",\n  headers: { authorization: \`Bearer \${process.env.ZO_DRIVE_API_KEY}\` }\n});\n\nconst bytes = await readFile("./launch-plan.pdf");\nawait client.upload({\n  file: new Blob([bytes], { type: "application/pdf" }),\n  fileName: "launch-plan.pdf",\n  path: "Product/Launch"\n});`;
  const isGui = mode === "gui";
  const changelog = isGui ? GUI_CHANGELOG : CLI_CHANGELOG;
  const hero = isGui
    ? { title: "Run your private cloud from one workspace.", body: "Use the browser GUI for files, private apps, controlled sharing, local AI, databases, and automations beside the data they use." }
    : { title: "Operate your Drive from the terminal.", body: "Use the CLI for fast file operations, Zo Originals CRUD, safe checks, device health, and scriptable automation against the same private Drive." };
  const sections = isGui
    ? [
        { id: "gui", eyebrow: "Browser GUI", icon: <MonitorUp size={20} />, title: "Upload from the Drive", body: "Use the browser interface for everyday uploads, folders and sharing.", steps: ["Select Zo Drive in the top-right navigation and sign in with the owner account.", "Use the blue Upload button at the bottom-right of the Drive.", "Drop a file or folder into the panel, or choose File or Folder. Folder uploads preserve the directory structure."] },
        { id: "organise", eyebrow: "File workspace", icon: <Folder size={20} />, title: "Organise, find, and recover your files", body: "My Drive is your working folder tree, while Recent, Starred, Search, and Trash keep the rest of your work easy to retrieve.", steps: ["Create folders and move files into a clear structure in My Drive.", "Use Recent for recently updated work, Starred for important files, and Search when you know part of a name or content.", "Move files to Trash instead of deleting them permanently, then restore or remove them deliberately from the Trash view."] },
        { id: "sharing", eyebrow: "Sharing", icon: <Share2 size={20} />, title: "Share files on your terms", body: "Create a controlled link when someone needs access to a file outside your private Drive.", steps: ["Select a file in Zo Drive and choose Share.", "Choose a public link or require a passcode, then set an expiry if needed.", "Copy the generated link and revoke it whenever access should end."] },
        { id: "paste", eyebrow: "Zo Paste", icon: <Code2 size={20} />, title: "Create Zo Originals and secure pastes", body: "Create documents, spreadsheets, presentations, forms, and code-aware Zo Paste notes directly in Drive instead of passing files between separate apps.", steps: ["Use New to create a Zo-native file, then keep it private in Drive while you work.", "Open Zo Paste for a focused editor with language and tag metadata.", "Share a paste as view-only or editable, with a public link or passcode, expiry, and revocation controls."] },
        { id: "transfer", eyebrow: "Zo Transfer", icon: <Send size={20} />, title: "Deliver files with Zo Transfer", body: "Create purpose-built delivery links from an existing Drive file or a new upload, without making the rest of your Drive visible.", steps: ["Open Zo Transfer from the sidebar.", "Choose a Drive file or upload one specifically for delivery.", "Set public or passcode access and an expiry, then manage or revoke the transfer from the same workspace."] },
        { id: "shared-drives", eyebrow: "Zo Shared Drives", icon: <Network size={20} />, title: "Collaborate on selected folders", body: "Zo Shared Drives lets you share chosen folders with named collaborators while keeping unrelated Drive content private.", steps: ["Open Zo Shared Drives from the sidebar.", "Create or connect a shared folder and invite the collaborator who needs access.", "Choose read-only or read-and-write access, then change or revoke it when the collaboration ends."] },
        { id: "databases", eyebrow: "Zo Databases", icon: <Database size={20} />, title: "Run private databases beside your files", body: "Install and manage private database engines in Drive, inspect their tables, and use the native request workspace without moving data to a separate SaaS product.", steps: ["Open Zo Databases and choose the engine that fits the workload.", "Create or import a private database, then browse tables and manage scoped database credentials.", "Use the in-Drive request workspace for the installed engine when you need to inspect or query it."] },
        { id: "functions", eyebrow: "Zo Functions", icon: <Terminal size={20} />, title: "Automate with Zo Functions", body: "Keep JavaScript or Python handlers next to your data, then run them manually, on a schedule, or through a deliberate endpoint.", steps: ["Open Zo Functions and create a JavaScript or Python handler.", "Use Function runs to test with input and inspect a concise run history.", "Add a UTC schedule or choose a public endpoint only when that automation needs external access."] },
        { id: "zominai", eyebrow: "ZominAI", icon: <Cpu size={20} />, title: "Ask about your Drive without granting write access", body: "ZominAI runs Bonsai 8B privately on your Zo Computer and can use deliberately read-only Drive context when your question needs it.", steps: ["Open ZominAI from the header button and check the live connection badge.", "Ask about supported files, folders, or database structure from web, iPhone, or Android.", "Use the separate ZominAI product guide for Zo Computer setup, privacy boundaries, and release history."] },
        { id: "gui-releases", eyebrow: "GUI releases", icon: <MonitorUp size={20} />, title: `GUI version ${GUI_VERSION}`, body: "The browser GUI is versioned and released independently from the local CLI. New GUI versions are deployed to this Drive automatically.", steps: ["Check this page for the active GUI version.", "Use gui-v release tags when you need to trace a deployed browser change.", "CLI updates are separate and do not require a browser refresh beyond loading the latest page."] }
      ]
    : [
        { id: "installation", eyebrow: "Installation", icon: <Terminal size={20} />, title: "Install zo-drive on your machine", body: "Set up the zo-drive command once, then use it from any folder on your machine.", steps: ["Clone the Zo Drive repository, install dependencies, and build the workspace.", "Run npm link inside apps/cli to make the zo-drive command available globally in your terminal.", "Confirm the installation by running zo-drive --help."] },
        { id: "connection", eyebrow: "Local-to-cloud connection", icon: <Cloud size={20} />, title: "Connect your local computer to Zo", body: "zo-drive connects from your local terminal to this Zo Computer over its public HTTPS /drive address. You do not need SSH, Tailscale, or a Zo dashboard session on the local machine.", steps: ["Create a named, scoped key in Zo Drive > API Keys for this computer.", "Run zo-drive configure. It asks for the public Zo Drive URL and your device key without exposing either in shell history.", "The command saves the connection in ~/.config/zo-drive/config.json with owner-only permissions. Future zo-drive commands use it automatically."] },
        { id: "cli", eyebrow: "Command line", icon: <Terminal size={20} />, title: "Manage files with zo-drive", body: "Once configured, check Drive health, upload, inspect, verify, move, and safely remove files from your private Drive.", steps: ["Run zo-drive health to check API latency, authenticated access, storage, and filesystem capacity.", "Run zo-drive upload with a local file path and optional destination folder.", "Use stat for metadata, exists for scriptable checks, mv with an exact destination key, and rm to move a file to Trash."] },
        { id: "remote-files", eyebrow: "Remote file operations", icon: <Folder size={20} />, title: "Work with your Drive like a real filesystem", body: "The CLI covers the practical file operations needed by terminals, scripts, and build jobs without exposing a filesystem mount or SSH session.", steps: ["Use mkdir to create folders, ls to inspect folders, and download to bring a selected file back to the machine.", "Use cp for a server-side copy and mv to move a file by its exact Drive key.", "Use ls flags such as -l, -t, -S, -R, and -a when you need a script-friendly view of Drive content."] },
        { id: "safe-operations", eyebrow: "Safe delivery", icon: <ShieldCheck size={20} />, title: "Validate before transferring or deleting", body: "Dry runs, progress reporting, and Trash-backed removal make CLI work safer when a script is about to move or transfer important data.", steps: ["Use zo-drive upload --dry-run or download --dry-run to validate the connection, quota, destination, and file before data moves.", "Use the live progress bar for large interactive uploads.", "Use rm for a reversible move to Trash; permanent deletion stays a deliberate GUI action."] },
        { id: "health", eyebrow: "Operations", icon: <Cloud size={20} />, title: "Check health and capacity before automation", body: "The CLI can verify that your credential, Drive API, storage, and backing filesystem are ready before a job depends on them.", steps: ["Run zo-drive health before a scheduled or important transfer.", "Run zo-drive usage or zo-drive usage --json to inspect storage consumption.", "Use zo-drive status when you only need the saved connection and authenticated account state."] },
        { id: "automation", eyebrow: "Automation", icon: <Code2 size={20} />, title: "Build reliable scripts around Drive", body: "Use JSON output, exact-file checks, and the TypeScript SDK when a local script or application needs predictable Drive behaviour.", steps: ["Use exists for an exit-code check and stat --json for structured metadata.", "Use scoped API keys per machine or automation so access can be revoked without affecting other devices.", "Move to the shared TypeScript SDK when your job needs reusable upload, list, or download logic in code."] },
        { id: "zo-originals-cli", eyebrow: "Zo Originals", icon: <MonitorUp size={20} />, title: "Operate Zo Originals from the CLI", body: "The CLI now provides authenticated CRUD commands for Zo Paste, Zo Transfer, Zo Shared Drives, Zo Databases, and Zo Functions. ZominAI remains deliberately browser-only while its product direction evolves.", steps: ["Use paste to create, update, inspect, share, and remove private snippets with language and tag metadata.", "Use transfer to create, rotate, list, and revoke controlled file-delivery links; use shared to manage invitations, mounts, peers, and mounted-folder files.", "Use database and function for private database engines, queries, credentials, handlers, runs, schedules, and source updates. Add --json when a script needs structured output."] },
        { id: "updates", eyebrow: "CLI releases", icon: <RefreshCw size={20} />, title: `CLI version ${CLI_VERSION}`, body: "The local CLI has its own release track. Pull and rebuild when a CLI update is released; you do not need to install it again.", steps: ["Run zo-drive --version to check the installed CLI version.", "Use the main branch when you want the latest changes as they are pushed.", "Use a cli-v Git release tag when you want a fixed, reproducible CLI version on a machine."] },
        { id: "sdk", eyebrow: "TypeScript SDK", icon: <Database size={20} />, title: "Automate uploads in code", body: "Use the shared @zo-drive/sdk package from this repository for scripts, jobs and app integrations.", steps: ["Build the workspace SDK with pnpm --filter @zo-drive/sdk build.", "Store a scoped API key in your automation secret manager and send it as a Bearer token.", "Create ZoDriveClient with your Drive URL, then call upload with a Blob, filename and optional folder path."] }
      ];
  const securityBody = isGui
    ? "Your Drive is private by default. Treat every share link as a deliberate access grant: use passcodes and expiry where appropriate, and revoke links that are no longer needed."
    : "Use one scoped API key per machine or automation. Zo Drive shows a key once, stores only its hash, and lets you revoke it from API Keys without changing your password or interrupting other devices.";
  const navigationGroups = isGui
    ? [
        { label: "Zo Drive", sections: sections.slice(0, 3) },
        { label: "Zo Originals", sections: sections.slice(3, 8) },
        { label: "More from Zo", sections: sections.slice(8) }
      ]
    : [{ label: "Documentation", sections }];

  return <main className="min-h-screen bg-[#fbfcfe] text-slate-900"><header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/90 backdrop-blur"><div className="mx-auto flex max-w-7xl items-center gap-3 px-5 py-4 sm:px-8"><DriveMark compact /><a className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-950" href={landingUrl()}><ArrowLeft size={16} /> Landing page</a></div></header><div className="mx-auto grid max-w-7xl gap-12 px-5 py-14 sm:px-8 lg:grid-cols-[14rem_minmax(0,1fr)] lg:py-20"><aside className="hidden lg:block"><div className="sticky top-24"><p className="mb-3 px-3 text-xs font-bold uppercase tracking-[0.14em] text-slate-400">Mode</p><DriveModeSwitch mode={mode} /><nav aria-label="Documentation sections" className="mt-7 space-y-5 text-sm">{navigationGroups.map((group) => <div key={group.label}><p className="mb-2 px-3 text-xs font-bold uppercase tracking-[0.14em] text-slate-400">{group.label}</p><div className="space-y-1">{group.sections.map((section) => <a className="block rounded-lg px-3 py-2 font-semibold text-slate-600 hover:bg-blue-50 hover:text-blue-700" href={`#${section.id}`} key={section.id}>{section.title}</a>)}</div></div>)}<div className="space-y-1"><p className="mb-2 px-3 text-xs font-bold uppercase tracking-[0.14em] text-slate-400">Release notes</p><a className="block rounded-lg px-3 py-2 font-semibold text-slate-600 hover:bg-blue-50 hover:text-blue-700" href="#changelog">Changelog</a><a className="block rounded-lg px-3 py-2 font-semibold text-slate-600 hover:bg-blue-50 hover:text-blue-700" href="#security">Security notes</a></div></nav></div></aside><div className="min-w-0"><div className="mb-7 lg:hidden"><p className="mb-3 text-xs font-bold uppercase tracking-[0.14em] text-slate-400">Mode</p><DriveModeSwitch mode={mode} /></div><p className="text-sm font-bold uppercase tracking-[0.15em] text-blue-600">Zo Drive {mode} documentation · v{isGui ? GUI_VERSION : CLI_VERSION}</p><h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-[-0.04em] text-slate-950 sm:text-5xl">{hero.title}</h1><p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">{hero.body}</p><div className={`mt-10 grid gap-4 sm:grid-cols-2 ${sections.length >= 3 ? "lg:grid-cols-3" : ""}`}>{sections.map((section) => <a className="rounded-2xl border border-slate-200 bg-white p-5 transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-lg hover:shadow-blue-950/5" href={`#${section.id}`} key={section.id}><span className="grid size-9 place-items-center rounded-xl bg-blue-50 text-blue-700">{section.icon}</span><p className="mt-4 text-sm font-semibold text-slate-950">{section.eyebrow}</p><p className="mt-1 text-xs leading-5 text-slate-500">{section.title}</p></a>)}<a className="rounded-2xl border border-slate-200 bg-white p-5 transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-lg hover:shadow-blue-950/5" href="#changelog"><span className="grid size-9 place-items-center rounded-xl bg-blue-50 text-blue-700"><ScrollText size={20} /></span><p className="mt-4 text-sm font-semibold text-slate-950">Release history</p><p className="mt-1 text-xs leading-5 text-slate-500">Read {isGui ? "GUI" : "CLI"} changelog</p></a></div>{sections.map((section) => <section className="scroll-mt-24 border-b border-slate-200 py-14" id={section.id} key={section.id}><div className="flex items-center gap-3 text-blue-700"><span className="grid size-10 place-items-center rounded-xl bg-blue-100">{section.icon}</span><p className="text-sm font-bold uppercase tracking-[0.14em]">{section.eyebrow}</p></div><h2 className="mt-5 text-3xl font-semibold tracking-tight text-slate-950">{section.title}</h2><p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">{section.body}</p><ol className="mt-7 space-y-3">{section.steps.map((step, stepIndex) => <li className="flex gap-3 text-sm leading-6 text-slate-700" key={step}><span className="grid size-6 shrink-0 place-items-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">{stepIndex + 1}</span><span>{step}</span></li>)}</ol>{section.id === "installation" && <div className="mt-8"><CodeBlock label="Install the zo-drive command" code={cliInstall} /></div>}{section.id === "connection" && <div className="mt-8"><CodeBlock label="Connect this terminal to your Zo Drive cloud" code={cliConnect} /></div>}{section.id === "cli" && <div className="mt-8"><CodeBlock label="Upload a file" code={cliUpload} /></div>}{section.id === "updates" && <div className="mt-8 space-y-4"><CodeBlock label="Update to the latest pushed CLI version" code={cliUpdate} /><CodeBlock label="Pin a tagged CLI release" code={cliRelease} /></div>}{section.id === "sdk" && <div className="mt-8"><CodeBlock label="upload.ts" code={sdkUpload} /></div>}</section>)}<section className="scroll-mt-24 border-b border-slate-200 py-14" id="changelog"><div className="flex items-center gap-3 text-blue-700"><span className="grid size-10 place-items-center rounded-xl bg-blue-100"><ScrollText size={20} /></span><p className="text-sm font-bold uppercase tracking-[0.14em]">Release history</p></div><h2 className="mt-5 text-3xl font-semibold tracking-tight text-slate-950">{isGui ? "GUI changelog" : "CLI changelog"}</h2><p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">Each product has its own version and release history. Read the newest entry first; a patch is a backwards-compatible fix or documentation update, while a minor or major release introduces a capability or breaking change.</p><div className="mt-8 space-y-4">{changelog.map((release) => <article className="rounded-2xl border border-slate-200 bg-white p-5" key={release.version}><div className="flex flex-wrap items-baseline justify-between gap-2"><h3 className="text-lg font-semibold text-slate-950">{isGui ? "GUI" : "CLI"} {release.version}</h3><p className="text-sm font-medium text-slate-500">{release.date}</p></div><ul className="mt-4 space-y-2 text-sm leading-6 text-slate-600">{release.changes.map((change) => <li className="flex gap-2" key={change}><span className="mt-2 size-1.5 shrink-0 rounded-full bg-blue-500" /><span>{change}</span></li>)}</ul></article>)}</div></section><section className="scroll-mt-24 py-14" id="security"><p className="text-sm font-bold uppercase tracking-[0.15em] text-blue-600">Security notes</p><h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">{isGui ? "Keep access deliberate." : "Treat each device key like a password."}</h2><p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">{securityBody}</p></section></div></div></main>;
}

function DocsChangelogPage({ mode }: { mode: "gui" | "cli" }) {
  const isGui = mode === "gui";
  const product = isGui ? "GUI" : "CLI";
  const version = isGui ? GUI_VERSION : CLI_VERSION;
  const changelog = isGui ? GUI_CHANGELOG : CLI_CHANGELOG;

  return <main className="min-h-screen bg-[#fbfcfe] text-slate-900"><header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/90 backdrop-blur"><div className="mx-auto flex max-w-7xl items-center gap-3 px-5 py-4 sm:px-8"><DriveMark compact /><a className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-950" href={landingUrl()}><ArrowLeft size={16} /> Landing page</a><a className="ml-auto inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700" href={docsUrl(mode)}><ArrowLeft size={16} /> Documentation</a></div></header><div className="mx-auto grid max-w-7xl gap-12 px-5 py-14 sm:px-8 lg:grid-cols-[14rem_minmax(0,1fr)] lg:py-20"><aside className="hidden lg:block"><div className="sticky top-24"><p className="mb-3 px-3 text-xs font-bold uppercase tracking-[0.14em] text-slate-400">Mode</p><DriveModeSwitch mode={mode} page="changelog" guiHref={docsUrl("gui", "changelog")} /><nav className="mt-7 space-y-1 text-sm"><p className="mb-3 px-3 text-xs font-bold uppercase tracking-[0.14em] text-slate-400">Documentation</p><a className="block rounded-lg px-3 py-2 font-semibold text-slate-600 hover:bg-blue-50 hover:text-blue-700" href={docsUrl(mode)}>Guide</a><a aria-current="page" className="block rounded-lg bg-blue-50 px-3 py-2 font-semibold text-blue-700" href={docsUrl(mode, "changelog")}>Changelog</a></nav></div></aside><div className="min-w-0"><div className="mb-7 lg:hidden"><p className="mb-3 text-xs font-bold uppercase tracking-[0.14em] text-slate-400">Mode</p><DriveModeSwitch mode={mode} page="changelog" guiHref={docsUrl("gui", "changelog")} /></div><div className="flex flex-wrap items-center gap-3 text-blue-700"><span className="grid size-11 place-items-center rounded-xl bg-blue-100"><ScrollText size={22} /></span><p className="text-sm font-bold uppercase tracking-[0.15em]">Release history</p><span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold">Latest: v{version}</span></div><h1 className="mt-6 text-4xl font-semibold tracking-[-0.04em] text-slate-950 sm:text-5xl">{product} changelog</h1><p className="mt-5 max-w-3xl text-lg leading-8 text-slate-600">A chronological record of {isGui ? "browser" : "command-line"} releases. The latest version is shown first.</p><div className="mt-10 space-y-4">{changelog.map((release) => <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" key={release.version}><div className="flex flex-wrap items-baseline justify-between gap-2"><h2 className="text-xl font-semibold text-slate-950">{product} {release.version}</h2><p className="text-sm font-medium text-slate-500">{release.date}</p></div><ul className="mt-5 space-y-3 text-sm leading-6 text-slate-600">{release.changes.map((change) => <li className="flex gap-3" key={change}><span className="mt-2.5 size-1.5 shrink-0 rounded-full bg-blue-500" /><span>{change}</span></li>)}</ul></article>)}</div></div></div></main>;
}

function ZominAiDocsPage() {
  const sections = [
    { id: "local", eyebrow: "Private by design", icon: <Cpu size={20} />, title: "Run ZominAI on your Zo Computer", body: "ZominAI sends messages and approved Drive-tool results only to models loaded on your Zo Computer. The authenticated Zo Drive gateway keeps the runtime port private while serving your signed-in devices.", steps: ["Open ZominAI from the private Zo Drive workspace on web, iPhone, or Android.", "Choose any loaded model from the selector below the ZominAI name; the choice is saved in this browser.", "The header badge is green only when the private runtime responds through the authenticated gateway."] },
    { id: "setup", eyebrow: "Setup", icon: <Download size={20} />, title: "Start Bonsai 8B on your Zo Computer", body: "Install llama.cpp on the Zo Computer that runs Zo Drive, then start Bonsai 8B on its protected loopback endpoint. The first model download is about 1.15 GB.", steps: ["Install llama.cpp on the Zo Computer.", "Run the supplied Bonsai 8B command from ZominAI > Install ZominAI.", "Return to Verify install after the model starts, then use ZominAI from any signed-in device."] },
    { id: "drive-tools", eyebrow: "Read-only tools", icon: <ShieldCheck size={20} />, title: "Ask about your Drive without granting write access", body: "When a signed-in user asks about Drive data, ZominAI may browse or search files, read supported text and Zo-native content, inspect storage and file counts, inspect database schemas, and run read-only database queries. These are built into Zo Drive, so MCP is not required. Binary files and all write operations remain blocked.", steps: ["Ask a question about a file, folder, storage, or database in the chat drawer.", "ZominAI calls or prefetches the relevant authenticated read-only tool when it needs current Drive context.", "Review its response; it must not claim to access Drive data unless a tool supplied it."] },
    { id: "history", eyebrow: "Conversations", icon: <History size={20} />, title: "Control instructions and context", body: "Chat titles, messages, custom system instructions, timestamps, response metrics, and the drawer width are stored in the browser. System instructions are limited to 2,000 characters and cannot override the private read-only boundary.", steps: ["Customise response style under ZominAI settings, or restore the concise default.", "Open History to switch, rename, or delete local conversations.", "Use Compact when the context meter is high; it preserves recent messages and replaces older context with a local summary."] },
    { id: "releases", eyebrow: "Independent releases", icon: <ScrollText size={20} />, title: `ZominAI version ${ZOMINAI_VERSION}`, body: "ZominAI has its own release line. A ZominAI-only change uses the zominai-v Git tag and does not require the Zo Drive GUI version to change unless its browser integration also changes.", steps: ["Check this page for the active ZominAI version.", "Use zominai-v release tags to trace a ZominAI release.", "Read the ZominAI changelog for local-runtime, tool, privacy, and conversation changes."] }
  ];

  return <main className="min-h-screen bg-[#f7fcfd] text-slate-900"><header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/90 backdrop-blur"><div className="mx-auto flex max-w-7xl items-center gap-3 px-5 py-4 sm:px-8"><DriveMark compact /><a className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-950" href={landingUrl()}><ArrowLeft size={16} /> Landing page</a><a className="ml-auto inline-flex items-center gap-2 rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-2 text-sm font-semibold text-cyan-800 shadow-sm transition hover:bg-cyan-100" href={zominAiDocsUrl("changelog")}><ScrollText size={16} /> Changelog <span className="rounded bg-white px-1.5 py-0.5 text-xs font-bold text-cyan-900">v{ZOMINAI_VERSION}</span></a></div></header><div className="mx-auto grid max-w-7xl gap-12 px-5 py-14 sm:px-8 lg:grid-cols-[14rem_minmax(0,1fr)] lg:py-20"><aside className="hidden lg:block"><div className="sticky top-24"><p className="mb-3 px-3 text-xs font-bold uppercase tracking-[0.14em] text-slate-400">Product</p><ZominAiDocsModeSwitch /><nav className="mt-7 space-y-1 text-sm"><p className="mb-3 px-3 text-xs font-bold uppercase tracking-[0.14em] text-slate-400">ZominAI</p>{sections.map((section) => <a className="block rounded-lg px-3 py-2 font-semibold text-slate-600 hover:bg-cyan-50 hover:text-cyan-800" href={`#${section.id}`} key={section.id}>{section.title}</a>)}<a className="block rounded-lg px-3 py-2 font-semibold text-slate-600 hover:bg-cyan-50 hover:text-cyan-800" href="#changelog">Changelog</a><a className="mt-4 block rounded-lg px-3 py-2 font-semibold text-slate-600 hover:bg-cyan-50 hover:text-cyan-800" href="#privacy">Privacy boundary</a></nav></div></aside><div className="min-w-0"><div className="mb-7 lg:hidden"><p className="mb-3 text-xs font-bold uppercase tracking-[0.14em] text-slate-400">Product</p><ZominAiDocsModeSwitch /></div><p className="text-sm font-bold uppercase tracking-[0.15em] text-cyan-700">ZominAI documentation · v{ZOMINAI_VERSION}</p><div className="mt-3 flex flex-wrap items-center gap-3"><img className="size-12 rounded-2xl object-cover shadow-sm" src={zominAiButtonUrl} alt="ZominAI Pegasus" /><h1 className="text-4xl font-semibold tracking-[-0.04em] text-slate-950 sm:text-5xl">Private local AI for your Drive.</h1></div><p className="mt-5 max-w-3xl text-lg leading-8 text-slate-600">ZominAI, pronounced ZOH-min A.I., pairs a local Bonsai runtime with deliberately read-only Zo Drive context. Inspired by Google Gemini.</p><div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{sections.map((section) => <a className="rounded-2xl border border-slate-200 bg-white p-5 transition hover:-translate-y-0.5 hover:border-cyan-200 hover:shadow-lg hover:shadow-cyan-950/5" href={`#${section.id}`} key={section.id}><span className="grid size-9 place-items-center rounded-xl bg-cyan-50 text-cyan-800">{section.icon}</span><p className="mt-4 text-sm font-semibold text-slate-950">{section.eyebrow}</p><p className="mt-1 text-xs leading-5 text-slate-500">{section.title}</p></a>)}</div>{sections.map((section) => <section className="scroll-mt-24 border-b border-slate-200 py-14" id={section.id} key={section.id}><div className="flex items-center gap-3 text-cyan-800"><span className="grid size-10 place-items-center rounded-xl bg-cyan-100">{section.icon}</span><p className="text-sm font-bold uppercase tracking-[0.14em]">{section.eyebrow}</p></div><h2 className="mt-5 text-3xl font-semibold tracking-tight text-slate-950">{section.title}</h2><p className="mt-3 max-w-3xl text-base leading-7 text-slate-600">{section.body}</p><ol className="mt-7 space-y-3">{section.steps.map((step, index) => <li className="flex gap-3 text-sm leading-6 text-slate-700" key={step}><span className="grid size-6 shrink-0 place-items-center rounded-full bg-cyan-50 text-xs font-bold text-cyan-800">{index + 1}</span><span>{step}</span></li>)}</ol>{section.id === "setup" && <div className="mt-8"><CodeBlock label="macOS local runtime" code={`brew install llama.cpp\n${zominAiRuntimeCommand}`} /></div>}</section>)}<section className="scroll-mt-24 border-b border-slate-200 py-14" id="changelog"><div className="flex items-center gap-3 text-cyan-800"><span className="grid size-10 place-items-center rounded-xl bg-cyan-100"><ScrollText size={20} /></span><p className="text-sm font-bold uppercase tracking-[0.14em]">Release history</p></div><h2 className="mt-5 text-3xl font-semibold tracking-tight text-slate-950">ZominAI changelog</h2><p className="mt-3 max-w-3xl text-base leading-7 text-slate-600">ZominAI’s release history is separate from Zo Drive’s GUI and CLI histories.</p><div className="mt-8 space-y-4">{ZOMINAI_CHANGELOG.map((release) => <article className="rounded-2xl border border-slate-200 bg-white p-5" key={release.version}><div className="flex flex-wrap items-baseline justify-between gap-2"><h3 className="text-lg font-semibold text-slate-950">ZominAI {release.version}</h3><p className="text-sm font-medium text-slate-500">{release.date}</p></div><ul className="mt-4 space-y-2 text-sm leading-6 text-slate-600">{release.changes.map((change) => <li className="flex gap-2" key={change}><span className="mt-2 size-1.5 shrink-0 rounded-full bg-cyan-600" /><span>{change}</span></li>)}</ul></article>)}</div></section><section className="scroll-mt-24 py-14" id="privacy"><p className="text-sm font-bold uppercase tracking-[0.15em] text-cyan-700">Privacy boundary</p><h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">Local inference, constrained access.</h2><p className="mt-4 max-w-3xl text-base leading-7 text-slate-600">The configured runtime must be localhost or 127.0.0.1. ZominAI settings and chat history stay in the browser, and the only Drive context it can receive comes from authenticated, read-only tools.</p></section></div></div></main>;
}

function ZominAiDocsChangelogPage() {
  return <main className="min-h-screen bg-[#f7fcfd] text-slate-900"><header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/90 backdrop-blur"><div className="mx-auto flex max-w-7xl items-center gap-3 px-5 py-4 sm:px-8"><DriveMark compact /><a className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-950" href={landingUrl()}><ArrowLeft size={16} /> Landing page</a><a className="ml-auto inline-flex items-center gap-2 rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-2 text-sm font-semibold text-cyan-800 shadow-sm transition hover:bg-cyan-100" href={zominAiDocsUrl()}><ArrowLeft size={16} /> Documentation</a></div></header><div className="mx-auto grid max-w-7xl gap-12 px-5 py-14 sm:px-8 lg:grid-cols-[14rem_minmax(0,1fr)] lg:py-20"><aside className="hidden lg:block"><div className="sticky top-24"><p className="mb-3 px-3 text-xs font-bold uppercase tracking-[0.14em] text-slate-400">Product</p><ZominAiDocsModeSwitch page="changelog" /><nav className="mt-7 space-y-1 text-sm"><p className="mb-3 px-3 text-xs font-bold uppercase tracking-[0.14em] text-slate-400">ZominAI</p><a className="block rounded-lg px-3 py-2 font-semibold text-slate-600 hover:bg-cyan-50 hover:text-cyan-800" href={zominAiDocsUrl()}>Guide</a><a aria-current="page" className="block rounded-lg bg-cyan-50 px-3 py-2 font-semibold text-cyan-800" href={zominAiDocsUrl("changelog")}>Changelog</a></nav></div></aside><div className="min-w-0"><div className="mb-7 lg:hidden"><p className="mb-3 text-xs font-bold uppercase tracking-[0.14em] text-slate-400">Product</p><ZominAiDocsModeSwitch page="changelog" /></div><div className="flex flex-wrap items-center gap-3 text-cyan-800"><span className="grid size-11 place-items-center rounded-xl bg-cyan-100"><ScrollText size={22} /></span><p className="text-sm font-bold uppercase tracking-[0.15em]">Release history</p><span className="rounded-full bg-cyan-50 px-3 py-1 text-xs font-bold">Latest: v{ZOMINAI_VERSION}</span></div><h1 className="mt-6 text-4xl font-semibold tracking-[-0.04em] text-slate-950 sm:text-5xl">ZominAI changelog</h1><p className="mt-5 max-w-3xl text-lg leading-8 text-slate-600">A chronological record of ZominAI releases. The latest version is shown first.</p><div className="mt-10 space-y-4">{ZOMINAI_CHANGELOG.map((release) => <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" key={release.version}><div className="flex flex-wrap items-baseline justify-between gap-2"><h2 className="text-xl font-semibold text-slate-950">ZominAI {release.version}</h2><p className="text-sm font-medium text-slate-500">{release.date}</p></div><ul className="mt-5 space-y-3 text-sm leading-6 text-slate-600">{release.changes.map((change) => <li className="flex gap-3" key={change}><span className="mt-2.5 size-1.5 shrink-0 rounded-full bg-cyan-600" /><span>{change}</span></li>)}</ul></article>)}</div></div></div></main>;
}

function DriveGate({ client, authClient, fallback }: { client: DriveClient; authClient: AuthClient; fallback?: React.ReactNode }) {
  const queryClient = useQueryClient();
  const authQuery = useQuery({ queryKey: ["auth-status"], queryFn: () => authClient.getAuthStatus(), retry: false });
  const logoutMutation = useMutation({
    mutationFn: () => authClient.logout(),
    onSuccess: async () => {
      useDriveUi.getState().setCurrentPath("");
      await queryClient.invalidateQueries();
      toast.success("Signed out");
    },
    onError: () => toast.error("Could not sign out")
  });

  if (authQuery.isPending) return <AuthLoading />;
  if (authQuery.isError || !authQuery.data) return <AuthUnavailable onRetry={() => void authQuery.refetch()} />;
  if (!authQuery.data.authenticated || !authQuery.data.user) {
    if (fallback) return <>{fallback}</>;
    return <AuthScreen auth={authQuery.data} client={authClient} onAuthenticated={() => void authQuery.refetch()} />;
  }
  return <DriveScreen authClient={authClient} client={client} user={authQuery.data.user} onAccountDeleted={() => void authQuery.refetch()} onSignOut={() => logoutMutation.mutate()} />;
}

function AuthLoading() {
  return <main className="grid min-h-screen place-items-center bg-[#f8faff] text-sm text-slate-500"><span className="flex items-center gap-2"><LoaderCircle className="animate-spin" size={18} /> Checking your private drive…</span></main>;
}

function AuthUnavailable({ onRetry }: { onRetry: () => void }) {
  return <main className="grid min-h-screen place-items-center bg-[#f8faff] p-5 text-center text-slate-700"><div><LockKeyhole className="mx-auto mb-3 text-blue-600" size={32} /><h1 className="text-xl font-semibold text-slate-900">Zo Drive is unavailable</h1><p className="mt-2 text-sm text-slate-500">We could not check your sign-in session.</p><button className="mt-5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700" onClick={onRetry}>Try again</button></div></main>;
}

function AuthScreen({ auth, client, onAuthenticated }: { auth: AuthStatus; client: AuthClient; onAuthenticated: () => void }) {
  const isBootstrap = auth.registrationAllowed;
  const demoAccount = isBootstrap ? null : auth.demoAccount;
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const mutation = useMutation({
    mutationFn: () => isBootstrap ? client.registerInitialUser({ username, password }) : client.login({ username, password }),
    onSuccess: () => {
      setError(null);
      onAuthenticated();
    },
    onError: (caught) => setError(caught instanceof Error ? caught.message : "Could not continue")
  });

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    mutation.mutate();
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[#f8faff] p-5 text-slate-800">
      <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-7 shadow-sm sm:p-9">
        <div className="flex items-center gap-3 text-xl font-semibold tracking-tight text-slate-900">
          <span className="relative block h-11 w-11 shrink-0" role="img" aria-label="Zo Drive Pegasus on a cloud"><img className="absolute inset-0 h-full w-full" src={driveCloudLogoUrl} alt="" /><img className="absolute left-[5.94%] top-0 h-[88.44%] w-[88.44%]" src={drivePegasusLogoUrl} alt="" /></span>
          Zo Drive
        </div>
        <div className="mt-8"><LockKeyhole className="mb-3 text-blue-600" size={24} /><h1 className="text-2xl font-semibold tracking-tight text-slate-900">{isBootstrap ? "Create your owner account" : "Sign in to Zo Drive"}</h1><p className="mt-2 text-sm leading-6 text-slate-500">{isBootstrap ? "No owner account exists yet. Create one to initialise this private drive. Registration closes immediately after this." : "Use your account credentials to open this private Drive."}</p></div>
        {demoAccount && <section aria-label="Demo account credentials" className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4"><div className="flex items-start gap-3"><ShieldAlert className="mt-0.5 shrink-0 text-amber-600" size={19} /><div className="min-w-0 flex-1"><h2 className="text-sm font-semibold text-amber-950">Public demo account</h2><p className="mt-1 text-xs leading-5 text-amber-800">Anyone can use these read-only credentials to browse and download this Drive.</p><dl className="mt-3 grid grid-cols-[5rem_minmax(0,1fr)] gap-x-3 gap-y-2 text-sm"><dt className="text-amber-700">Username</dt><dd className="break-all font-mono font-semibold text-amber-950">{demoAccount.username}</dd><dt className="text-amber-700">Password</dt><dd className="break-all font-mono font-semibold text-amber-950">{demoAccount.password}</dd></dl><button className="mt-3 rounded-lg border border-amber-300 bg-white px-3 py-2 text-xs font-semibold text-amber-900 hover:bg-amber-100" onClick={() => { setUsername(demoAccount.username); setPassword(demoAccount.password); }} type="button">Use demo credentials</button></div></div></section>}
        <form className="mt-6 space-y-4" onSubmit={submit}>
          <label className="block text-sm font-medium text-slate-700">Username<input aria-label="Username" autoComplete="username" className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" type="text" minLength={3} maxLength={32} value={username} onChange={(event) => setUsername(event.target.value)} required /></label>
          <label className="block text-sm font-medium text-slate-700">Password<input aria-label="Password" autoComplete={isBootstrap ? "new-password" : "current-password"} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" type="password" minLength={6} value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
          {isBootstrap && <p className="text-xs leading-5 text-slate-500">Use at least 6 characters. This is the only account that can open this drive.</p>}
          {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <button className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300" type="submit" disabled={mutation.isPending}>{mutation.isPending ? "Please wait…" : isBootstrap ? "Create owner account" : "Sign in"}</button>
        </form>
      </section>
    </main>
  );
}

function AccountScreen({ user, client, onAccountDeleted }: { user: DriveUser; client: AuthClient; onAccountDeleted: () => void }) {
  const queryClient = useQueryClient();
  const isOwner = user.isOwner !== false;
  const [username, setUsername] = useState(user.username);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [deletePassword, setDeletePassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const profileMutation = useMutation({
    mutationFn: () => client.updateProfile({ username }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["auth-status"] });
      toast.success("Profile updated");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not update profile")
  });
  const passwordMutation = useMutation({
    mutationFn: () => client.changePassword({ currentPassword, newPassword }),
    onSuccess: () => {
      setCurrentPassword("");
      setNewPassword("");
      toast.success("Password updated");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not update password")
  });
  const deleteMutation = useMutation({
    mutationFn: () => client.deleteAccount({ password: deletePassword, confirmation: "DELETE MY DRIVE" }),
    onSuccess: () => {
      toast.success("Account and files permanently deleted");
      onAccountDeleted();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not delete the account")
  });

  return (
    <div className="w-full space-y-6">
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 px-6 py-8 text-white"><span className="inline-flex items-center gap-2 rounded-full border border-cyan-200/20 bg-cyan-200/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-100"><UserRound size={14} /> {isOwner ? "Owner account" : "Account profile"}</span><h2 className="mt-4 text-3xl font-semibold tracking-tight">{isOwner ? "Your private Drive, under your control." : "Your Drive sign-in, under your control."}</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">{isOwner ? "Manage the owner sign-in details for this Drive. Device API keys remain separate, so a lost machine can be revoked without changing your password." : "Manage your sign-in details. User access and device API keys are managed separately."}</p></div>
        <div className="space-y-5 p-5">
          {user.isDemo && <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900"><strong>Demo account:</strong> your public sign-in details and read-only access are managed by a super user.</div>}
          {!user.isDemo && <SettingsCard icon={<UserRound size={20} />} title="Profile" description="Your username is how you sign in.">
            <form className="flex flex-col gap-3 sm:flex-row" onSubmit={(event) => { event.preventDefault(); profileMutation.mutate(); }}><input aria-label="Account username" className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" minLength={3} maxLength={32} value={username} onChange={(event) => setUsername(event.target.value)} required /><button className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:bg-slate-300" disabled={profileMutation.isPending || username === user.username} type="submit">Save username</button></form>
          </SettingsCard>}
          {!user.isDemo && <SettingsCard icon={<KeyRound size={20} />} title="Password" description="Use a password you will remember. Minimum 6 characters.">
            <form className="grid gap-3 sm:grid-cols-2" onSubmit={(event) => { event.preventDefault(); passwordMutation.mutate(); }}><input aria-label="Current password" className="rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" type="password" minLength={6} placeholder="Current password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required /><input aria-label="New password" className="rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" type="password" minLength={6} placeholder="New password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required /><button className="w-fit rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:border-blue-300 hover:text-blue-700 disabled:text-slate-400 sm:col-span-2" disabled={passwordMutation.isPending} type="submit">Update password</button></form>
          </SettingsCard>}
          <SettingsCard icon={<HardDrive size={20} />} title="Drive data" description="Your files are private and stored in this Zo Drive data root.">
            <div className="rounded-lg bg-slate-50 px-3 py-2.5 text-sm text-slate-600"><span className="font-medium text-slate-700">Account:</span> {user.username} <span className="mx-2 text-slate-300">•</span> {isOwner ? "Private owner drive" : user.access === "read" ? "Read-only member access" : "Read & write member access"}</div>
          </SettingsCard>
          {isOwner && <SettingsCard danger icon={<ShieldAlert size={20} />} title="Danger zone" description="Permanently delete this owner account and every file in its drive.">
            <div className="rounded-lg border border-red-100 bg-red-50 p-4"><p className="text-sm leading-6 text-red-800">This cannot be undone. Type <strong>DELETE MY DRIVE</strong> and enter your current password to continue.</p><div className="mt-3 grid gap-3 sm:grid-cols-2"><input aria-label="Delete confirmation" className="rounded-lg border border-red-200 bg-white px-3 py-2.5 outline-none focus:border-red-500 focus:ring-4 focus:ring-red-100" placeholder="DELETE MY DRIVE" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /><input aria-label="Delete account password" className="rounded-lg border border-red-200 bg-white px-3 py-2.5 outline-none focus:border-red-500 focus:ring-4 focus:ring-red-100" type="password" placeholder="Current password" value={deletePassword} onChange={(event) => setDeletePassword(event.target.value)} /><button className="w-fit rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-red-200 sm:col-span-2" disabled={confirmation !== "DELETE MY DRIVE" || deletePassword.length < 6 || deleteMutation.isPending} onClick={() => deleteMutation.mutate()}>Delete account and files</button></div></div>
          </SettingsCard>}
        </div>
      </section>
    </div>
  );
}

function UserAccessScreen({ client, currentUser }: { client: UserAccessClient; currentUser: DriveUser }) {
  const queryClient = useQueryClient();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [access, setAccess] = useState<AccountAccess>("write");
  const [role, setRole] = useState<AccountRole>("regular");
  const [isDemo, setIsDemo] = useState(false);
  const membersQuery = useQuery({ queryKey: ["account-members"], queryFn: () => client.listAccountMembers() });
  const hasDemoAccount = Boolean(membersQuery.data?.some((member) => member.isDemo));
  const createMutation = useMutation({
    mutationFn: () => client.createAccountMember({ username, password, access: isDemo ? "read" : access, role: isDemo ? "regular" : role, isDemo }),
    onSuccess: async () => {
      setUsername(""); setPassword(""); setAccess("write"); setRole("regular"); setIsDemo(false);
      await queryClient.invalidateQueries({ queryKey: ["account-members"] });
      toast.success("User added");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not add user")
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, changes }: { id: string; changes: { access?: AccountAccess; role?: AccountRole } }) => client.updateAccountMember(id, changes),
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ["account-members"] }); toast.success("Access updated"); },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not update access")
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => client.deleteAccountMember(id),
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ["account-members"] }); toast.success("User removed"); },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not remove user")
  });

  return <div className="w-full space-y-6">
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 px-6 py-8 text-white"><span className="inline-flex items-center gap-2 rounded-full border border-cyan-200/20 bg-cyan-200/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-100"><UsersRound size={14} /> Account access</span><h2 className="mt-4 text-3xl font-semibold tracking-tight">Manage who can use this Drive.</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">Every user signs in with their own password. Super users can add, change, and revoke access; the original owner is permanently protected.</p></div>
      <div role="alert" className="mx-5 mt-5 flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900"><ShieldAlert className="mt-0.5 shrink-0 text-amber-600" size={19} /><div><p className="text-sm font-semibold">Demo credentials are public</p><p className="mt-1 text-sm leading-6">When a demo account exists, its username and password appear on the sign-in page. Anyone who can reach that page can browse and download Drive content. Demo accounts are always regular and read only.</p></div></div>
      <div className="grid gap-6 p-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div>
          <div className="mb-4 flex items-center justify-between"><div><h3 className="font-semibold text-slate-900">Users with access</h3><p className="mt-1 text-sm text-slate-500">Read users can browse and download. Read & write users can manage Drive content.</p></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{membersQuery.data?.length ?? 0} users</span></div>
          {membersQuery.isLoading ? <div className="grid h-36 place-items-center text-sm text-slate-500"><LoaderCircle className="animate-spin" size={18} /></div> : membersQuery.isError ? <div className="rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">Could not load user access. <button className="font-semibold underline" onClick={() => void membersQuery.refetch()}>Try again</button></div> : <div className="overflow-hidden rounded-xl border border-slate-200"><div className="hidden grid-cols-[minmax(9rem,1.35fr)_9rem_9rem_5.5rem] gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-bold uppercase tracking-[0.1em] text-slate-400 md:grid"><span>User</span><span>Access</span><span>Role</span><span className="text-right">Actions</span></div>{(membersQuery.data ?? []).map((member) => <UserAccessRow currentUser={currentUser} key={member.id} member={member} onDelete={() => deleteMutation.mutate(member.id)} onUpdate={(changes) => updateMutation.mutate({ id: member.id, changes })} pending={updateMutation.isPending || deleteMutation.isPending} />)}</div>}
        </div>
        <form className="self-start rounded-xl border border-slate-200 bg-slate-50 p-5" onSubmit={(event) => { event.preventDefault(); createMutation.mutate(); }}><div className="flex items-center gap-2 text-slate-900"><Plus size={18} className="text-blue-600" /><h3 className="font-semibold">Add user</h3></div><p className="mt-1 text-sm leading-5 text-slate-500">Create a separate sign-in for this account.</p><label className={`mt-5 flex items-start gap-3 rounded-lg border bg-white p-3 ${hasDemoAccount ? "border-slate-200 text-slate-400" : "border-amber-200 text-slate-700"}`}><input aria-label="Demo account" checked={isDemo} className="mt-0.5 size-4 accent-amber-600" disabled={hasDemoAccount} onChange={(event) => setIsDemo(event.target.checked)} type="checkbox" /><span><span className="block text-sm font-semibold">Demo account</span><span className="mt-1 block text-xs leading-5">{hasDemoAccount ? "Remove the existing demo account before creating another." : "Show these credentials publicly on the sign-in page."}</span></span></label><label className="mt-4 block text-sm font-medium text-slate-700">Username<input aria-label="New user username" className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" minLength={3} maxLength={32} onChange={(event) => setUsername(event.target.value)} required value={username} /></label><label className="mt-4 block text-sm font-medium text-slate-700">{isDemo ? "Public demo password" : "Temporary password"}<input aria-label="New user password" className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" minLength={6} onChange={(event) => setPassword(event.target.value)} required type={isDemo ? "text" : "password"} value={password} /></label>{isDemo && <p className="mt-2 text-xs leading-5 text-amber-700">This password will be visible to every visitor on the sign-in page.</p>}<label className="mt-4 block text-sm font-medium text-slate-700">Drive access<select aria-label="New user access" className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 disabled:bg-slate-100 disabled:text-slate-400" disabled={isDemo} onChange={(event) => setAccess(event.target.value as AccountAccess)} value={isDemo ? "read" : access}><option value="read">Read only</option><option value="write">Read & write</option></select></label><label className="mt-4 block text-sm font-medium text-slate-700">Account role<select aria-label="New user role" className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 disabled:bg-slate-100 disabled:text-slate-400" disabled={isDemo} onChange={(event) => setRole(event.target.value as AccountRole)} value={isDemo ? "regular" : role}><option value="regular">Regular user</option><option value="super">Super user</option></select></label><button className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:bg-slate-300" disabled={createMutation.isPending} type="submit"><Plus size={17} /> {createMutation.isPending ? "Adding user…" : "Add user"}</button></form>
      </div>
    </section>
  </div>;
}

function UserAccessRow({ currentUser, member, onDelete, onUpdate, pending }: { currentUser: DriveUser; member: AccountMember; onDelete: () => void; onUpdate: (changes: { access?: AccountAccess; role?: AccountRole }) => void; pending: boolean }) {
  const protectedOwner = member.isOwner;
  const accessProtected = protectedOwner || member.isDemo;
  return <div className="grid gap-3 border-b border-slate-100 px-4 py-4 last:border-b-0 md:grid-cols-[minmax(9rem,1.35fr)_9rem_9rem_5.5rem] md:items-center"><div className="min-w-0"><p className="truncate font-medium text-slate-800">{member.username} {member.isDemo && <span className="ml-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700">Demo</span>} {member.id === currentUser.id && <span className="text-slate-400">(you)</span>}</p><p className="mt-1 text-xs text-slate-400">{protectedOwner ? "Original owner · permanently protected" : member.isDemo ? "Public credentials · access permanently read only" : `Created ${new Date(member.createdAt).toLocaleDateString()}`}</p></div><label className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-400 md:text-[0px]"><span className="md:hidden">Access</span><select aria-label={`${member.username} access`} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm font-medium text-slate-700 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 md:mt-0" disabled={accessProtected || pending} onChange={(event) => onUpdate({ access: event.target.value as AccountAccess })} value={member.access}><option value="read">Read only</option><option value="write">Read & write</option></select></label><label className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-400 md:text-[0px]"><span className="md:hidden">Role</span><select aria-label={`${member.username} role`} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm font-medium text-slate-700 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 md:mt-0" disabled={accessProtected || pending} onChange={(event) => onUpdate({ role: event.target.value as AccountRole })} value={member.role}><option value="regular">Regular</option><option value="super">Super</option></select></label><div className="flex justify-end"><button aria-label={`Remove ${member.username}`} className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:text-slate-200" disabled={protectedOwner || pending} onClick={() => { if (window.confirm(`Remove ${member.username}'s access to this Drive?`)) onDelete(); }} title={protectedOwner ? "The original owner cannot be removed" : "Remove user"} type="button"><Trash2 size={18} /></button></div></div>;
}

const driveThemeStorageKey = "zo-drive:theme:v1";

function readDriveTheme(): DriveTheme {
  const stored = window.localStorage.getItem(driveThemeStorageKey);
  if (stored === "google-drive" || stored === "zominai-drive") return "google-drive";
  return stored === "zo-computer" || stored === "zo-dark" || stored === "zo-light" || stored === "zo-system" ? stored : "zo-drive";
}

function ThemeScreen({ onThemeChange, theme }: { onThemeChange: (theme: DriveTheme) => void; theme: DriveTheme }) {
  const options: Array<{ description: string; id: DriveTheme; label: string }> = [
    { id: "zo-drive", label: "Zo Drive", description: "Keep the familiar blue workspace built for organising files and running Drive tools." },
    { id: "google-drive", label: "Google Drive", description: "Use a dark Google-colour workspace with Gemini-inspired red, yellow, green, and blue accents." },
    { id: "zo-computer", label: "Zo Computer", description: "Use Zo's black-and-white Pegasus direction with serif display type and an ink-forward workspace." },
    { id: "zo-light", label: "Zo Light", description: "Zo's built-in light appearance for a clean white workspace." },
    { id: "zo-dark", label: "Zo Dark", description: "Zo's built-in dark appearance for an ink-blue workspace." },
    { id: "zo-system", label: "Zo System", description: "Follow your device's light or dark appearance automatically." }
  ];

  return <div className="w-full space-y-6">
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="relative overflow-hidden bg-[#171512] px-6 py-8 text-[#f8f3e9]"><div className="absolute -right-12 -top-16 size-56 rounded-full border border-white/15" /><div className="absolute right-16 top-16 size-24 rounded-full border border-white/10" /><div className="relative max-w-2xl"><span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-stone-200"><Palette size={14} /> Appearance</span><h2 className="mt-4 font-serif text-4xl font-semibold tracking-tight">Choose your Drive theme.</h2><p className="mt-2 text-sm leading-6 text-stone-300">Choose a Drive-specific appearance or any built-in Zo appearance. This browser-local setting does not affect files, account access, or other users.</p></div></div>
      <ThemeOptions title="Zo Drive themes" options={options.slice(0, 3)} theme={theme} onThemeChange={onThemeChange} />
      <ThemeOptions title="Built-in Zo themes" options={options.slice(3)} theme={theme} onThemeChange={onThemeChange} />
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-4 text-xs leading-5 text-slate-500"><span>Zo Computer styling follows the Pegasus, black-and-white, serif-heading, and MonoLisa-oriented direction.</span><a className="inline-flex items-center gap-1 font-semibold text-slate-700 hover:text-slate-950" href="https://www.zo.computer/brand" rel="noreferrer" target="_blank">View Zo Computer brand guide <ExternalLink size={13} /></a></div>
    </section>
  </div>;
}

function ThemeOptions({ onThemeChange, options, theme, title }: { onThemeChange: (theme: DriveTheme) => void; options: Array<{ description: string; id: DriveTheme; label: string }>; theme: DriveTheme; title: string }) {
  return <section><div className="border-b border-slate-100 px-5 py-3"><p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">{title}</p></div><div className={`grid gap-5 p-5 ${options.length === 3 ? "lg:grid-cols-3" : "lg:grid-cols-2"}`}>{options.map((option) => {
        const selected = theme === option.id;
        const googleDrive = option.id === "google-drive";
        const zoComputer = option.id === "zo-computer";
        const dark = option.id === "zo-dark";
        const system = option.id === "zo-system";
        const previewClass = zoComputer ? "bg-[#f5f0e7] text-[#171512]" : dark ? "bg-[#0b1020] text-slate-100" : system ? "bg-gradient-to-br from-white via-white to-slate-950 text-slate-900" : googleDrive ? "bg-black text-white" : option.id === "zo-drive" ? "bg-[#f8faff] text-slate-800" : "bg-white text-slate-900";
        const lineClass = dark ? "bg-slate-700" : zoComputer ? "bg-stone-300" : googleDrive ? "bg-white/20" : "bg-slate-200";
        return <article className={`overflow-hidden rounded-2xl border-2 transition ${selected ? "border-slate-900 shadow-lg shadow-slate-950/10" : "border-slate-200 hover:border-slate-400"}`} key={option.id}><div className={`min-h-44 p-5 ${previewClass}`}><div className={`flex items-center gap-2 border-b pb-3 text-sm font-semibold ${dark || googleDrive ? "border-white/15" : zoComputer ? "border-stone-300 font-mono" : "border-slate-200"}`}><span className={`grid size-8 place-items-center rounded-lg ${dark ? "bg-violet-500 text-white" : zoComputer ? "bg-[#171512] text-white" : googleDrive ? "bg-[#4285f4] text-white" : option.id === "zo-drive" ? "bg-blue-600 text-white" : "bg-slate-900 text-white"}`}>{zoComputer ? <span className="font-serif text-lg leading-none">Z</span> : googleDrive ? <Palette size={17} /> : system ? <Settings2 size={17} /> : option.id === "zo-drive" ? <img className="size-5 object-contain" src={drivePegasusLogoUrl} alt="" /> : <Palette size={17} />}</span>{option.label}</div><div className="mt-5"><p className={`text-base font-semibold ${dark || googleDrive ? "text-white" : "text-current"}`}>{zoComputer ? "Run your life on Zo." : googleDrive ? "Google colour, focused work." : system ? "Adapts with your device." : dark ? "A calm workspace after dark." : "Your files, your way."}</p>{googleDrive ? <div className="mt-7 flex items-center gap-3"><span className="size-3 rounded-full bg-[#ea4335]" /><span className="size-3 rounded-full bg-[#fbbc04]" /><span className="size-3 rounded-full bg-[#34a853]" /><span className="size-3 rounded-full bg-[#4285f4]" /></div> : <><div className={`mt-4 h-2 w-3/4 rounded-full ${lineClass}`} /><div className={`mt-2 h-2 w-1/2 rounded-full ${lineClass}`} /></>}</div></div><div className="p-5"><div className="flex items-start justify-between gap-4"><p className="text-sm leading-6 text-slate-500">{option.description}</p>{selected && <span className="grid size-7 shrink-0 place-items-center rounded-full bg-slate-900 text-white"><Check size={16} /></span>}</div><button aria-pressed={selected} className={`mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition ${selected ? "bg-slate-100 text-slate-600" : "bg-slate-900 text-white hover:bg-slate-700"}`} onClick={() => onThemeChange(option.id)} type="button">{selected ? "Current theme" : `Use ${option.label}`}</button></div></article>;
      })}</div></section>;
}

function darkThemeCss(selector: string): string {
  return `${selector} { background: #0b1020; color: #e5e7eb; color-scheme: dark; }
${selector} .bg-white { background-color: #121a2a !important; }
${selector} .bg-slate-50, ${selector} .bg-slate-100, ${selector} .bg-blue-50, ${selector} .bg-\\[\\#f8faff\\] { background-color: #0f172a !important; }
${selector} .border-slate-100, ${selector} .border-slate-200, ${selector} .border-slate-300 { border-color: #263247 !important; }
${selector} .text-slate-900, ${selector} .text-slate-800, ${selector} .text-slate-700 { color: #f8fafc !important; }
${selector} .text-slate-600, ${selector} .text-slate-500, ${selector} .text-slate-400 { color: #aebbd0 !important; }
${selector} .bg-blue-600, ${selector} .bg-blue-700 { background-color: #7c3aed !important; }
${selector} .text-blue-600, ${selector} .text-blue-700 { color: #a78bfa !important; }
${selector} .hover\\:bg-blue-50:hover, ${selector} .hover\\:bg-slate-50:hover, ${selector} .hover\\:bg-slate-100:hover { background-color: #1b2740 !important; }`;
}

function DarkThemeStyles({ selector }: { selector: string }) {
  return <style>{darkThemeCss(selector)}</style>;
}

function DriveThemeStyles({ theme }: { theme: DriveTheme }) {
  if (theme === "zo-drive") return null;
  if (theme === "google-drive") return <style>{`
    [data-drive-theme="google-drive"] { --google-blue: #4285f4; --google-green: #34a853; --google-red: #ea4335; --google-yellow: #fbbc04; background: #000000 !important; color: #f8f9fa; color-scheme: dark; }
    [data-drive-theme="google-drive"] .bg-white { background-color: #101010 !important; }
    [data-drive-theme="google-drive"] .bg-slate-50, [data-drive-theme="google-drive"] .bg-slate-100, [data-drive-theme="google-drive"] .bg-\\[\\#f8faff\\] { background-color: #000000 !important; }
    [data-drive-theme="google-drive"] .bg-blue-50 { background: linear-gradient(90deg, rgba(234, 67, 53, 0.25), rgba(251, 188, 4, 0.24), rgba(52, 168, 83, 0.24), rgba(66, 133, 244, 0.28)) !important; }
    [data-drive-theme="google-drive"] .border-slate-100, [data-drive-theme="google-drive"] .border-slate-200, [data-drive-theme="google-drive"] .border-slate-300 { border-color: #303134 !important; }
    [data-drive-theme="google-drive"] .text-slate-900, [data-drive-theme="google-drive"] .text-slate-800, [data-drive-theme="google-drive"] .text-slate-700 { color: #f8f9fa !important; }
    [data-drive-theme="google-drive"] .text-slate-600, [data-drive-theme="google-drive"] .text-slate-500, [data-drive-theme="google-drive"] .text-slate-400 { color: #bdc1c6 !important; }
    [data-drive-theme="google-drive"] .bg-blue-600, [data-drive-theme="google-drive"] .bg-blue-700 { background: linear-gradient(105deg, var(--google-blue) 0 25%, var(--google-green) 25% 50%, var(--google-yellow) 50% 75%, var(--google-red) 75% 100%) !important; }
    [data-drive-theme="google-drive"] .text-blue-600, [data-drive-theme="google-drive"] .text-blue-700 { color: #8ab4f8 !important; }
    [data-drive-theme="google-drive"] > header { border-bottom: 3px solid transparent !important; border-image: linear-gradient(90deg, var(--google-red), var(--google-yellow), var(--google-green), var(--google-blue)) 1 !important; }
    [data-drive-theme="google-drive"] #drive-navigation nav > button:nth-of-type(4n + 1) svg { color: var(--google-red); }
    [data-drive-theme="google-drive"] #drive-navigation nav > button:nth-of-type(4n + 2) svg { color: var(--google-yellow); }
    [data-drive-theme="google-drive"] #drive-navigation nav > button:nth-of-type(4n + 3) svg { color: var(--google-green); }
    [data-drive-theme="google-drive"] #drive-navigation nav > button:nth-of-type(4n) svg { color: var(--google-blue); }
    [data-drive-theme="google-drive"] .hover\\:bg-blue-50:hover, [data-drive-theme="google-drive"] .hover\\:bg-slate-50:hover, [data-drive-theme="google-drive"] .hover\\:bg-slate-100:hover { background-color: #202124 !important; }
    [data-drive-theme="google-drive"] button:focus-visible, [data-drive-theme="google-drive"] input:focus-visible { outline-color: #fbbc04 !important; }
  `}</style>;
  if (theme === "zo-light") return <style>{`
    [data-drive-theme="zo-light"] { background: #ffffff; color: #18181b; }
    [data-drive-theme="zo-light"] .bg-\\[\\#f8faff\\] { background-color: #ffffff !important; }
    [data-drive-theme="zo-light"] .bg-blue-600, [data-drive-theme="zo-light"] .bg-blue-700 { background-color: #18181b !important; }
    [data-drive-theme="zo-light"] .text-blue-600, [data-drive-theme="zo-light"] .text-blue-700 { color: #18181b !important; }
  `}</style>;
  if (theme === "zo-dark") return <DarkThemeStyles selector='[data-drive-theme="zo-dark"]' />;
  if (theme === "zo-system") return <style>{`@media (prefers-color-scheme: dark) { ${darkThemeCss('[data-drive-theme="zo-system"]')} }`}</style>;
  if (theme !== "zo-computer") return null;
  return <style>{`
    [data-drive-theme="zo-computer"] { background: #f5f0e7; color: #171512; font-family: "MonoLisa Text", "SFMono-Regular", ui-monospace, monospace; }
    [data-drive-theme="zo-computer"] h1, [data-drive-theme="zo-computer"] h2, [data-drive-theme="zo-computer"] h3 { font-family: "EB Garamond", Georgia, serif; letter-spacing: -0.02em; }
    [data-drive-theme="zo-computer"] .bg-white { background-color: #fffdf8 !important; }
    [data-drive-theme="zo-computer"] .bg-slate-50, [data-drive-theme="zo-computer"] .bg-slate-100, [data-drive-theme="zo-computer"] .bg-blue-50, [data-drive-theme="zo-computer"] .bg-\\[\#f8faff\\] { background-color: #f2ede4 !important; }
    [data-drive-theme="zo-computer"] .border-slate-100, [data-drive-theme="zo-computer"] .border-slate-200, [data-drive-theme="zo-computer"] .border-slate-300 { border-color: #ded7cb !important; }
    [data-drive-theme="zo-computer"] .bg-blue-600, [data-drive-theme="zo-computer"] .bg-blue-700, [data-drive-theme="zo-computer"] .bg-cyan-700, [data-drive-theme="zo-computer"] .bg-cyan-800 { background-color: #171512 !important; }
    [data-drive-theme="zo-computer"] .text-blue-600, [data-drive-theme="zo-computer"] .text-blue-700, [data-drive-theme="zo-computer"] .text-cyan-700, [data-drive-theme="zo-computer"] .text-cyan-800 { color: #171512 !important; }
    [data-drive-theme="zo-computer"] .hover\\:bg-blue-50:hover, [data-drive-theme="zo-computer"] .hover\\:bg-slate-50:hover { background-color: #ebe4d8 !important; }
  `}</style>;
}

function DriveScreen({ authClient, client, user, onAccountDeleted, onSignOut }: { authClient: AuthClient; client: DriveClient; user: DriveUser; onAccountDeleted: () => void; onSignOut: () => void }) {
  const { currentPath, setCurrentPath, viewMode, setViewMode } = useDriveUi();
  const [section, setSection] = useState<DriveSection>(currentDriveSection);
  const canManageUserAccess = user.role === "super";
  const [driveTheme, setDriveTheme] = useState<DriveTheme>(readDriveTheme);
  const [zominAiPane, setZominAiPane] = useState<ZominAiPane>("install");
  const [zominAiChatOpen, setZominAiChatOpen] = useState(false);
  const [zominAiChatSettings, setZominAiChatSettings] = useState<ZominAiSettings>(readZominAiSettings);
  const [zominAiConnection, setZominAiConnection] = useState<ZominAiConnection>({ state: "checking", detail: "Checking the local Bonsai runtime.", models: [] });
  const [search, setSearch] = useState("");
  const [advancedSearchOpen, setAdvancedSearchOpen] = useState(false);
  const [storageBreakdownOpen, setStorageBreakdownOpen] = useState(false);
  const [advancedFilters, setAdvancedFilters] = useState<AdvancedFilters>(defaultAdvancedFilters);
  const [appliedAdvancedFilters, setAppliedAdvancedFilters] = useState<AdvancedFilters>(defaultAdvancedFilters);
  const [recentFilters, setRecentFilters] = useState<RecentFilters>(defaultRecentFilters);
  const [sharedWorkspaceTab, setSharedWorkspaceTab] = useState<SharedWorkspaceTab>("incoming");
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(() => typeof window === "undefined" || !window.matchMedia || window.matchMedia("(min-width: 768px)").matches);
  useEffect(() => {
    if (!zominAiChatOpen) return;
    const controller = new AbortController();
    let disposed = false;
    const refreshConnection = async () => {
      if (!disposed) setZominAiConnection((current) => ({ state: "checking", detail: "Checking the local Bonsai runtime.", models: current.models }));
      const connection = await checkZominAiConnection(zominAiChatSettings, controller.signal);
      if (!disposed) {
        if (connection.models.length > 0 && !connection.models.includes(zominAiChatSettings.model)) {
          const nextSettings = { ...zominAiChatSettings, model: connection.models[0]! };
          writeZominAiSettings(nextSettings);
          setZominAiChatSettings(nextSettings);
        }
        setZominAiConnection(connection);
      }
    };
    void refreshConnection();
    const interval = window.setInterval(() => void refreshConnection(), 30_000);
    return () => {
      disposed = true;
      controller.abort();
      window.clearInterval(interval);
    };
  }, [zominAiChatOpen, zominAiChatSettings]);
  function refreshZominAiConnection() {
    setZominAiConnection((current) => ({ state: "checking", detail: "Checking the local Bonsai runtime.", models: current.models }));
    void checkZominAiConnection(zominAiChatSettings).then(setZominAiConnection);
  }
  function selectZominAiModel(model: string) {
    if (!zominAiConnection.models.includes(model)) return;
    const nextSettings = { ...zominAiChatSettings, model };
    writeZominAiSettings(nextSettings);
    setZominAiChatSettings(nextSettings);
  }
  const [newMenuOpen, setNewMenuOpen] = useState(false);
  const [folderDialogOpen, setFolderDialogOpen] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [folderToRename, setFolderToRename] = useState<DriveFolder | null>(null);
  const [folderRenameName, setFolderRenameName] = useState("");
  const [nativeFileType, setNativeFileType] = useState<NativeFileType | null>(null);
  const [nativeFileName, setNativeFileName] = useState("");
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [shareFile, setShareFile] = useState<DriveObject | null>(null);
  const [shareSettings, setShareSettings] = useState<PasteShareSettings | null>(null);
  const [passcodeShare, setPasscodeShare] = useState<DriveShare | null>(null);
  const [preview, setPreview] = useState<{ object: DriveObject; url: string } | null>(null);
  const [nativeEditor, setNativeEditor] = useState<{ content: NativeFileContent; object: DriveObject } | null>(null);
  const [uploads, setUploads] = useState<UploadTask[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    const restoreRoute = () => {
      const params = new URLSearchParams(window.location.search);
      setSection(currentDriveSection());
      setCurrentPath(params.get("folder") ?? "");
    };
    restoreRoute();
    window.addEventListener("popstate", restoreRoute);
    return () => window.removeEventListener("popstate", restoreRoute);
  }, [setCurrentPath]);

  useEffect(() => {
    if (!window.matchMedia) return;
    const mediaQuery = window.matchMedia("(min-width: 768px)");
    const syncSidebar = (event: MediaQueryListEvent) => setSidebarOpen(event.matches);
    mediaQuery.addEventListener("change", syncSidebar);
    return () => mediaQuery.removeEventListener("change", syncSidebar);
  }, []);

  useEffect(() => {
    updateDriveUrl({
      section,
      folder: section === "my-drive" && currentPath ? currentPath : null
    });
  }, [currentPath, section]);

  useEffect(() => {
    window.localStorage.setItem(driveThemeStorageKey, driveTheme);
  }, [driveTheme]);

  useEffect(() => {
    if (section === "user-access" && !canManageUserAccess) {
      setSection("my-drive");
      setCurrentPath("");
    }
  }, [canManageUserAccess, section, setCurrentPath]);

  const advancedSearchActive = !sameAdvancedFilters(appliedAdvancedFilters, defaultAdvancedFilters);
  const showingSearchResults = Boolean(search.trim()) || advancedSearchActive;
  const showDriveUpload = section === "home" || section === "my-drive" || section === "starred" || section === "shared" || section === "trash";
  const advancedDateRange = dateRangeFor(appliedAdvancedFilters.modified);
  const recentDateRange = dateRangeFor(recentFilters.modified);
  const isRecent = section === "home";
  const searchPrefix = isRecent ? undefined : advancedSearchActive ? appliedAdvancedFilters.location === "current" ? currentPath || undefined : undefined : section === "my-drive" ? currentPath || undefined : undefined;
  const filesQuery = useQuery({
    queryKey: ["objects", section, searchPrefix ?? "all", search, appliedAdvancedFilters, recentFilters],
    queryFn: () => client.list({
      prefix: searchPrefix,
      query: search || undefined,
      contentQuery: isRecent ? undefined : appliedAdvancedFilters.contentQuery || undefined,
      type: section === "pastes" ? "paste" : isRecent ? recentFilters.type === "any" ? undefined : recentFilters.type : appliedAdvancedFilters.type === "any" ? undefined : appliedAdvancedFilters.type,
      starred: isRecent ? undefined : appliedAdvancedFilters.starred || undefined,
      modifiedAfter: isRecent ? recentDateRange?.after : advancedDateRange?.after,
      modifiedBefore: isRecent ? recentDateRange?.before : advancedDateRange?.before
    }),
    enabled: section !== "api-keys" && section !== "cluster-databases" && section !== "databases" && section !== "functions" && section !== "shared" && section !== "starred" && section !== "theme" && section !== "transfer" && section !== "trash" && section !== "user-access" && section !== "zominai"
  });
  const foldersQuery = useQuery({
    queryKey: ["folders", currentPath],
    queryFn: () => client.listFolders(currentPath || undefined),
    enabled: section === "my-drive"
  });
  const sharesQuery = useQuery({ queryKey: ["shares"], queryFn: () => client.listShares(), enabled: section === "shared" });
  const clusterDiscoverySupported = Boolean(client.listClusterMounts && client.listClusterObjects);
  const clusterMountsQuery = useQuery({ queryKey: ["cluster-mounts-discovery"], queryFn: () => client.listClusterMounts!(), enabled: clusterDiscoverySupported && (section === "home" || section === "shared") });
  const clusterSharedQuery = useQuery({
    queryKey: ["cluster-shared-objects", (clusterMountsQuery.data ?? []).map((mount) => mount.id).join(",")],
    queryFn: async () => (await Promise.all((clusterMountsQuery.data ?? []).map(async (mount) => (await client.listClusterObjects!(mount.id)).map((object) => ({ ...object, mountAuthor: mount.author, mountFolder: mount.folder, mountId: mount.id, mountRole: mount.role }))))).flat(),
    enabled: clusterDiscoverySupported && Boolean(clusterMountsQuery.data?.length) && (section === "home" || section === "shared")
  });
  const starredQuery = useQuery({ queryKey: ["stars"], queryFn: () => client.listStarred(), enabled: section === "starred" });
  const trashQuery = useQuery({ queryKey: ["trash"], queryFn: () => client.listTrash(), enabled: section === "trash" });
  const usageQuery = useQuery({ queryKey: ["usage"], queryFn: () => client.getUsage() });

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["objects"] }),
      queryClient.invalidateQueries({ queryKey: ["folders"] }),
      queryClient.invalidateQueries({ queryKey: ["stars"] }),
      queryClient.invalidateQueries({ queryKey: ["trash"] }),
      queryClient.invalidateQueries({ queryKey: ["cluster-mounts-discovery"] }),
      queryClient.invalidateQueries({ queryKey: ["cluster-shared-objects"] }),
      queryClient.invalidateQueries({ queryKey: ["usage"] })
    ]);
  };
  const deleteMutation = useMutation({
    mutationFn: (key: string) => client.delete(key),
    onSuccess: async () => {
      await refresh();
      toast.success("Moved to Trash");
    },
    onError: () => toast.error("Could not delete the file")
  });
  const starMutation = useMutation({
    mutationFn: async ({ key, starred }: { key: string; starred: boolean }) => {
      if (starred) await client.unstar(key);
      else await client.star(key);
    },
    onSuccess: async (_result, { starred }) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["objects"] }),
        queryClient.invalidateQueries({ queryKey: ["stars"] })
      ]);
      toast.success(starred ? "Removed from Starred" : "Added to Starred");
    },
    onError: () => toast.error("Could not update starred files")
  });

  const objects = filesQuery.data ?? [];
  const files = advancedSearchActive ? objects : visibleFiles(objects, currentPath);
  const recentFiles = objects.filter((file) => recentFilters.source === "any" || (recentFilters.source === "zo-native" ? isZoNativeFile(file) : !isZoNativeFile(file))).sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  const clusterSharedFiles = (clusterSharedQuery.data ?? []).filter((file) => recentFilters.source === "any" || (recentFilters.source === "zo-native" ? isZoNativeFile(file) : !isZoNativeFile(file))).filter((file) => recentFilters.type === "any" || matchesContentTypeCategory(file.contentType, recentFilters.type)).filter((file) => (!recentDateRange?.after || file.updatedAt >= recentDateRange.after) && (!recentDateRange?.before || file.updatedAt <= recentDateRange.before)).sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  const starredFiles = (starredQuery.data ?? []).filter((file) => !search || file.name.toLowerCase().includes(search.toLowerCase()));
  const trashItems = (trashQuery.data ?? []).filter((item) => matchesTrashSearch(item, search, appliedAdvancedFilters));
  const displayedFiles = section === "home" ? recentFiles : section === "starred" ? starredFiles : files;
  const folders = search || advancedSearchActive ? [] : foldersQuery.data ?? [];
  const isLoading = section === "shared" ? sharesQuery.isPending || clusterMountsQuery.isPending || (Boolean(clusterMountsQuery.data?.length) && clusterSharedQuery.isPending) || usageQuery.isPending : section === "home" ? filesQuery.isPending || clusterMountsQuery.isPending || (Boolean(clusterMountsQuery.data?.length) && clusterSharedQuery.isPending) || usageQuery.isPending : section === "starred" ? starredQuery.isPending || usageQuery.isPending : section === "trash" ? trashQuery.isPending || usageQuery.isPending : filesQuery.isPending || (section === "my-drive" && foldersQuery.isPending) || usageQuery.isPending;
  const loadError = filesQuery.error ?? foldersQuery.error ?? sharesQuery.error ?? clusterMountsQuery.error ?? clusterSharedQuery.error ?? starredQuery.error ?? trashQuery.error ?? usageQuery.error;

  async function uploadFiles(selectedFiles: FileList | File[], pathForFile: (file: File) => string | undefined = () => currentPath || undefined) {
    const filesToUpload = Array.from(selectedFiles);
    if (filesToUpload.length === 0) {
      return;
    }
    const startedAt = Date.now();
    const nextUploads = filesToUpload.map((file, index) => ({ id: `${startedAt}-${index}-${file.name}`, loaded: 0, name: file.name, size: file.size, startedAt }));
    const uploadIds = new Set(nextUploads.map((upload) => upload.id));
    setUploads((current) => [...current, ...nextUploads]);
    const results = await Promise.allSettled(nextUploads.map(async (upload, index) => {
      const file = filesToUpload[index]!;
      await client.upload({
        file,
        fileName: file.name,
        path: pathForFile(file),
        onProgress: ({ loaded }) => setUploads((current) => current.map((currentUpload) => currentUpload.id === upload.id ? { ...currentUpload, loaded: Math.min(loaded, currentUpload.size) } : currentUpload))
      });
    }));
    const failures = results.filter((result): result is PromiseRejectedResult => result.status === "rejected");
    const completedCount = results.length - failures.length;
    if (completedCount > 0) await refresh();
    if (failures.length === 0) {
      toast.success(`${filesToUpload.length} file${filesToUpload.length === 1 ? "" : "s"} uploaded`);
    } else {
      const error = failures[0]?.reason;
      toast.error(`${completedCount > 0 ? `${completedCount} file${completedCount === 1 ? "" : "s"} uploaded. ` : ""}${error instanceof Error ? error.message : "Upload failed. Please try again."}`);
    }
    setUploads((current) => current.filter((upload) => !uploadIds.has(upload.id)));
  }

  async function openPreview(object: DriveObject) {
    try {
      const response = await client.download(object.key);
      if (object.nativeType) {
        setNativeEditor({ content: parseNativeFileContent(await response.text(), object.nativeType), object });
        return;
      }
      const url = URL.createObjectURL(await response.blob());
      setPreview((current) => {
        if (current) URL.revokeObjectURL(current.url);
        return { object, url };
      });
    } catch {
      toast.error("Could not load a preview");
    }
  }

  async function openSharedPreview(file: SharedDriveFile) {
    if (!client.downloadClusterObject) {
      toast.error("Shared file previews are unavailable until Zo Drive is updated");
      return;
    }
    try {
      const response = await client.downloadClusterObject({ id: file.mountId, key: file.key });
      const url = URL.createObjectURL(await response.blob());
      setPreview((current) => {
        if (current) URL.revokeObjectURL(current.url);
        return { object: file, url };
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load the shared file");
    }
  }

  async function createFolder() {
    if (!folderName.trim()) return;
    const path = currentPath ? `${currentPath}/${folderName.trim()}` : folderName.trim();
    try {
      await client.createFolder(path);
      await refresh();
      setFolderDialogOpen(false);
      setFolderName("");
      toast.success("Folder created");
    } catch {
      toast.error("Could not create the folder");
    }
  }

  async function renameFolder() {
    if (!client.renameFolder || !folderToRename || !folderRenameName.trim()) return;
    try {
      await client.renameFolder(folderToRename.key, folderRenameName.trim());
      await refresh();
      setFolderToRename(null);
      setFolderRenameName("");
      toast.success("Folder renamed");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not rename the folder");
    }
  }

  async function deleteFolder(folder: DriveFolder) {
    if (!client.deleteFolder) return;
    if (!window.confirm(`Move “${folder.name}” and everything inside it to Trash?`)) return;
    try {
      await client.deleteFolder(folder.key);
      await refresh();
      toast.success("Folder moved to Trash");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete the folder");
    }
  }

  async function createNativeFile() {
    if (!nativeFileType || !nativeFileName.trim()) return;
    try {
      const created = await client.createNativeFile({ name: nativeFileName.trim(), path: currentPath || undefined, type: nativeFileType });
      await refresh();
      toast.success(`${nativeFileLabel(nativeFileType)} created`);
      setNativeFileType(null);
      setNativeFileName("");
      await openPreview(created);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create the Zo file");
    }
  }

  async function saveNativeFile(content: NativeFileContent) {
    if (!nativeEditor) return;
    try {
      const object = await client.saveNativeFile(nativeEditor.object.key, content);
      setNativeEditor((current) => current ? { ...current, content, object } : current);
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save the Zo-native file");
      throw error;
    }
  }

  async function renameNativeFile(name: string) {
    if (!nativeEditor) return;
    try {
      const object = await client.rename(nativeEditor.object.key, name);
      setNativeEditor((current) => current ? { ...current, object } : current);
      await refresh();
      toast.success("File renamed");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not rename the file");
      throw error;
    }
  }

  async function publishNativeForm(): Promise<PublishedForm> {
    if (!nativeEditor) throw new Error("No Zo Form is open");
    return client.publishForm(nativeEditor.object.key);
  }

  async function restoreTrashItem(id: string) {
    try {
      await client.restoreTrash(id);
      await refresh();
      toast.success("File restored to its original location");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not restore the file");
    }
  }

  async function permanentlyDeleteTrashItem(item: DriveTrashItem) {
    if (!window.confirm(`Permanently delete ${item.name}? This cannot be undone.`)) return;
    try {
      await client.permanentlyDeleteTrash(item.id);
      await refresh();
      toast.success("File permanently deleted");
    } catch {
      toast.error("Could not permanently delete the file");
    }
  }

  async function emptyTrash() {
    if (!window.confirm("Permanently delete every file in Trash? This cannot be undone.")) return;
    try {
      await client.emptyTrash();
      await refresh();
      toast.success("Trash emptied");
    } catch {
      toast.error("Could not empty Trash");
    }
  }

  function closePreview() {
    if (preview) URL.revokeObjectURL(preview.url);
    setPreview(null);
  }

  function handleFileInput(event: ChangeEvent<HTMLInputElement>) {
    if (event.target.files) void uploadFiles(event.target.files);
    event.target.value = "";
  }

  function handleFolderInput(event: ChangeEvent<HTMLInputElement>) {
    if (event.target.files) {
      void uploadFiles(event.target.files, (file) => {
        const relativePath = (file as File & { webkitRelativePath?: string }).webkitRelativePath ?? "";
        const relativeFolder = relativePath.split("/").slice(0, -1).filter(Boolean).join("/");
        return [currentPath, relativeFolder].filter(Boolean).join("/") || undefined;
      });
    }
    event.target.value = "";
  }

  async function uploadDroppedItems(dataTransfer: DataTransfer) {
    const droppedFiles = await collectDroppedFiles(dataTransfer);
    if (droppedFiles.length === 0) return;
    const folders = new Map(droppedFiles.map(({ file, relativeFolder }) => [file, relativeFolder]));
    await uploadFiles(droppedFiles.map(({ file }) => file), (file) => [currentPath, folders.get(file)].filter(Boolean).join("/") || undefined);
  }

  function startNativeFile(type: NativeFileType) {
    setNewMenuOpen(false);
    closeMobileNavigation();
    setNativeFileType(type);
    setNativeFileName(`Untitled ${nativeFileLabel(type).toLowerCase()}`);
  }

  function closeMobileNavigation() {
    if (window.matchMedia && !window.matchMedia("(min-width: 768px)").matches) setSidebarOpen(false);
  }

  async function toggleZominAiChat() {
    if (zominAiChatOpen) {
      setZominAiChatOpen(false);
      return;
    }
    setZominAiChatSettings(readZominAiSettings());
    setZominAiConnection({ state: "checking", detail: "Checking the local Bonsai runtime.", models: [] });
    setZominAiChatOpen(true);
    try {
      const status = await getZominAiDownloadStatus();
      if (status.state === "ready") return;
    } catch {
      // An unavailable local status service means the runtime is not ready.
    }
    setZominAiChatOpen(false);
    setZominAiPane("install");
    setSection("zominai");
    setCurrentPath("");
  }

  function applyAdvancedSearch() {
    setAppliedAdvancedFilters(advancedFilters);
    setAdvancedSearchOpen(false);
    setSection(advancedFilters.inTrash ? "trash" : "my-drive");
    if (advancedFilters.location === "anywhere") setCurrentPath("");
  }

  function resetAdvancedSearch() {
    setSearch("");
    setAdvancedFilters(defaultAdvancedFilters);
    setAppliedAdvancedFilters(defaultAdvancedFilters);
    setAdvancedSearchOpen(false);
  }

  function handleDrop(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    void uploadDroppedItems(event.dataTransfer);
  }

  return (
    <main data-drive-theme={driveTheme} data-testid="drive-workspace" className={`flex h-dvh flex-col overflow-hidden ${driveTheme === "zo-computer" ? "bg-[#f5f0e7] text-[#171512]" : "bg-[#f8faff] text-slate-800"}`} onDragOver={(event) => event.preventDefault()} onDrop={handleDrop}>
      <DriveThemeStyles theme={driveTheme} />
      <header className="flex min-h-18 shrink-0 flex-wrap items-center gap-2 border-b border-slate-200 bg-white px-3 py-3 sm:px-5 md:h-18 md:flex-nowrap md:gap-5 md:py-0">
        <button aria-controls="drive-navigation" aria-expanded={sidebarOpen} aria-label="Open navigation" className="grid size-10 shrink-0 place-items-center rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-800 md:hidden" onClick={() => setSidebarOpen(true)}>
          <PanelLeftOpen size={21} />
        </button>
        <a aria-label="Back to Zo Drive landing page" className="flex shrink-0 items-center gap-2.5 text-xl font-semibold tracking-tight text-slate-900" href={landingUrl()}>
          <span className="relative block h-11 w-11 shrink-0" role="img" aria-label="Zo Drive Pegasus on a cloud">
            <img className="absolute inset-0 h-full w-full" src={driveCloudLogoUrl} alt="" />
            <img className="absolute left-[5.94%] top-0 h-[88.44%] w-[88.44%]" src={drivePegasusLogoUrl} alt="" />
          </span>
          <span className="hidden sm:inline">{driveTheme === "zo-computer" ? "Zo Computer" : "Zo Drive"}</span>
        </a>
        <div data-testid="search-controls" className="order-3 flex min-w-0 basis-full items-center gap-1.5 md:order-none md:basis-auto md:flex-1">
          <label className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={19} />
            <input
              aria-label="Search files"
              className="w-full rounded-xl border border-transparent bg-slate-100 py-2.5 pl-11 pr-4 outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-100"
              placeholder="Search in Drive"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          <button aria-label="Advanced search" className={`shrink-0 rounded-lg p-2 transition ${advancedSearchActive ? "bg-blue-50 text-blue-700" : "text-slate-500 hover:bg-slate-100 hover:text-slate-800"}`} onClick={() => { setAdvancedFilters(appliedAdvancedFilters); setAdvancedSearchOpen(true); }}><SlidersHorizontal size={21} /></button>
        </div>
        <div data-testid="header-actions" className="order-2 ml-auto flex shrink-0 items-center gap-0.5 text-sm font-medium text-slate-500 md:order-none md:ml-0 md:gap-1">
          <button aria-label="ZominAI" aria-pressed={zominAiChatOpen} className={`grid size-10 shrink-0 place-items-center overflow-hidden rounded-xl border bg-slate-50 p-0.5 shadow-sm transition hover:border-blue-300 hover:bg-blue-50 sm:size-11 ${zominAiChatOpen ? "border-cyan-500 ring-4 ring-cyan-100" : "border-slate-200"}`} onClick={() => void toggleZominAiChat()} title={zominAiChatOpen ? "Close ZominAI chat" : "Open ZominAI chat"}>
            <img className="size-full rounded-[0.65rem] object-cover" src={zominAiButtonUrl} alt="" />
          </button>
          <div className="relative">
            <button title="Account menu" aria-label="Account menu" aria-expanded={accountMenuOpen} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800" onClick={() => setAccountMenuOpen((open) => !open)}><MoreHorizontal size={21} /></button>
            {accountMenuOpen && <div className="absolute right-0 top-11 z-20 w-52 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg">
              <p className="truncate px-3 py-2 text-xs font-medium text-slate-400">{user.username}</p>
              <a className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-100" href={landingUrl()}><ArrowLeft size={17} /> Landing page</a>
              <a className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-100" href={docsUrl("gui")}><ScrollText size={17} /> Documentation</a>
              <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-100" onClick={() => { setAccountMenuOpen(false); setSection("api-keys"); setCurrentPath(""); }}><KeyRound size={17} /> API Keys</button>
              {canManageUserAccess && <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-100" onClick={() => { setAccountMenuOpen(false); setSection("user-access"); setCurrentPath(""); }}><UsersRound size={17} /> User access</button>}
              <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-100" onClick={() => { setAccountMenuOpen(false); setSection("profile"); setCurrentPath(""); }}><UserRound size={17} /> Profile & controls</button>
              <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-100" onClick={() => { setAccountMenuOpen(false); setZominAiPane("settings"); setSection("zominai"); setCurrentPath(""); }}><Settings2 size={17} /> ZominAI settings</button>
              <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-100" onClick={() => { setAccountMenuOpen(false); setSection("theme"); setCurrentPath(""); }}><Palette size={17} /> Theme</button>
            </div>}
          </div>
          <button title="Sign out" aria-label="Sign out" className="rounded-lg p-2 text-slate-500 transition hover:bg-rose-50 hover:text-rose-700" onClick={() => { setAccountMenuOpen(false); onSignOut(); }}><LogOut size={21} /></button>
        </div>
      </header>

      <div className="flex min-h-0 min-w-0 max-w-full flex-1">
        {sidebarOpen && <button aria-label="Close navigation" className="fixed inset-0 z-30 bg-slate-950/25 md:hidden" onClick={() => setSidebarOpen(false)} />}
        <aside id="drive-navigation" className={`${sidebarOpen ? "w-72 translate-x-0 overflow-y-auto px-3 md:overflow-y-auto" : "w-16 -translate-x-full overflow-visible px-1.5 md:translate-x-0 md:overflow-visible"} fixed inset-y-0 left-0 z-40 min-h-0 shrink-0 border-r border-slate-200 bg-white py-5 shadow-xl transition-[width,padding,transform] duration-200 md:static md:z-auto md:flex md:flex-col md:shadow-none ${sidebarOpen ? "md:w-64" : "md:w-16"}`}>
          <div className={`flex gap-2 ${sidebarOpen ? "items-center" : "flex-col items-center"}`}>
          {sidebarOpen ? <div className="relative flex-1">
            <button aria-expanded={newMenuOpen} className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-3 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700" onClick={() => setNewMenuOpen((open) => !open)}>
              <Plus size={18} /> New
            </button>
            {newMenuOpen && <div className="absolute left-0 top-[calc(100%+0.5rem)] z-30 w-full overflow-hidden rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl">
              <button className="new-menu-item" onClick={() => { setNewMenuOpen(false); closeMobileNavigation(); fileInput.current?.click(); }}><Upload size={17} /> File upload</button>
              <button className="new-menu-item" onClick={() => { setNewMenuOpen(false); closeMobileNavigation(); folderInput.current?.click(); }}><FolderUp size={17} /> Folder upload</button>
              <button className="new-menu-item" onClick={() => { setNewMenuOpen(false); closeMobileNavigation(); setFolderDialogOpen(true); }}><FolderPlus size={17} /> New folder</button>
              <div className="my-1 border-t border-slate-100" />
              {(["document", "spreadsheet", "presentation", "form"] as NativeFileType[]).map((type) => <button aria-label={`New Zo ${nativeFileLabel(type)}`} className="new-menu-item new-menu-native-item" key={type} onClick={() => startNativeFile(type)}><img className="size-9 shrink-0 rounded-md" src={nativeIllustrationUrl(type)} alt={`${nativeFileLabel(type)} illustration`} /><span>New Zo {nativeFileLabel(type)}</span></button>)}
              <button aria-label="New Zo Paste" className="new-menu-item new-menu-native-item" onClick={() => startNativeFile("paste")}><span className="grid size-9 shrink-0 place-items-center rounded-md bg-slate-900 text-cyan-300"><Code2 size={20} /></span><span>New Zo Paste</span></button>
            </div>}
          </div> : <button aria-label="New" className={`grid size-10 shrink-0 place-items-center rounded-xl bg-blue-600 text-white shadow-sm hover:bg-blue-700 ${collapsedNavigationTooltip(sidebarOpen)}`} data-tooltip="New" onClick={() => { setSidebarOpen(true); setNewMenuOpen(true); }} title="New"><Plus size={19} /></button>}
            <button aria-controls="drive-navigation" aria-expanded={sidebarOpen} aria-label={sidebarOpen ? "Collapse navigation" : "Expand navigation"} className={`grid size-10 shrink-0 place-items-center rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-800 ${collapsedNavigationTooltip(sidebarOpen)}`} data-tooltip={sidebarOpen ? "Collapse navigation" : "Expand navigation"} onClick={() => { setNewMenuOpen(false); setSidebarOpen((open) => !open); }} title={sidebarOpen ? "Collapse navigation" : "Expand navigation"}>
              {sidebarOpen ? <PanelLeftClose size={20} /> : <PanelLeftOpen size={20} />}
            </button>
          </div>
          <input ref={fileInput} aria-label="Upload files" className="hidden" type="file" multiple onChange={handleFileInput} />
          <input ref={folderInput} aria-label="Upload folder" className="hidden" type="file" multiple {...{ webkitdirectory: "" }} onChange={handleFolderInput} />

          <nav className={`${sidebarOpen ? "mt-6 space-y-1" : "mt-5 space-y-2"}`}>
            <button aria-label="Recent" className={`flex items-center rounded-lg text-sm font-semibold ${sidebarOpen ? "w-full gap-3 px-3 py-2.5 text-left" : "mx-auto size-10 justify-center"} ${section === "home" ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-50"} ${collapsedNavigationTooltip(sidebarOpen)}`} data-tooltip="Recent" onClick={() => { setSection("home"); setCurrentPath(""); closeMobileNavigation(); }} title="Recent"><Clock3 size={18} />{sidebarOpen && <span>Recent</span>}</button>
            <button aria-label="My Drive" className={`flex items-center rounded-lg text-sm font-semibold ${sidebarOpen ? "w-full gap-3 px-3 py-2.5 text-left" : "mx-auto size-10 justify-center"} ${section === "my-drive" ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-50"} ${collapsedNavigationTooltip(sidebarOpen)}`} data-tooltip="My Drive" onClick={() => { setSection("my-drive"); setCurrentPath(""); closeMobileNavigation(); }} title="My Drive"><HardDrive size={18} />{sidebarOpen && <span>My Drive</span>}</button>
            <button aria-label="Starred" className={`flex items-center rounded-lg text-sm font-semibold ${sidebarOpen ? "w-full gap-3 px-3 py-2.5 text-left" : "mx-auto size-10 justify-center"} ${section === "starred" ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-50"} ${collapsedNavigationTooltip(sidebarOpen)}`} data-tooltip="Starred" onClick={() => { setSection("starred"); setCurrentPath(""); closeMobileNavigation(); }} title="Starred"><Star size={18} />{sidebarOpen && <span>Starred</span>}</button>
            <button aria-label="Shared with others" className={`flex items-center rounded-lg text-sm font-semibold ${sidebarOpen ? "w-full gap-3 px-3 py-2.5 text-left" : "mx-auto size-10 justify-center"} ${section === "shared" ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-50"} ${collapsedNavigationTooltip(sidebarOpen)}`} data-tooltip="Shared with others" onClick={() => { setSection("shared"); closeMobileNavigation(); }} title="Shared with others"><UsersRound size={18} />{sidebarOpen && <span>Shared with others</span>}</button>
            <button aria-label="Trash" className={`flex items-center rounded-lg text-sm font-semibold ${sidebarOpen ? "w-full gap-3 px-3 py-2.5 text-left" : "mx-auto size-10 justify-center"} ${section === "trash" ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-50"} ${collapsedNavigationTooltip(sidebarOpen)}`} data-tooltip="Trash" onClick={() => { setSection("trash"); setCurrentPath(""); closeMobileNavigation(); }} title="Trash"><Trash2 size={18} />{sidebarOpen && <span>Trash</span>}</button>
            <div className={`${sidebarOpen ? "my-3" : "mx-auto my-3 w-7"} border-t border-slate-200`} role="separator" />
            <button aria-label="Zo Paste" className={`flex items-center rounded-lg text-sm font-semibold ${sidebarOpen ? "w-full gap-3 px-3 py-2.5 text-left" : "mx-auto size-10 justify-center"} ${section === "pastes" ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-50"} ${collapsedNavigationTooltip(sidebarOpen)}`} data-tooltip="Zo Paste" onClick={() => { setSection("pastes"); setCurrentPath(""); closeMobileNavigation(); }} title="Zo Paste"><Code2 size={18} />{sidebarOpen && <span>Zo Paste</span>}</button>
            <button aria-label="Zo Transfer" className={`flex items-center rounded-lg text-sm font-semibold ${sidebarOpen ? "w-full gap-3 px-3 py-2.5 text-left" : "mx-auto size-10 justify-center"} ${section === "transfer" ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-50"} ${collapsedNavigationTooltip(sidebarOpen)}`} data-tooltip="Zo Transfer" onClick={() => { setSection("transfer"); setCurrentPath(""); closeMobileNavigation(); }} title="Zo Transfer"><Send size={18} />{sidebarOpen && <span>Zo Transfer</span>}</button>
            <button aria-label="Zo Functions" className={`flex items-center rounded-lg text-sm font-semibold ${sidebarOpen ? "w-full gap-3 px-3 py-2.5 text-left" : "mx-auto size-10 justify-center"} ${section === "functions" ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-50"} ${collapsedNavigationTooltip(sidebarOpen)}`} data-tooltip="Zo Functions" onClick={() => { setSection("functions"); setCurrentPath(""); closeMobileNavigation(); }} title="Zo Functions"><Terminal size={18} />{sidebarOpen && <span>Zo Functions</span>}</button>
            <button aria-label="Zo Databases" className={`flex items-center rounded-lg text-sm font-semibold ${sidebarOpen ? "w-full gap-3 px-3 py-2.5 text-left" : "mx-auto size-10 justify-center"} ${section === "databases" ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-50"} ${collapsedNavigationTooltip(sidebarOpen)}`} data-tooltip="Zo Databases" onClick={() => { updateDriveUrl({ database: null, databasePanel: null, databaseView: "catalog", table: null }); setSection("databases"); setCurrentPath(""); closeMobileNavigation(); }} title="Zo Databases"><Database size={18} />{sidebarOpen && <span>Zo Databases</span>}</button>
            <button aria-label="Zo Shared Drives" className={`flex items-center rounded-lg text-sm font-semibold ${sidebarOpen ? "w-full gap-3 px-3 py-2.5 text-left" : "mx-auto size-10 justify-center"} ${section === "cluster-databases" ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-50"} ${collapsedNavigationTooltip(sidebarOpen)}`} data-tooltip="Zo Shared Drives" onClick={() => { setSection("cluster-databases"); setCurrentPath(""); closeMobileNavigation(); }} title="Zo Shared Drives"><Network size={18} />{sidebarOpen && <span>Zo Shared Drives</span>}</button>
          </nav>

          {sidebarOpen && <UsageCard usage={usageQuery.data} onOpenBreakdown={() => setStorageBreakdownOpen(true)} />}
        </aside>

        <section className="min-h-0 min-w-0 max-w-full flex-1 overflow-x-hidden overflow-y-auto p-4 transition-[padding] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none sm:p-6 md:p-9">
          <div className="mb-7 flex flex-wrap items-center justify-between gap-4">
            <div>
              {section === "my-drive" && currentPath && <FolderNavigation currentPath={currentPath} onNavigate={setCurrentPath} />}
              <h1 className={`${section === "my-drive" && currentPath ? "mt-3" : ""} text-2xl font-semibold tracking-tight text-slate-900`}>{section === "zominai" ? <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">ZominAI <span className="text-sm font-medium tracking-normal text-slate-500">Pronounced ZOH-min A.I.</span></span> : showingSearchResults ? "Search results" : section === "api-keys" ? "API Keys" : section === "user-access" ? "User access" : section === "theme" ? "Theme" : section === "cluster-databases" ? "Zo Shared Drives" : section === "databases" ? "Zo Databases" : section === "functions" ? "Zo Functions" : section === "profile" ? "Profile & controls" : section === "home" ? "Recent" : section === "pastes" ? "Zo Paste" : section === "transfer" ? "Zo Transfer" : section === "shared" ? "Shared with others" : section === "starred" ? "Starred" : section === "trash" ? "Trash" : currentPath ? currentPath.split("/").at(-1) : "Files"}</h1>
              {showingSearchResults && <p className="mt-1 text-sm text-slate-500">{search.trim() ? `Matches for “${search.trim()}” in this section.` : "Matches for the selected advanced filters."}</p>}
              {!showingSearchResults && section === "api-keys" && <p className="mt-1 text-sm text-slate-500">Provision and revoke scoped access for local computers and automations.</p>}
              {!showingSearchResults && section === "user-access" && <p className="mt-1 text-sm text-slate-500">Create, update, and revoke people’s access to this Drive.</p>}
              {!showingSearchResults && section === "theme" && <p className="mt-1 text-sm text-slate-500">Choose the visual style for this browser.</p>}
              {!showingSearchResults && section === "cluster-databases" && <p className="mt-1 text-sm text-slate-500">Choose exactly which Drive folders each trusted person can access.</p>}
              {!showingSearchResults && section === "databases" && <p className="mt-1 text-sm text-slate-500">Choose a lightweight open-source database, then keep its data private in your Drive.</p>}
              {!showingSearchResults && section === "functions" && <p className="mt-1 text-sm text-slate-500">Store, run, and schedule small JavaScript or Python functions.</p>}
              {!showingSearchResults && section === "profile" && <p className="mt-1 text-sm text-slate-500">Manage the owner account for this private drive.</p>}
              {!showingSearchResults && section === "zominai" && <p className="mt-1 text-sm text-slate-500">Set up and verify the local Bonsai runtime for this browser.</p>}
              {!showingSearchResults && section === "home" && <p className="mt-1 text-sm text-slate-500">Files you recently created, uploaded, or updated.</p>}
              {!showingSearchResults && section === "pastes" && <p className="mt-1 text-sm text-slate-500">Create, keep, and securely share code or text snippets.</p>}
              {!showingSearchResults && section === "transfer" && <p className="mt-1 text-sm text-slate-500">Create and manage public file links from Zo Drive.</p>}
              {!showingSearchResults && section === "shared" && <p className="mt-1 text-sm text-slate-500">Access folders shared with you and manage links shared outside your Drive.</p>}
              {!showingSearchResults && section === "trash" && <p className="mt-1 text-sm text-slate-500">Items are permanently deleted 30 days after being moved here.</p>}
            </div>
            <div className="ml-auto flex shrink-0 items-center gap-3" data-testid="dashboard-actions">
              {zominAiChatOpen && showDriveUpload && <button aria-label="Open upload menu" className="hidden items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-200 md:inline-flex" onClick={() => setUploadDialogOpen(true)}><Upload size={17} /> Upload</button>}
              {section === "trash" && trashItems.length > 0 ? <button className="rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50" onClick={() => void emptyTrash()}>Empty trash</button> : section === "pastes" ? <button className="flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800" onClick={() => startNativeFile("paste")}><Plus size={17} /> New paste</button> : section !== "home" && section !== "theme" && section !== "transfer" && section !== "api-keys" && section !== "user-access" && section !== "cluster-databases" && section !== "databases" && section !== "functions" && section !== "profile" && section !== "zominai" && <div className="flex rounded-lg border border-slate-200 bg-white p-1">
              <button aria-label="List view" className={`rounded-md p-2 ${viewMode === "list" ? "bg-slate-100 text-slate-900" : "text-slate-400"}`} onClick={() => setViewMode("list")}><List size={18} /></button>
              <button aria-label="Grid view" className={`rounded-md p-2 ${viewMode === "grid" ? "bg-slate-100 text-slate-900" : "text-slate-400"}`} onClick={() => setViewMode("grid")}><Grid2X2 size={18} /></button>
            </div>}
            </div>
          </div>

          {section === "home" && <RecentFiltersBar filters={recentFilters} onChange={setRecentFilters} />}

          {section === "api-keys" ? <ApiKeys client={client} /> : section === "user-access" && canManageUserAccess ? <UserAccessScreen client={authClient as unknown as UserAccessClient} currentUser={user} /> : section === "theme" ? <ThemeScreen onThemeChange={setDriveTheme} theme={driveTheme} /> : section === "cluster-databases" ? <ClusterDatabases client={client} search={search} /> : section === "databases" ? <Databases client={client} search={search} /> : section === "functions" ? <Functions client={client} search={search} /> : section === "profile" ? <AccountScreen client={authClient} onAccountDeleted={onAccountDeleted} user={user} /> : section === "zominai" ? <ZominAiWorkspace initialPane={zominAiPane} /> : section === "transfer" ? <ZoTransfer client={client} search={search} onCreated={async () => { await refresh(); await queryClient.invalidateQueries({ queryKey: ["shares"] }); }} /> : section === "pastes" ? <ZoPaste files={displayedFiles} isError={filesQuery.isError} isLoading={isLoading} onCreate={() => startNativeFile("paste")} onDelete={(key) => deleteMutation.mutate(key)} onPreview={openPreview} onRetry={() => void filesQuery.refetch()} onShare={(file) => { setShareSettings(null); setShareFile(file); }} onToggleStar={(file) => starMutation.mutate({ key: file.key, starred: file.starred })} /> : isLoading ? (
            <div className="grid h-64 place-items-center text-sm text-slate-500"><LoaderCircle className="mr-2 animate-spin" size={20} /> Loading your drive…</div>
          ) : (section === "shared" ? sharesQuery.isError : section === "starred" ? starredQuery.isError : section === "trash" ? trashQuery.isError : filesQuery.isError) ? (
            <EmptyState
              title="We couldn't load your drive"
              description={loadError instanceof Error ? loadError.message : "Check that the Drive API is running, then try again."}
              action="Try again"
              onAction={() => void filesQuery.refetch()}
            />
          ) : section === "shared" ? (
            <div>
              <div aria-label="Shared file sources" className="mb-6 flex gap-1 border-b border-slate-200" role="tablist">
                <button aria-controls="shared-with-me-panel" aria-label="Shared with me" aria-selected={sharedWorkspaceTab === "incoming"} className={`border-b-2 px-4 py-3 text-sm font-semibold transition ${sharedWorkspaceTab === "incoming" ? "border-cyan-600 text-cyan-800" : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800"}`} id="shared-with-me-tab" onClick={() => setSharedWorkspaceTab("incoming")} role="tab" type="button">Shared with me</button>
                <button aria-controls="share-links-panel" aria-label="Share links" aria-selected={sharedWorkspaceTab === "links"} className={`border-b-2 px-4 py-3 text-sm font-semibold transition ${sharedWorkspaceTab === "links" ? "border-blue-600 text-blue-700" : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800"}`} id="share-links-tab" onClick={() => setSharedWorkspaceTab("links")} role="tab" type="button">Share links</button>
              </div>
              {sharedWorkspaceTab === "incoming" ? <div aria-labelledby="shared-with-me-tab" id="shared-with-me-panel" role="tabpanel"><ClusterIncomingEntries files={clusterSharedFiles} mounts={clusterMountsQuery.data ?? []} onManage={() => setSection("cluster-databases")} onOpen={openSharedPreview} /></div> : <div aria-labelledby="share-links-tab" id="share-links-panel" role="tabpanel"><SharedLinks shares={sharesQuery.data ?? []} onCopy={(share) => void copyShareLink(share.id)} onChangePasscode={setPasscodeShare} onPreview={(share) => void openPreview({ key: share.key, name: share.name, size: share.size, contentType: share.contentType, updatedAt: share.createdAt, starred: false })} onRevoke={(id) => client.revokeShare(id).then(() => sharesQuery.refetch())} /></div>}
            </div>
          ) : section === "trash" ? trashItems.length === 0 ? (
            <EmptyState title="Trash is empty" description="Files and folders you move here stay for 30 days before they are permanently deleted." action="Go to My Drive" onAction={() => setSection("my-drive")} />
          ) : (
            <TrashEntries items={trashItems} onRestore={(id) => void restoreTrashItem(id)} onPermanentlyDelete={(item) => void permanentlyDeleteTrashItem(item)} />
          ) : (section === "my-drive" ? folders.length === 0 && files.length === 0 : section === "home" ? displayedFiles.length === 0 && clusterSharedFiles.length === 0 : displayedFiles.length === 0) ? (
            <EmptyState title={search ? "No matching files" : section === "home" ? "No recent files" : section === "starred" ? "No starred files" : "Your drive is ready for its first file"} description={section === "home" ? "Recent uploads, changes, and Zo-native files will appear here." : section === "starred" && !search ? "Use the star next to any file to keep it here." : undefined} action={section === "starred" ? "Go to My Drive" : "Upload files"} onAction={() => section === "starred" ? setSection("my-drive") : fileInput.current?.click()} />
          ) : section === "home" ? (
            <div className="space-y-6"><RecentEntries files={[...recentFiles, ...clusterSharedFiles].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))} onOpenShared={openSharedPreview} onPreview={openPreview} onDelete={(key) => deleteMutation.mutate(key)} onToggleStar={(file) => starMutation.mutate({ key: file.key, starred: file.starred })} onShare={(file) => { setShareSettings(null); setShareFile(file); }} /></div>
          ) : (
            <DriveEntries
              files={displayedFiles}
              folders={section === "my-drive" ? folders : []}
              viewMode={viewMode}
              onOpenFolder={(folder) => setCurrentPath(folder.key)}
              onRenameFolder={client.renameFolder ? (folder) => { setFolderToRename(folder); setFolderRenameName(folder.name); } : undefined}
              onDeleteFolder={client.deleteFolder ? (folder) => void deleteFolder(folder) : undefined}
              onPreview={openPreview}
              onDelete={(key) => deleteMutation.mutate(key)}
              onToggleStar={(file) => starMutation.mutate({ key: file.key, starred: file.starred })}
              onShare={(file) => { setShareSettings(null); setShareFile(file); }}
            />
          )}
        </section>
        <ZominAiChatDrawer client={client} connection={zominAiConnection} isOpen={zominAiChatOpen} onClose={() => setZominAiChatOpen(false)} onConnectionChange={setZominAiConnection} onModelChange={selectZominAiModel} onRefreshConnection={refreshZominAiConnection} settings={zominAiChatSettings} />
      </div>
      {preview && <PreviewDialog preview={preview} onClose={closePreview} />}
      {nativeEditor && <NativeEditor key={nativeEditor.object.key} content={nativeEditor.content} fileName={nativeEditor.object.name} onClose={() => setNativeEditor(null)} onListResponses={(id) => client.listFormResponses(id)} onPublish={publishNativeForm} onRename={renameNativeFile} onSave={saveNativeFile} onShare={(settings) => { setShareSettings(settings ?? null); setShareFile(nativeEditor.object); }} />}
      {advancedSearchOpen && <AdvancedSearchDialog filters={advancedFilters} itemName={search} onCancel={() => setAdvancedSearchOpen(false)} onFiltersChange={setAdvancedFilters} onItemNameChange={setSearch} onReset={resetAdvancedSearch} onSearch={applyAdvancedSearch} />}
      {folderDialogOpen && <FolderDialog folderName={folderName} onCancel={() => { setFolderDialogOpen(false); setFolderName(""); }} onCreate={() => void createFolder()} onNameChange={setFolderName} />}
      {folderToRename && <FolderRenameDialog folder={folderToRename} name={folderRenameName} onCancel={() => { setFolderToRename(null); setFolderRenameName(""); }} onNameChange={setFolderRenameName} onRename={() => void renameFolder()} />}
      {nativeFileType && <NativeFileDialog type={nativeFileType} name={nativeFileName} onCancel={() => { setNativeFileType(null); setNativeFileName(""); }} onCreate={() => void createNativeFile()} onNameChange={setNativeFileName} />}
      {shareFile && <ShareDialog client={client} file={shareFile} initialSettings={shareSettings ?? undefined} onClose={() => { setShareFile(null); setShareSettings(null); }} />}
      {passcodeShare && <ChangePasscodeDialog client={client} share={passcodeShare} onClose={() => setPasscodeShare(null)} onUpdated={() => void sharesQuery.refetch()} />}
      {storageBreakdownOpen && <StorageBreakdownDialog usage={usageQuery.data} onClose={() => setStorageBreakdownOpen(false)} onSetQuota={async (quotaBytes) => {
        const updatedUsage = await client.setQuota(quotaBytes);
        queryClient.setQueryData(["usage"], updatedUsage);
        toast.success(`Storage limit set to ${formatBytes(updatedUsage.quotaBytes)}`);
        return updatedUsage;
      }} />}
      {uploadDialogOpen && <UploadDialog onClose={() => setUploadDialogOpen(false)} onChooseFiles={() => { setUploadDialogOpen(false); fileInput.current?.click(); }} onChooseFolder={() => { setUploadDialogOpen(false); folderInput.current?.click(); }} onDrop={(dataTransfer) => { setUploadDialogOpen(false); return uploadDroppedItems(dataTransfer); }} />}
      {uploads.length === 0 && !zominAiChatOpen && showDriveUpload && <button aria-label="Open upload menu" className="fixed bottom-4 right-4 z-40 inline-flex items-center gap-2 rounded-full bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-900/25 transition hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-200 sm:bottom-6 sm:right-6 sm:px-5" onClick={() => setUploadDialogOpen(true)}><Upload size={18} /> <span className="hidden sm:inline">Upload</span></button>}
      {uploads.length > 0 && <UploadProgress uploads={uploads} />}
    </main>
  );
}

function ClusterDatabases({ client, search }: { client: DriveClient; search: string }) {
  const queryClient = useQueryClient();
  const supported = Boolean(
      client.createClusterInvitation &&
      client.createClusterMount &&
      client.deleteClusterInvitation &&
      client.listClusterMounts &&
      client.listClusterObjects &&
      client.createClusterFolder &&
      client.deleteClusterMount &&
      client.deleteClusterObject &&
      client.deleteClusterPeer &&
      client.downloadClusterObject &&
      client.getClusterMountAccess &&
      client.listClusterInvitations &&
      client.listClusterPeers &&
      client.renameClusterObject &&
      client.updateClusterPeerRole &&
      client.uploadClusterObject,
  );
  const [sharedDrivesTab, setSharedDrivesTab] = useState<"shared" | "connected">("shared");
  const [pairMode, setPairMode] = useState<"invite" | "join">("invite");
  const [selectedFolders, setSelectedFolders] = useState<string[]>([]);
  const [inviteRole, setInviteRole] = useState<ClusterRole>("editor");
  const [recipient, setRecipient] = useState("");
  const [remoteUrl, setRemoteUrl] = useState("");
  const [inviteToken, setInviteToken] = useState("");
  const [createdInvites, setCreatedInvites] = useState<ClusterInvitation[]>([]);
  const [openMount, setOpenMount] = useState<string | null>(null);
  const [remoteFolder, setRemoteFolder] = useState("");
  const remoteFileInput = useRef<HTMLInputElement>(null);
  const mountsQuery = useQuery({
    queryKey: ["cluster-mounts"],
    queryFn: () => client.listClusterMounts!(),
    enabled: supported,
  });
  const peersQuery = useQuery({
    queryKey: ["cluster-peers"],
    queryFn: () => client.listClusterPeers!(),
    enabled: supported,
  });
  const invitationsQuery = useQuery({
    queryKey: ["cluster-invitations"],
    queryFn: () => client.listClusterInvitations!(),
    enabled: supported,
  });
  const shareFoldersQuery = useQuery({
    queryKey: ["cluster-share-folders"],
    queryFn: () => client.listFolders(),
    enabled: supported,
  });
  const objectsQuery = useQuery({
    queryKey: ["cluster-objects", openMount],
    queryFn: () => client.listClusterObjects!(openMount!),
    enabled: supported && Boolean(openMount),
  });
  const normalizedSearch = search.trim().toLowerCase();
  const mounts = mountsQuery.data ?? [];
  const searchObjectsQuery = useQuery({
    queryKey: ["cluster-search-objects", mounts.map((mount) => mount.id).join(",")],
    queryFn: async () => (await Promise.all(mounts.map(async (mount) => (await client.listClusterObjects!(mount.id)).map((object) => ({ mount, object }))))).flat(),
    enabled: supported && Boolean(normalizedSearch) && mounts.length > 0,
  });
  const accessQuery = useQuery({
    queryKey: ["cluster-access", openMount],
    queryFn: () => client.getClusterMountAccess!(openMount!),
    enabled: supported && Boolean(openMount),
  });
  const refreshSharedDriveEntries = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["cluster-mounts"] }),
      queryClient.invalidateQueries({ queryKey: ["cluster-mounts-discovery"] }),
      queryClient.invalidateQueries({ queryKey: ["cluster-objects", openMount] }),
      queryClient.invalidateQueries({ queryKey: ["cluster-shared-objects"] }),
    ]);
  };
  const invitationMutation = useMutation({
    mutationFn: () =>
      Promise.all(
        selectedFolders.map((folder) =>
          client.createClusterInvitation!({
            folder,
            role: inviteRole,
            recipient: recipient.trim() || null,
          }),
        ),
      ),
    onSuccess: async (invites) => {
      setCreatedInvites(invites);
      await queryClient.invalidateQueries({ queryKey: ["cluster-invitations"] });
      toast.success(
        `${invites.length} one-time pairing ${invites.length === 1 ? "key" : "keys"} created`,
      );
    },
    onError: (error) =>
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not create pairing keys",
      ),
  });
  const mountMutation = useMutation({
    mutationFn: () =>
      client.createClusterMount!({
        remoteUrl: remoteUrl.trim(),
        inviteToken: inviteToken.trim(),
      }),
    onSuccess: async () => {
      setInviteToken("");
      await refreshSharedDriveEntries();
      toast.success("Cluster folder connected");
    },
    onError: (error) =>
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not connect the cluster folder",
      ),
  });
  const refreshObjects = refreshSharedDriveEntries;
  const folderMutation = useMutation({
    mutationFn: () =>
      client.createClusterFolder!({
        id: openMount!,
        path: remoteFolder.trim(),
      }),
    onSuccess: async () => {
      setRemoteFolder("");
      await refreshObjects();
      toast.success("Shared folder created");
    },
    onError: (error) =>
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not create the shared folder",
      ),
  });
  const uploadMutation = useMutation({
    mutationFn: (file: File) =>
      client.uploadClusterObject!({
        id: openMount!,
        file,
        fileName: file.name,
      }),
    onSuccess: async () => {
      await refreshObjects();
      toast.success("File uploaded to the shared folder");
    },
    onError: (error) =>
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not upload to the shared folder",
      ),
  });
  const renameMutation = useMutation({
    mutationFn: ({ key, name }: { key: string; name: string }) =>
      client.renameClusterObject!({ id: openMount!, key, name }),
    onSuccess: refreshObjects,
    onError: (error) =>
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not rename the shared file",
      ),
  });
  const deleteMutation = useMutation({
    mutationFn: (key: string) =>
      client.deleteClusterObject!({ id: openMount!, key }),
    onSuccess: async () => {
      await refreshObjects();
      toast.success("Shared file moved to the owner's Trash");
    },
    onError: (error) =>
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not delete the shared file",
      ),
  });
  const disconnectMutation = useMutation({
    mutationFn: (id: string) => client.deleteClusterMount!(id),
    onSuccess: async (_result, id) => {
      if (openMount === id) setOpenMount(null);
      await refreshSharedDriveEntries();
      toast.success("Cluster folder disconnected");
    },
    onError: (error) =>
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not disconnect the cluster folder",
      ),
  });
  const updatePeerRoleMutation = useMutation({
    mutationFn: ({ id, role }: { id: string; role: ClusterRole }) =>
      client.updateClusterPeerRole!({ id, role }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["cluster-peers"] });
      toast.success("Folder access updated");
    },
    onError: (error) =>
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not update folder access",
      ),
  });
  const revokePeerMutation = useMutation({
    mutationFn: (id: string) => client.deleteClusterPeer!(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["cluster-peers"] });
      toast.success("Shared folder access revoked");
    },
    onError: (error) =>
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not revoke folder access",
      ),
  });
  const cancelInvitationMutation = useMutation({
    mutationFn: (id: string) => client.deleteClusterInvitation!(id),
    onSuccess: async (_result, id) => {
      setCreatedInvites((current) => current.filter((invite) => invite.id !== id));
      await queryClient.invalidateQueries({ queryKey: ["cluster-invitations"] });
      toast.success("Unused pairing key cancelled");
    },
    onError: (error) =>
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not cancel the pairing key",
      ),
  });
  const canWrite = accessQuery.data?.role === "editor";
  const cacheStatus = objectsQuery.data?.cacheStatus;
  const matchingSharedFiles = (searchObjectsQuery.data ?? []).filter(({ object }) => matchesSearch(normalizedSearch, object.name, object.key, object.contentType));
  const visibleInvitations = (invitationsQuery.data ?? []).filter((invite) => matchesSearch(normalizedSearch, invite.folder, invite.recipient, invite.role));
  const visiblePeers = (peersQuery.data ?? []).filter((peer) => matchesSearch(normalizedSearch, peer.folder, peer.recipient, peer.role));
  const visibleMounts = mounts.filter((mount) => matchesSearch(normalizedSearch, mount.folder, mount.remoteUrl, mount.author, mount.recipient, mount.role) || matchingSharedFiles.some((result) => result.mount.id === mount.id));
  const visibleOpenMountObjects = (objectsQuery.data ?? []).filter((object) => matchesSearch(normalizedSearch, object.name, object.key, object.contentType));
  async function downloadObject(key: string, name: string) {
    try {
      const response = await client.downloadClusterObject!({
        id: openMount!,
        key,
      });
      const url = URL.createObjectURL(await response.blob());
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = name;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not download the shared file",
      );
    }
  }
  function toggleFolder(folder: string) {
    setSelectedFolders((current) =>
      current.includes(folder)
        ? current.filter((item) => item !== folder)
        : [...current.filter((item) => !item.startsWith(`${folder}/`)), folder],
    );
  }
  if (!supported)
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">
          Cluster Storage is unavailable
        </h2>
        <p className="mt-2 text-sm text-slate-500">
          Update the Zo Drive API and browser workspace together to pair another
          Zo Computer.
        </p>
      </section>
    );
  return (
    <div className="space-y-5">
      <div aria-label="Zo Shared Drives views" className="flex max-w-md rounded-xl bg-slate-100 p-1" role="tablist">
        <button aria-selected={sharedDrivesTab === "shared"} className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold transition ${sharedDrivesTab === "shared" ? "bg-white text-cyan-800 shadow-sm" : "text-slate-500 hover:text-slate-800"}`} onClick={() => setSharedDrivesTab("shared")} role="tab" type="button">Shared Folders</button>
        <button aria-selected={sharedDrivesTab === "connected"} className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold transition ${sharedDrivesTab === "connected" ? "bg-white text-cyan-800 shadow-sm" : "text-slate-500 hover:text-slate-800"}`} onClick={() => setSharedDrivesTab("connected")} role="tab" type="button">Connected Folders</button>
      </div>
      {sharedDrivesTab === "shared" && <>
      {!normalizedSearch && <>
      <section className="w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="relative overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-cyan-950 px-7 py-9 text-white md:px-10">
            <div className="absolute -right-28 -top-32 size-80 rounded-full bg-cyan-400/15 blur-3xl" />
            <div className="relative">
              <span className="inline-flex items-center gap-2 rounded-full border border-cyan-200/20 bg-cyan-200/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-100"><Network size={14} /> Private by default</span>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight md:text-4xl">Share folders with Zo Shared Drives</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300 md:text-base">Choose exactly which folders to share, set the right access, then send a pairing key. Your other Drive content stays private.</p>
              <p className="mt-4 text-xs font-medium text-cyan-100/80">Inspired by Synology NAS Drive.</p>
            </div>
          </div>
          <div className="p-5 sm:p-6">
            <div
              aria-label="Shared Drive pairing mode"
              className="flex max-w-md rounded-xl bg-slate-100 p-1"
              role="tablist"
            >
              <button
                aria-selected={pairMode === "invite"}
                className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold ${pairMode === "invite" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                onClick={() => setPairMode("invite")}
                role="tab"
                type="button"
              >
                Share a folder
              </button>
              <button
                aria-selected={pairMode === "join"}
                className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold ${pairMode === "join" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                onClick={() => setPairMode("join")}
                role="tab"
                type="button"
              >
                Join a folder
              </button>
            </div>
            {pairMode === "invite" ? (
              <div className="mt-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">1. Choose folders</h3>
                    <p className="mt-1 text-sm text-slate-500">A parent includes its subfolders.</p>
                  </div>
                  <span className="rounded-full bg-cyan-50 px-3 py-1 text-xs font-bold text-cyan-800">
                    {selectedFolders.length} selected
                  </span>
                </div>
                <div className="mt-4 max-h-64 overflow-auto rounded-xl border border-slate-200 bg-slate-50 p-2">
                  {shareFoldersQuery.isPending ? (
                    <p className="p-4 text-sm text-slate-500">
                      Loading your folders…
                    </p>
                  ) : shareFoldersQuery.isError ? (
                    <p className="p-4 text-sm text-red-600">
                      Your folders could not be loaded. Try again before
                      creating a key.
                    </p>
                  ) : (shareFoldersQuery.data ?? []).length === 0 ? (
                    <p className="p-4 text-sm text-slate-500">
                      Create a folder in My Drive first, then return here to
                      share it.
                    </p>
                  ) : (
                    [...(shareFoldersQuery.data ?? [])]
                      .sort((left, right) => left.key.localeCompare(right.key))
                      .map((item) => {
                        const selected = selectedFolders.includes(item.key);
                        const coveredByParent = selectedFolders.some((folder) =>
                          item.key.startsWith(`${folder}/`),
                        );
                        return (
                          <label
                            className={`mb-1 flex cursor-pointer items-center gap-3 rounded-lg px-3 py-3 last:mb-0 ${selected ? "bg-cyan-100 text-cyan-950" : coveredByParent ? "cursor-not-allowed opacity-50" : "hover:bg-white"}`}
                            key={item.key}
                          >
                            <input
                              aria-label={`Share folder ${item.key}`}
                              checked={selected}
                              className="size-4 accent-cyan-700"
                              disabled={coveredByParent}
                              onChange={() => toggleFolder(item.key)}
                              type="checkbox"
                            />
                            <Folder
                              size={17}
                              className="shrink-0 text-cyan-700"
                            />
                            <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                              {item.key}
                            </span>
                            {selected && (
                              <Check size={17} className="text-cyan-800" />
                            )}
                          </label>
                        );
                      })
                  )}
                </div>
                <div className="mt-5 flex flex-wrap items-end justify-between gap-4 border-t border-slate-100 pt-5">
                  <label className="text-sm font-semibold text-slate-700">
                    2. Access
                    <select aria-label="Folder access role" className="mt-1.5 block rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-cyan-600 focus:ring-4 focus:ring-cyan-100" value={inviteRole} onChange={(event) => setInviteRole(event.target.value as ClusterRole)}>
                      <option value="viewer">Viewer - download only</option>
                      <option value="editor">Editor - upload and edit</option>
                    </select>
                  </label>
                  <button
                  className="rounded-lg bg-cyan-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-cyan-800 disabled:bg-slate-300"
                  disabled={
                    selectedFolders.length === 0 || invitationMutation.isPending
                  }
                  onClick={() => invitationMutation.mutate()}
                >
                  {invitationMutation.isPending
                    ? "Creating keys…"
                    : `Create ${selectedFolders.length || ""} pairing ${selectedFolders.length === 1 ? "key" : "keys"}`}
                </button>
                </div>
                <details className="mt-4 text-sm text-slate-500">
                  <summary className="cursor-pointer font-semibold text-slate-600 hover:text-slate-900">Add a recipient label</summary>
                  <label className="mt-3 block text-sm font-semibold text-slate-700">Recipient label <span className="font-normal text-slate-400">optional</span>
                    <input aria-label="Pairing recipient" className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-cyan-600 focus:ring-4 focus:ring-cyan-100" maxLength={120} placeholder="e.g. Maya - Finance" value={recipient} onChange={(event) => setRecipient(event.target.value)} />
                  </label>
                </details>
                {createdInvites.length > 0 && (
                  <div className="mt-5 space-y-3 rounded-xl border border-cyan-200 bg-cyan-50 p-4">
                    <div>
                      <p className="text-sm font-semibold text-cyan-950">Send this to your collaborator</p>
                      <p className="mt-1 text-xs leading-5 text-cyan-900">They need your Drive URL and the key below. Each key works once and expires in 15 minutes.</p>
                    </div>
                    <div className="rounded-lg border border-cyan-200 bg-white p-3">
                      <p className="text-xs font-bold uppercase tracking-wide text-cyan-800">Zo Drive URL</p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <code className="min-w-0 flex-1 break-all rounded-md bg-slate-50 px-2.5 py-2 text-xs text-slate-700">{driveHomeUrl()}</code>
                        <button aria-label="Copy current Zo Drive URL" className="rounded-md border border-cyan-200 px-3 py-2 text-xs font-semibold text-cyan-800 hover:border-cyan-300 hover:bg-cyan-50" onClick={() => void copyText(driveHomeUrl(), "Zo Drive URL copied")} type="button">Copy URL</button>
                      </div>
                    </div>
                    {createdInvites.map((invite) => (
                      <div
                        className="rounded-lg border border-cyan-200 bg-white p-3"
                        key={invite.id}
                      >
                        <p className="text-sm font-semibold text-slate-900">
                          {invite.folder}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">{invite.recipient || "Unlabelled recipient"} · {invite.role === "viewer" ? "Viewer" : "Editor"}</p>
                        <code className="mt-2 block break-all text-xs leading-5 text-slate-700">
                          {invite.token}
                        </code>
                        <button
                          className="mt-2 text-xs font-semibold text-cyan-800 hover:text-cyan-950"
                          onClick={() =>
                            void copyText(
                              invite.token,
                              `${invite.folder} pairing key copied`,
                            )
                          }
                        >
                          Copy key
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="mt-6">
                <h3 className="text-sm font-semibold text-slate-900">Connect a folder shared with you</h3>
                <p className="mt-1 text-sm leading-6 text-slate-500">Paste the two details you received. Your own folders remain private.</p>
                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <label className="text-sm font-semibold text-slate-700">
                    Other Zo Drive URL
                    <input
                      aria-label="Remote Zo Drive URL"
                      className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-cyan-600 focus:ring-4 focus:ring-cyan-100"
                      placeholder="https://other-drive.example/drive"
                      value={remoteUrl}
                      onChange={(event) => setRemoteUrl(event.target.value)}
                    />
                  </label>
                  <label className="text-sm font-semibold text-slate-700">
                    Pairing key
                    <input
                      aria-label="Cluster pairing key"
                      className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-mono text-xs outline-none focus:border-cyan-600 focus:ring-4 focus:ring-cyan-100"
                      value={inviteToken}
                      onChange={(event) => setInviteToken(event.target.value)}
                    />
                  </label>
                </div>
                <button
                  className="mt-5 rounded-lg bg-cyan-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-cyan-800 disabled:bg-slate-300"
                  disabled={
                    !remoteUrl.trim() ||
                    !inviteToken.trim() ||
                    mountMutation.isPending
                  }
                  onClick={() => mountMutation.mutate()}
                >
                  {mountMutation.isPending
                    ? "Connecting…"
                    : "Join shared folder"}
                </button>
              </div>
            )}
          </div>
          <details className="border-t border-slate-100 px-5 py-4 text-sm text-slate-500 sm:px-6">
            <summary className="cursor-pointer font-semibold text-slate-600 hover:text-slate-900">How Shared Drives work</summary>
            <p className="mt-3 leading-6">A shared folder includes its current and future subfolders. Parent and sibling folders remain private. Viewers can download; Editors can create, rename and delete within the approved folder. Shared files appear in Recent and Shared with me.</p>
          </details>
      </section>
      </>}
      {(visibleInvitations.length > 0 || visiblePeers.length > 0) && (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <header className="border-b border-slate-100 px-5 py-4">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-cyan-700">Access you manage</p>
            <h2 className="mt-1 font-semibold text-slate-900">Exposed folders</h2>
            <p className="mt-1 text-sm text-slate-500">Cancel an unused pairing key, change active access between Viewer and Editor, or revoke it immediately.</p>
          </header>
          {visibleInvitations.length > 0 && <div className="border-b border-slate-100">
            <div className="bg-amber-50/70 px-5 py-3"><p className="text-xs font-bold uppercase tracking-[0.14em] text-amber-800">Pending pairing keys</p><p className="mt-1 text-xs text-amber-900">Keys are shown once at creation. Cancelled and expired keys cannot be used.</p></div>
            <div className="divide-y divide-slate-100">
              {visibleInvitations.map((invite) => (
                <div className="flex flex-wrap items-center gap-3 px-5 py-4" key={invite.id}>
                  <span className="grid size-9 place-items-center rounded-lg bg-amber-100 text-amber-800"><Clock3 size={17} /></span>
                  <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-slate-800">{invite.recipient || "Unlabelled recipient"}</span><span className="block truncate text-xs text-slate-500">{invite.folder} · expires {new Date(invite.expiresAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span></span>
                  <span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${invite.role === "editor" ? "bg-cyan-100 text-cyan-800" : "bg-slate-200 text-slate-600"}`}>{invite.role}</span>
                  <button className="rounded-lg px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:text-red-300" disabled={cancelInvitationMutation.isPending} onClick={() => { if (window.confirm(`Cancel the unused pairing key for ${invite.recipient || invite.folder}?`)) cancelInvitationMutation.mutate(invite.id); }}>Cancel key</button>
                </div>
              ))}
            </div>
          </div>}
          {visiblePeers.length > 0 && <div>
            <div className="bg-cyan-50/70 px-5 py-3"><p className="text-xs font-bold uppercase tracking-[0.14em] text-cyan-800">Active folder access</p><p className="mt-1 text-xs text-cyan-900">These recipients already redeemed a key and can reach the listed folder.</p></div>
            <div className="divide-y divide-slate-100">
            {visiblePeers.map((peer) => (
              <div className="flex flex-wrap items-center gap-3 px-5 py-4" key={peer.id}>
                <span className="grid size-9 place-items-center rounded-lg bg-cyan-100 text-cyan-800"><UsersRound size={17} /></span>
                <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-slate-800">{peer.recipient || "Unlabelled recipient"}</span><span className="block truncate text-xs text-slate-500">{peer.folder}</span></span>
                <select aria-label={`Access role for ${peer.folder}`} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 outline-none focus:border-cyan-600" disabled={updatePeerRoleMutation.isPending} value={peer.role} onChange={(event) => updatePeerRoleMutation.mutate({ id: peer.id, role: event.target.value as ClusterRole })}>
                  <option value="viewer">Viewer</option>
                  <option value="editor">Editor</option>
                </select>
                <button className="rounded-lg px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:text-red-300" disabled={revokePeerMutation.isPending} onClick={() => { if (window.confirm(`Revoke ${peer.recipient || "this recipient"}'s access to ${peer.folder}?`)) revokePeerMutation.mutate(peer.id); }}>Revoke</button>
              </div>
            ))}
            </div>
          </div>
          }
        </section>
      )}
      </>}
      {sharedDrivesTab === "connected" && <>
      {normalizedSearch && <section aria-label="Shared Drive file search results" className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><header className="border-b border-slate-100 px-5 py-4"><h2 className="font-semibold text-slate-900">Matching shared files</h2><p className="mt-1 text-sm text-slate-500">Files found across every connected Shared Drive.</p></header>{searchObjectsQuery.isPending ? <p className="p-5 text-sm text-slate-500">Searching connected folders…</p> : matchingSharedFiles.length === 0 ? <p className="p-5 text-sm text-slate-500">No shared files match “{search.trim()}”.</p> : <div className="divide-y divide-slate-100">{matchingSharedFiles.map(({ mount, object }) => <button className="flex w-full items-center gap-3 px-5 py-4 text-left hover:bg-slate-50" key={`${mount.id}:${object.key}`} onClick={() => setOpenMount(mount.id)}><File size={17} className="shrink-0 text-slate-400" /><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-slate-800">{object.name}</span><span className="block truncate text-xs text-slate-500">{mount.folder} / {object.key}</span></span><span className="text-xs text-slate-400">{formatBytes(object.size)}</span></button>)}</div>}</section>}
      {visibleMounts.length > 0 && (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <header className="border-b border-slate-100 px-5 py-4">
            <h2 className="font-semibold text-slate-900">Connected folders</h2>
            <p className="mt-1 text-sm text-slate-500">
              Credentials remain on this Zo; every action stays within the
              mounted folder.
            </p>
          </header>
          <div className="divide-y divide-slate-100">
            {visibleMounts.map((mount) => (
              <div className="flex items-center gap-3 px-5 py-4" key={mount.id}>
                <button
                  className="flex min-w-0 flex-1 items-center gap-3 text-left hover:text-cyan-800"
                  onClick={() => setOpenMount(mount.id)}
                >
                  <span className="grid size-9 place-items-center rounded-lg bg-cyan-100 text-cyan-800">
                    <Network size={17} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold text-slate-800">
                      {mount.folder}
                    </span>
                    <span className="block truncate text-xs text-slate-500">
                      {mount.remoteUrl}
                    </span>
                    <span className="mt-1 block text-xs text-slate-500">Shared by {sharedDriveAuthor(mount.author)}</span>
                    <span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${mount.role === "editor" ? "bg-cyan-100 text-cyan-800" : "bg-slate-200 text-slate-600"}`}>{sharedDriveRoleLabel(mount.role)}</span>
                  </span>
                </button>
                <button
                  className="rounded-lg px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50"
                  disabled={disconnectMutation.isPending}
                  onClick={() => {
                    if (
                      window.confirm(
                        `Disconnect ${mount.folder}? The remote peer credential will be revoked.`,
                      )
                    )
                      disconnectMutation.mutate(mount.id);
                  }}
                >
                  Disconnect
                </button>
              </div>
            ))}
          </div>
          {openMount && (
            <div className="border-t border-slate-100 bg-slate-50 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-800">
                    Shared files
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {canWrite
                      ? "Upload, rename, download, or move files to the owner's Trash."
                      : "View-only access. You can list and download files in this folder."}
                  </p>
                  {cacheStatus === "stale" && <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-amber-700"><Cloud size={14} /> Source offline. Showing the last cached folder state.</p>}
                </div>
                {canWrite && <div className="flex flex-wrap gap-2">
                  <input
                    className="hidden"
                    ref={remoteFileInput}
                    type="file"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) uploadMutation.mutate(file);
                      event.target.value = "";
                    }}
                  />
                  <button
                    className="rounded-lg bg-cyan-700 px-3 py-2 text-xs font-semibold text-white hover:bg-cyan-800 disabled:bg-slate-300"
                    disabled={uploadMutation.isPending}
                    onClick={() => remoteFileInput.current?.click()}
                  >
                    {uploadMutation.isPending ? "Uploading…" : "Upload file"}
                  </button>
                </div>}
              </div>
              {canWrite && <div className="mt-4 flex max-w-md gap-2">
                <input
                  aria-label="New shared folder"
                  className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-cyan-600 focus:ring-4 focus:ring-cyan-100"
                  placeholder="New folder path"
                  value={remoteFolder}
                  onChange={(event) => setRemoteFolder(event.target.value)}
                />
                <button
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:text-slate-300"
                  disabled={!remoteFolder.trim() || folderMutation.isPending}
                  onClick={() => folderMutation.mutate()}
                >
                  {folderMutation.isPending ? "Creating…" : "New folder"}
                </button>
              </div>}
              {objectsQuery.isPending ? (
                <p className="mt-4 text-sm text-slate-500">
                  Loading remote folder…
                </p>
              ) : (
                <div className="mt-4 space-y-2">
                  {visibleOpenMountObjects.map((object) => (
                    <div
                      className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2"
                      key={object.key}
                    >
                      <File size={17} className="text-slate-400" />
                      <span className="min-w-0 flex-1 truncate text-sm text-slate-700">
                        {object.key}
                      </span>
                      <span className="text-xs text-slate-400">
                        {formatBytes(object.size)}
                      </span>
                      <button
                        className="text-xs font-semibold text-cyan-700 hover:text-cyan-900"
                        onClick={() =>
                          void downloadObject(object.key, object.name)
                        }
                      >
                        Download
                      </button>
                      {canWrite && <button
                        className="text-xs font-semibold text-slate-600 hover:text-slate-900"
                        onClick={() => {
                          const name = window.prompt(
                            "New file name",
                            object.name,
                          );
                          if (name?.trim() && name.trim() !== object.name)
                            renameMutation.mutate({
                              key: object.key,
                              name: name.trim(),
                            });
                        }}
                      >
                        Rename
                      </button>}
                      {canWrite && <button
                        className="text-xs font-semibold text-red-600 hover:text-red-800"
                        onClick={() => {
                          if (
                            window.confirm(
                              `Move ${object.name} to the owner's Trash?`,
                            )
                          )
                            deleteMutation.mutate(object.key);
                        }}
                      >
                        Delete
                      </button>}
                    </div>
                  ))}
                  {visibleOpenMountObjects.length === 0 && (
                    <p className="text-sm text-slate-500">
                      {normalizedSearch ? `No files in this shared folder match “${search.trim()}”.` : "No files in this shared folder yet."}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </section>
      )}
      </>}
    </div>
  );
}

function Databases({ client, search }: { client: DriveClient; search: string }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [selectedEngine, setSelectedEngine] = useState<DatabaseEngineId>("sqlite");
  const [selectedId, setSelectedId] = useState<string | null>(() => new URLSearchParams(window.location.search).get("database"));
  const [selectedTable, setSelectedTable] = useState<string | null>(() => new URLSearchParams(window.location.search).get("table"));
  const [activePanel, setActivePanel] = useState<DatabasePanel>(currentDatabasePanel);
  const [databaseView, setDatabaseView] = useState<DatabaseView>(currentDatabaseView);
  const [deleteConfirmationOpen, setDeleteConfirmationOpen] = useState(false);
  const [sqliteInstalledLocally, setSqliteInstalledLocally] = useState(false);
  const [importSettingsOpen, setImportSettingsOpen] = useState(false);
  const [sql, setSql] = useState("SELECT name, sql FROM sqlite_master WHERE type = 'table' ORDER BY name");
  const [queryResult, setQueryResult] = useState<DatabaseRows | null>(null);
  const importInput = useRef<HTMLInputElement>(null);
  const supported = Boolean(client.listDatabases && client.createDatabase && client.deleteDatabase && client.executeDatabase && client.exportDatabase && client.getDatabaseImportSettings && client.importDatabase && client.installDatabaseEngine && client.listDatabaseApiKeys && client.listDatabaseEngines && client.listDatabaseTables && client.listDatabaseRows && client.queryDatabase && client.setDatabaseImportLimit && client.updateDatabaseEngine);
  const enginesQuery = useQuery({ queryKey: ["database-engines"], queryFn: () => client.listDatabaseEngines!(), enabled: supported });
  const sqliteEngine = enginesQuery.data?.find((engine) => engine.engine === "sqlite");
  const sqliteInstalled = sqliteInstalledLocally || sqliteEngine?.installed === true;
  const installedEngines = (enginesQuery.data ?? []).filter((engine) => engine.installed);
  const anyEngineInstalled = installedEngines.length > 0;
  useEffect(() => {
    if (installedEngines.length > 0 && !installedEngines.some((engine) => engine.engine === selectedEngine)) setSelectedEngine(installedEngines[0]!.engine);
  }, [enginesQuery.data, selectedEngine]);
  const databasesQuery = useQuery({
    queryKey: ["databases"],
    queryFn: () => client.listDatabases!(),
    enabled: supported
  });
  const normalizedSearch = search.trim().toLowerCase();
  const allDatabases = databasesQuery.data ?? [];
  const databases = allDatabases.filter((database) => matchesSearch(normalizedSearch, database.name, database.engine));
  const importSettingsQuery = useQuery({ queryKey: ["database-import-settings"], queryFn: () => client.getDatabaseImportSettings!(), enabled: supported && sqliteInstalled });
  const selectedDatabase = allDatabases.find((database) => database.id === selectedId) ?? null;
  const activeDatabase = databaseView === "instances" ? selectedDatabase : null;
  const tablesQuery = useQuery({
    queryKey: ["database-tables", activeDatabase?.id],
    queryFn: () => client.listDatabaseTables!(activeDatabase!.id),
    enabled: supported && sqliteInstalled && activeDatabase?.engine === "sqlite"
  });
  const tables = tablesQuery.data ?? [];
  const activeTable = tables.find((table) => table.name === selectedTable) ?? tables[0] ?? null;

  useEffect(() => {
    if (activeDatabase && activeDatabase.engine !== "sqlite" && activePanel !== "run" && activePanel !== "access") setActivePanel("run");
  }, [activeDatabase, activePanel]);

  useEffect(() => {
    if (!normalizedSearch || !anyEngineInstalled) return;
    setDatabaseView("instances");
    setSelectedId(null);
    setSelectedTable(null);
  }, [anyEngineInstalled, normalizedSearch]);

  useEffect(() => {
    updateDriveUrl({
      database: activeDatabase?.id ?? null,
      databaseView: databaseView === "catalog" ? "catalog" : null,
      databasePanel: activeDatabase ? activePanel : null,
      table: activeDatabase && activePanel === "data" ? activeTable?.name ?? null : null
    });
  }, [activeDatabase?.id, activePanel, activeTable?.name, databaseView]);

  useEffect(() => {
    const restoreWorkspace = () => {
      const params = new URLSearchParams(window.location.search);
      setSelectedId(params.get("database"));
      setSelectedTable(params.get("table"));
      setActivePanel(currentDatabasePanel());
      setDatabaseView(currentDatabaseView());
    };
    window.addEventListener("popstate", restoreWorkspace);
    return () => window.removeEventListener("popstate", restoreWorkspace);
  }, []);
  const rowsQuery = useQuery({
    queryKey: ["database-rows", activeDatabase?.id, activeTable?.name],
    queryFn: () => client.listDatabaseRows!({ id: activeDatabase!.id, table: activeTable!.name }),
    enabled: supported && sqliteInstalled && activeDatabase?.engine === "sqlite" && Boolean(activeTable)
  });
  const createMutation = useMutation({
    mutationFn: () => client.createDatabase!(name.trim(), selectedEngine),
    onSuccess: async (database) => {
      setName("");
      setSelectedId(database.id);
      setSelectedTable(null);
      setActivePanel(database.engine === "sqlite" ? "data" : "run");
      setDatabaseView("instances");
      await queryClient.invalidateQueries({ queryKey: ["databases"] });
      toast.success(`${database.name} created`);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not create the database")
  });
  const installEngineMutation = useMutation({
    mutationFn: (engine: DatabaseEngineId) => client.installDatabaseEngine!(engine),
    onSuccess: (installation) => {
      if (installation.engine === "sqlite") setSqliteInstalledLocally(true);
      queryClient.setQueryData(["database-engines"], (engines: typeof enginesQuery.data) => {
        if (!engines) return [installation];
        return engines.some((engine) => engine.engine === installation.engine)
          ? engines.map((engine) => engine.engine === installation.engine ? installation : engine)
          : [...engines, installation];
      });
      setSelectedEngine(installation.engine);
      toast.success(`${installation.name} ${installation.installedVersion ?? installation.availableVersion} installed and ready to create databases.`);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not install the database engine")
  });
  const updateEngineMutation = useMutation({
    mutationFn: (engine: DatabaseEngineId) => client.updateDatabaseEngine!(engine),
    onSuccess: (installation) => {
      queryClient.setQueryData(["database-engines"], (engines: typeof enginesQuery.data) => engines?.map((engine) => engine.engine === installation.engine ? installation : engine) ?? [installation]);
      toast.success(`${installation.name} updated to ${installation.installedVersion}.`);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not update the database engine")
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => client.deleteDatabase!(id),
    onSuccess: async () => {
      setSelectedId(null);
      setSelectedTable(null);
      setQueryResult(null);
      setDeleteConfirmationOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["databases"] });
      toast.success("Database deleted");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not delete the database")
  });
  const importMutation = useMutation({
    mutationFn: (file: File) => client.importDatabase!({ file, name: databaseNameFromFile(file.name) }),
    onSuccess: async (database) => {
      setSelectedId(database.id);
      setSelectedTable(null);
      setQueryResult(null);
      setActivePanel("data");
      setDatabaseView("instances");
      await queryClient.invalidateQueries({ queryKey: ["databases"] });
      toast.success(`${database.name} imported`);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not import the SQLite database")
  });
  const exportMutation = useMutation({
    mutationFn: () => client.exportDatabase!(activeDatabase!.id),
    onSuccess: (file) => {
      const url = URL.createObjectURL(file);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${activeDatabase?.name ?? "database"}.sqlite`;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
      toast.success("SQLite database exported");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not export the SQLite database")
  });
  const updateImportLimitMutation = useMutation({
    mutationFn: (importLimitBytes: number) => client.setDatabaseImportLimit!(importLimitBytes),
    onSuccess: async (settings) => {
      await queryClient.invalidateQueries({ queryKey: ["database-import-settings"] });
      setImportSettingsOpen(false);
      toast.success(`Import limit set to ${formatBytes(settings.importLimitBytes)}`);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not update the import limit")
  });
  const queryMutation = useMutation({
    mutationFn: () => client.queryDatabase!({ id: activeDatabase!.id, sql }),
    onSuccess: async (result) => {
      setQueryResult({ columns: result.columns, rows: result.rows, total: result.rows.length });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["databases"] }),
        queryClient.invalidateQueries({ queryKey: ["database-tables", activeDatabase?.id] }),
        queryClient.invalidateQueries({ queryKey: ["database-rows", activeDatabase?.id] })
      ]);
      await tablesQuery.refetch();
      toast.success(result.columns.length > 0 ? `${result.rows.length} row${result.rows.length === 1 ? "" : "s"} returned` : `${result.changes} row${result.changes === 1 ? "" : "s"} changed`);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not run SQL")
  });

  if (!supported) {
    return <section className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm"><h2 className="text-xl font-semibold text-slate-900">Database tools are unavailable</h2><p className="mt-2 text-sm text-slate-500">Update the Zo Drive API and browser workspace together to use Database Engines.</p></section>;
  }

  const panels = activeDatabase?.engine === "sqlite" ? [
    { id: "data" as const, label: "Data" },
    { id: "sql" as const, label: "SQL editor" },
    { id: "access" as const, label: "Backend access" }
  ] : [
    { id: "run" as const, label: databaseRunnerLabel(activeDatabase?.engine) },
    { id: "access" as const, label: "Backend access" }
  ];

  const showWorkspace = databaseView === "instances" && anyEngineInstalled;

  return <><nav aria-label="Database views" className="inline-flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm"><button aria-current={!showWorkspace ? "page" : undefined} className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${!showWorkspace ? "bg-slate-900 text-white shadow-sm" : "text-slate-500 hover:text-slate-900"}`} onClick={() => setDatabaseView("catalog")} type="button">Catalog</button><button aria-current={showWorkspace ? "page" : undefined} className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${showWorkspace ? "bg-slate-900 text-white shadow-sm" : "text-slate-500 hover:text-slate-900"}`} disabled={!anyEngineInstalled} onClick={() => { setSelectedId(null); setSelectedTable(null); setQueryResult(null); setDeleteConfirmationOpen(false); setDatabaseView("instances"); }} title={anyEngineInstalled ? undefined : "Install an engine to create databases"} type="button">Your databases <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-xs ${showWorkspace ? "bg-white/15 text-white" : "bg-slate-100 text-slate-500"}`}>{databases.length}</span></button></nav>
  {!showWorkspace ? <DatabaseCatalog engineStates={enginesQuery.data ?? []} installingEngine={installEngineMutation.isPending ? installEngineMutation.variables : null} updatingEngine={updateEngineMutation.isPending ? updateEngineMutation.variables : null} onCreateDatabase={(engine) => { setSelectedEngine(engine); setSelectedId(null); setDatabaseView("instances"); }} onInstallEngine={(engine) => installEngineMutation.mutate(engine)} onUpdateEngine={(engine) => updateEngineMutation.mutate(engine)} /> : <div className={`mt-8 ${activeDatabase ? "" : "grid gap-5 md:grid-cols-[15rem_minmax(0,1fr)]"}`}>
    {!activeDatabase && <aside className="self-stretch overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 p-4">
        <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Installed engines</p><h2 className="mt-1 text-lg font-semibold text-slate-900">Your instances</h2></div><span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-500">{databases.length}</span></div>
        <form className="mt-4 space-y-2" onSubmit={(event) => { event.preventDefault(); if (name.trim()) createMutation.mutate(); }}><select aria-label="Database engine" className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" value={selectedEngine} onChange={(event) => setSelectedEngine(event.target.value as DatabaseEngineId)}>{installedEngines.map((engine) => <option key={engine.engine} value={engine.engine}>{engine.name} {engine.installedVersion ? `v${engine.installedVersion}` : ""}</option>)}</select><div className="flex gap-2"><input aria-label="New database name" className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" maxLength={80} placeholder="New database" value={name} onChange={(event) => setName(event.target.value)} /><button aria-label="Create database" className="grid size-9 shrink-0 place-items-center rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:bg-slate-300" disabled={!name.trim() || createMutation.isPending} type="submit"><Plus size={17} /></button></div></form>
        <input accept=".db,.sqlite,.sqlite3,application/vnd.sqlite3,application/x-sqlite3" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) importMutation.mutate(file); event.target.value = ""; }} ref={importInput} type="file" />
        {sqliteInstalled && <><button className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:text-slate-400" disabled={importMutation.isPending} onClick={() => importInput.current?.click()} type="button"><Upload size={16} />{importMutation.isPending ? "Importing…" : "Import SQLite file"}</button><button className="mt-2 w-full text-center text-xs font-medium text-slate-500 hover:text-blue-600" onClick={() => setImportSettingsOpen(true)} type="button">Import limit: {formatBytes(importSettingsQuery.data?.importLimitBytes ?? 0)}</button></>}
      </div>
      {databasesQuery.isPending ? <p className="p-5 text-sm text-slate-500">Loading databases…</p> : databases.length === 0 ? <p className="p-5 text-sm leading-6 text-slate-500">{normalizedSearch ? `No databases match “${search.trim()}”.` : "Choose an installed engine and create a private database."}</p> : <div className="p-2">{databases.map((database) => <button className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-slate-700 transition hover:bg-slate-50" key={database.id} onClick={() => { setSelectedId(database.id); setSelectedEngine(database.engine); setSelectedTable(null); setQueryResult(null); setDeleteConfirmationOpen(false); setActivePanel(database.engine === "sqlite" ? "data" : "run"); setDatabaseView("instances"); }}><span className="grid size-9 place-items-center rounded-lg bg-slate-100 text-slate-500"><Database size={18} /></span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{database.name}</span><span className="mt-0.5 block text-xs font-medium text-slate-400">{database.engine} · {formatBytes(database.sizeBytes)}</span></span></button>)}</div>}
    </aside>}

    <div className="min-w-0">
      {!activeDatabase ? <section className="grid min-h-96 place-items-center rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center"><div><span className="mx-auto grid size-12 place-items-center rounded-2xl bg-blue-50 text-blue-600"><Database size={24} /></span><h2 className="mt-4 text-xl font-semibold text-slate-900">Choose a database to open its workspace.</h2><p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">Each database opens in its own full-width screen, with its own data tools and backend access.</p></div></section> : <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <header className="flex flex-wrap items-center justify-between gap-4 px-5 py-5 sm:px-6"><div className="flex min-w-0 items-center gap-3"><button aria-label="Back to your databases" className="grid size-9 shrink-0 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900" onClick={() => { setSelectedId(null); setSelectedTable(null); setQueryResult(null); setDeleteConfirmationOpen(false); }} title="Back to your databases" type="button"><ArrowLeft size={18} /></button><span className="grid size-11 shrink-0 place-items-center rounded-xl bg-blue-600 text-white shadow-sm"><Database size={21} /></span><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h2 className="truncate text-xl font-semibold text-slate-900">{activeDatabase.name}</h2><span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">Private</span></div><p className="mt-1 text-sm capitalize text-slate-500">{activeDatabase.engine} · {formatBytes(activeDatabase.sizeBytes)}{activeDatabase.engine === "sqlite" ? ` · ${tables.length} table${tables.length === 1 ? "" : "s"}` : " · Native workspace · HTTPS access"}</p></div></div><div className="flex items-center gap-2">{activeDatabase.engine === "sqlite" && <button className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 disabled:text-slate-400" disabled={exportMutation.isPending} onClick={() => exportMutation.mutate()} type="button"><Download size={16} />{exportMutation.isPending ? "Exporting…" : "Export"}</button>}<button aria-label="Delete database" className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:text-red-300" disabled={deleteMutation.isPending} onClick={() => setDeleteConfirmationOpen(true)} type="button"><Trash2 size={16} />Delete</button></div></header>
        {deleteConfirmationOpen && <div className="flex flex-wrap items-center justify-between gap-3 border-t border-red-100 bg-red-50 px-5 py-4 sm:px-6"><div><p className="text-sm font-semibold text-red-900">Permanently delete {activeDatabase.name}?</p><p className="mt-1 text-xs leading-5 text-red-700">This removes its data, runtime files, and database-scoped keys. It cannot be undone.</p></div><div className="flex gap-2"><button className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-white/70" onClick={() => setDeleteConfirmationOpen(false)} type="button">Cancel</button><button className="rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:bg-red-300" disabled={deleteMutation.isPending} onClick={() => deleteMutation.mutate(activeDatabase.id)} type="button">{deleteMutation.isPending ? "Deleting…" : "Delete permanently"}</button></div></div>}
        <nav aria-label="Database workspace" className="flex gap-1 border-y border-slate-100 bg-slate-50 px-3 py-2 sm:px-4">{panels.map((panel) => <button aria-current={activePanel === panel.id ? "page" : undefined} className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${activePanel === panel.id ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200" : "text-slate-500 hover:text-slate-900"}`} key={panel.id} onClick={() => setActivePanel(panel.id)} type="button">{panel.label}</button>)}</nav>
        {activePanel === "data" && <div className="grid min-h-[30rem] md:grid-cols-[13.5rem_minmax(0,1fr)]"><aside className="border-b border-slate-100 bg-slate-50/70 p-3 md:border-b-0 md:border-r"><div className="flex items-center justify-between px-2 pb-2"><p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">Tables</p><span className="text-xs font-semibold text-slate-400">{tables.length}</span></div>{tablesQuery.isPending ? <p className="px-2 py-3 text-sm text-slate-500">Loading…</p> : tables.length === 0 ? <div className="px-2 py-4"><p className="text-sm leading-5 text-slate-500">No tables yet.</p><button className="mt-3 text-sm font-semibold text-blue-600 hover:text-blue-700" onClick={() => setActivePanel("sql")}>Create with SQL</button></div> : tables.map((table) => <button className={`mb-1 flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-sm font-medium ${activeTable?.name === table.name ? "bg-white text-blue-700 shadow-sm ring-1 ring-slate-200" : "text-slate-600 hover:bg-white"}`} key={table.name} onClick={() => { setSelectedTable(table.name); setQueryResult(null); }}><span className="truncate">{table.name}</span><span className="size-1.5 shrink-0 rounded-full bg-current opacity-50" /></button>)}</aside><div className="min-w-0 p-5 sm:p-6">{activeTable ? <DatabaseTableGrid data={rowsQuery.data} isLoading={rowsQuery.isPending} tableName={activeTable.name} total={rowsQuery.data?.total ?? 0} /> : <div className="grid h-full min-h-56 place-items-center text-center"><div><Database className="mx-auto text-slate-300" size={28} /><p className="mt-3 text-sm text-slate-500">Create a table, then select it here to browse its rows.</p></div></div>}</div></div>}
        {activePanel === "sql" && <section className="bg-slate-950"><header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-4 sm:px-6"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-cyan-300">SQL editor</p><p className="mt-1 text-sm text-slate-300">One parameterised SQL statement at a time.</p></div><button className="rounded-lg bg-cyan-300 px-3 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-200 disabled:bg-slate-600 disabled:text-slate-300" disabled={queryMutation.isPending || !sql.trim()} onClick={() => queryMutation.mutate()}>{queryMutation.isPending ? "Running…" : "Run query"}</button></header><textarea aria-label="SQL query" className="min-h-72 w-full resize-y border-0 bg-slate-950 p-5 font-mono text-sm leading-6 text-slate-100 outline-none placeholder:text-slate-500 sm:p-6" spellCheck={false} value={sql} onChange={(event) => setSql(event.target.value)} />{queryResult && <div className="border-t border-white/10 bg-slate-900 p-5 sm:p-6"><DatabaseTableGrid data={queryResult} isLoading={false} tableName="Query results" total={queryResult.total} dark /></div>}</section>}
        {activePanel === "run" && <DatabaseRunner client={client} database={activeDatabase} />}
        {activePanel === "access" && <div className="p-4 sm:p-6"><DatabaseConnection client={client} database={activeDatabase} /></div>}
      </section>}
    </div>
  </div>}{importSettingsOpen && importSettingsQuery.data && <DatabaseImportSettingsDialog isSaving={updateImportLimitMutation.isPending} onClose={() => setImportSettingsOpen(false)} onSave={(importLimitBytes) => updateImportLimitMutation.mutate(importLimitBytes)} settings={importSettingsQuery.data} />}</>;
}

type DatabaseRunnerConfig = {
  description: string;
  examples: Array<{ label: string; request: Record<string, unknown> }>;
  label: string;
};

function databaseRunnerLabel(engine: DatabaseEngineId | undefined): string {
  if (engine === "duckdb" || engine === "libsql" || engine === "pglite") return "SQL workspace";
  if (engine === "kuzu") return "Cypher workspace";
  return "Native workspace";
}

function databaseRunnerConfig(engine: DatabaseEngineId): DatabaseRunnerConfig {
  if (engine === "duckdb" || engine === "libsql" || engine === "pglite") return {
    label: "SQL workspace",
    description: "Run one SQL statement using this engine's native dialect. Parameters are an optional JSON array.",
    examples: [{ label: "Check connection", request: { query: "SELECT 1 AS ready", params: [] } }]
  };
  if (engine === "kuzu") return {
    label: "Cypher workspace",
    description: "Run one Cypher statement. Parameters are an optional JSON object keyed by parameter name.",
    examples: [
      { label: "Check connection", request: { query: "RETURN 1 AS ready", params: {} } },
      { label: "Browse graph", request: { query: "MATCH (n) RETURN n LIMIT 25", params: {} } }
    ]
  };
  if (engine === "redis") return {
    label: "Redis workspace",
    description: "Run an enabled Redis command with its arguments. Commands run only inside this private database.",
    examples: [
      { label: "Ping", request: { command: "PING", args: [] } },
      { label: "Scan keys", request: { command: "SCAN", args: ["0"] } }
    ]
  };
  if (engine === "leveldb") return {
    label: "LevelDB workspace",
    description: "Read, write, delete, or scan the key-value entries in this database.",
    examples: [
      { label: "Scan entries", request: { operation: "scan", limit: 100 } },
      { label: "Read a key", request: { operation: "get", key: "customer:1" } }
    ]
  };
  return {
    label: "LanceDB workspace",
    description: "List tables, create a table, add records, or run a vector search using LanceDB's native request contract.",
    examples: [
      { label: "List tables", request: { operation: "listTables" } },
      { label: "Vector search", request: { operation: "search", table: "documents", vector: [0.1, 0.2, 0.3], limit: 10 } }
    ]
  };
}

function formatDatabaseRequest(request: Record<string, unknown>): string {
  return JSON.stringify(request, null, 2);
}

function databaseRecordRequest(engine: DatabaseEngineId): Record<string, unknown> | null {
  if (engine === "redis") return { command: "SCAN", args: ["0", "COUNT", "100"] };
  if (engine === "leveldb") return { operation: "scan", limit: 100 };
  if (engine === "lancedb") return { operation: "listTables" };
  if (engine === "kuzu") return { query: "MATCH (n) RETURN n LIMIT 100", params: {} };
  return null;
}

function databaseRecordsFromResult(engine: DatabaseEngineId, result: unknown): DatabaseRows {
  if (engine === "leveldb" && result && typeof result === "object" && Array.isArray((result as { entries?: unknown }).entries)) {
    const rows = (result as { entries: unknown[] }).entries.filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === "object" && !Array.isArray(entry));
    return { columns: ["key", "value"], rows, total: rows.length };
  }
  if (engine === "lancedb" && result && typeof result === "object" && Array.isArray((result as { tables?: unknown }).tables)) {
    const rows = (result as { tables: unknown[] }).tables.filter((table): table is string => typeof table === "string").map((table) => ({ table }));
    return { columns: ["table"], rows, total: rows.length };
  }
  if (result && typeof result === "object" && Array.isArray((result as { columns?: unknown }).columns) && Array.isArray((result as { rows?: unknown }).rows)) {
    const columns = (result as { columns: unknown[] }).columns.filter((column): column is string => typeof column === "string");
    const rows = (result as { rows: unknown[] }).rows.filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === "object" && !Array.isArray(row));
    return { columns, rows, total: rows.length };
  }
  return { columns: ["result"], rows: [{ result }], total: 1 };
}

function redisValueRequest(key: string, type: string): Record<string, unknown> | null {
  if (type === "string") return { command: "GET", args: [key] };
  if (type === "hash") return { command: "HGETALL", args: [key] };
  if (type === "list") return { command: "LRANGE", args: [key, "0", "-1"] };
  if (type === "set") return { command: "SMEMBERS", args: [key] };
  if (type === "zset") return { command: "ZRANGE", args: [key, "0", "-1", "WITHSCORES"] };
  if (type === "stream") return { command: "XRANGE", args: [key, "-", "+"] };
  return null;
}

async function browseDatabaseRecords(client: DriveClient, database: DriveDatabase, request: Record<string, unknown>): Promise<DatabaseRows> {
  const response = await client.executeDatabase!({ id: database.id, request });
  if (database.engine !== "redis") return databaseRecordsFromResult(database.engine, response.result);
  const keys = Array.isArray(response.result) && Array.isArray(response.result[1]) ? response.result[1].filter((key): key is string => typeof key === "string") : [];
  const rows = await Promise.all(keys.map(async (key) => {
    const typeResponse = await client.executeDatabase!({ id: database.id, request: { command: "TYPE", args: [key] } });
    const type = typeof typeResponse.result === "string" ? typeResponse.result : "unknown";
    const valueRequest = redisValueRequest(key, type);
    if (!valueRequest) return { key, type, value: "Use the native runner to inspect this Redis value." };
    const valueResponse = await client.executeDatabase!({ id: database.id, request: valueRequest });
    return { key, type, value: valueResponse.result };
  }));
  return { columns: ["key", "type", "value"], rows, total: rows.length };
}

function DatabaseRunner({ client, database }: { client: DriveClient; database: DriveDatabase }) {
  const config = databaseRunnerConfig(database.engine);
  const recordRequest = databaseRecordRequest(database.engine);
  const [requestText, setRequestText] = useState(() => formatDatabaseRequest(config.examples[0]!.request));
  const [result, setResult] = useState<DatabaseExecuteResult | null>(null);
  const [recordPreview, setRecordPreview] = useState<DatabaseRows | null>(null);

  useEffect(() => {
    const nextConfig = databaseRunnerConfig(database.engine);
    setRequestText(formatDatabaseRequest(nextConfig.examples[0]!.request));
    setResult(null);
    setRecordPreview(null);
  }, [database.engine, database.id]);

  const executeMutation = useMutation({
    mutationFn: () => {
      let request: unknown;
      try {
        request = JSON.parse(requestText);
      } catch {
        throw new Error("Enter a valid JSON request");
      }
      if (!request || typeof request !== "object" || Array.isArray(request)) throw new Error("The request must be a JSON object");
      return client.executeDatabase!({ id: database.id, request: request as Record<string, unknown> });
    },
    onSuccess: (response) => {
      setResult(response);
      toast.success(`${config.label} completed`);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not run the database request")
  });

  const browseMutation = useMutation({
    mutationFn: async () => {
      if (!recordRequest) throw new Error("Use a read query in the workspace to view this engine's records");
      return browseDatabaseRecords(client, database, recordRequest);
    },
    onSuccess: (records) => {
      setRecordPreview(records);
      toast.success(records.total === 0 ? "No records found" : `${records.total} record${records.total === 1 ? "" : "s"} loaded`);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not load records")
  });

  return <section className="bg-slate-950 text-slate-100"><header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-4 sm:px-6"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-cyan-300">{config.label} · {database.engine}</p><p className="mt-1 max-w-2xl text-sm leading-6 text-slate-300">{config.description}</p></div><div className="flex flex-wrap gap-2">{recordRequest && <button className="rounded-lg border border-cyan-300/35 px-3 py-2 text-sm font-semibold text-cyan-100 hover:bg-cyan-300/10 disabled:text-slate-500" disabled={browseMutation.isPending || executeMutation.isPending} onClick={() => browseMutation.mutate()} type="button">{browseMutation.isPending ? "Loading records…" : "View records"}</button>}<button className="rounded-lg bg-cyan-300 px-3 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-200 disabled:bg-slate-600 disabled:text-slate-300" disabled={executeMutation.isPending || browseMutation.isPending} onClick={() => executeMutation.mutate()} type="button">{executeMutation.isPending ? "Running…" : "Run request"}</button></div></header>{recordPreview && <div className="border-b border-white/10 bg-slate-900 p-5 sm:p-6"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-cyan-300">Records</p><p className="mt-1 text-sm text-slate-300">{database.engine === "redis" ? "Keys, types, and values in this Redis database." : "Loaded from this private database."}</p></div><button className="text-xs font-semibold text-slate-300 hover:text-white" onClick={() => setRecordPreview(null)} type="button">Hide records</button></div><div className="mt-4"><DatabaseTableGrid data={recordPreview} isLoading={false} tableName="records" total={recordPreview.total} dark /></div></div>}<div className="p-5 sm:p-6"><div className="flex flex-wrap gap-2">{config.examples.map((example) => <button className="rounded-lg border border-white/15 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:border-cyan-300/50 hover:bg-white/10 hover:text-cyan-100" key={example.label} onClick={() => setRequestText(formatDatabaseRequest(example.request))} type="button">{example.label}</button>)}</div><label className="mt-4 block text-sm font-semibold text-slate-200">Native request JSON<textarea aria-label={`${config.label} request`} className="mt-2 min-h-72 w-full resize-y rounded-xl border border-white/10 bg-slate-900 p-4 font-mono text-sm leading-6 text-slate-100 outline-none focus:border-cyan-300 focus:ring-4 focus:ring-cyan-300/15" spellCheck={false} value={requestText} onChange={(event) => setRequestText(event.target.value)} /></label></div>{result && <div className="border-t border-white/10 bg-slate-900 p-5 sm:p-6"><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-cyan-300">Live result</p><p className="mt-1 text-sm text-slate-300">Returned from {result.engine} in this private database.</p></div><button aria-label="Copy database result" className="rounded-lg border border-white/15 p-2 text-slate-300 hover:bg-white/10 hover:text-white" onClick={() => void copyText(JSON.stringify(result.result, null, 2), "Database result copied")}><Copy size={16} /></button></div><pre aria-label="Database request result" className="mt-4 max-h-[32rem] overflow-auto rounded-xl border border-white/10 bg-slate-950 p-4 text-xs leading-6 text-slate-100"><code>{JSON.stringify(result.result, null, 2)}</code></pre></div>}</section>;
}

function DatabaseCatalog({ engineStates, installingEngine, updatingEngine, onCreateDatabase, onInstallEngine, onUpdateEngine }: { engineStates: DatabaseEngine[]; installingEngine: DatabaseEngineId | null | undefined; updatingEngine: DatabaseEngineId | null | undefined; onCreateDatabase: (engine: DatabaseEngineId) => void; onInstallEngine: (engine: DatabaseEngineId) => void; onUpdateEngine: (engine: DatabaseEngineId) => void }) {
  const catalog = [
    { engine: "sqlite" as const, name: "SQLite", category: "Relational", description: "A dependable, single-file SQL database for products, automations, and local apps.", detail: "Embedded · SQL · single file", icon: Database },
    { engine: "duckdb" as const, name: "DuckDB", category: "Analytics", description: "Fast in-process analytics for parquet files, reports, and analytical workloads.", detail: "Columnar · OLAP · embedded", icon: Sigma },
    { engine: "libsql" as const, name: "libSQL", category: "Relational", description: "A SQLite-compatible engine built for modern app workflows and replication.", detail: "SQL · SQLite-compatible", icon: Cloud },
    { engine: "pglite" as const, name: "PGlite", category: "Relational", description: "A compact PostgreSQL runtime for local-first applications and familiar Postgres SQL.", detail: "Postgres-compatible · local", icon: HardDrive },
    { engine: "lancedb" as const, name: "LanceDB", category: "Vector", description: "Embedded vector search for AI applications that need retrieval beside structured data.", detail: "Vectors · AI retrieval", icon: Code2 },
    { engine: "leveldb" as const, name: "LevelDB", category: "Key-value", description: "A lightweight embedded key-value store for simple high-throughput application state.", detail: "Key-value · embedded", icon: Database },
    { engine: "redis" as const, name: "Redis", category: "In-memory", description: "A fast data-structure server for cache, queues, sessions, and real-time application state.", detail: "Cache · streams · key-value", icon: RefreshCw },
    { engine: "kuzu" as const, name: "Kuzu", category: "Graph", description: "A lightweight embedded graph database for connected data, relationships, and knowledge graphs.", detail: "Graph · Cypher · embedded", icon: Share2 }
  ];
  return <section className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
    <div className="relative overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 px-7 py-9 text-white md:px-10"><div className="absolute -right-28 -top-32 size-80 rounded-full bg-cyan-400/15 blur-3xl" /><div className="absolute -bottom-36 left-1/3 size-72 rounded-full bg-blue-500/10 blur-3xl" /><div className="relative"><span className="inline-flex items-center gap-2 rounded-full border border-cyan-200/20 bg-cyan-200/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-100"><Database size={14} /> Real runtimes, private data</span><h2 className="mt-4 text-3xl font-semibold tracking-tight md:text-4xl">Build with Zo Databases</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300 md:text-base">Install a vetted engine runtime, create a persistent database, then connect through a database-scoped HTTPS key.</p><p className="mt-4 text-xs font-medium text-cyan-100/80">Inspired by DBeaver + Cloud Hosting.</p></div></div>
    <div className="border-b border-slate-100 bg-slate-50 px-6 py-4 sm:px-8"><p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Open-source database catalog</p><p className="mt-1 text-sm text-slate-600">Install provisions and verifies the actual runtime. Update rechecks the bundled provider and records its active version.</p></div>
    <div className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6 xl:grid-cols-3">
      {catalog.map((engine) => { const Icon = engine.icon; const installation = engineStates.find((candidate) => candidate.engine === engine.engine); const installed = installation?.installed === true; const installing = installingEngine === engine.engine; const updating = updatingEngine === engine.engine; const updateLabel = updating ? "Updating…" : installation?.updateAvailable ? "Update available" : "Update"; return <article className={`group flex min-h-72 flex-col rounded-2xl border p-5 transition ${installed ? "border-blue-300 bg-gradient-to-br from-blue-50 via-white to-white shadow-sm" : "border-slate-200 bg-white hover:border-slate-300"}`} key={engine.engine}><div className="flex items-start justify-between gap-3"><span className={`grid size-11 place-items-center rounded-xl ${installed ? "bg-blue-600 text-white shadow-sm" : "bg-slate-100 text-slate-500"}`}><Icon size={21} /></span><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${installed ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{installed ? "Installed" : "Ready to install"}</span></div><div className="mt-5"><p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">{engine.category}</p><h3 className="mt-1.5 text-xl font-semibold text-slate-900">{engine.name}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{engine.description}</p></div><div className="mt-auto pt-5"><p className="text-xs font-medium text-slate-400">{engine.detail}</p><p className="mt-2 truncate font-mono text-[11px] text-slate-400" title={installation?.packageName}>{installation?.packageName ?? "Loading provider…"}{installed && ` · v${installation?.installedVersion ?? "legacy"}`}</p>{!installed ? <div className="mt-4" data-testid={`database-engine-actions-${engine.engine}`}><button aria-label={`Install ${engine.name}`} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 hover:shadow disabled:bg-slate-400 disabled:shadow-none" disabled={Boolean(installingEngine)} onClick={() => onInstallEngine(engine.engine)} type="button">{installing ? "Installing…" : `Install ${engine.name}`} <Download size={16} /></button></div> : <div className="mt-4 grid grid-cols-[minmax(0,1fr)_2.75rem] gap-2" data-testid={`database-engine-actions-${engine.engine}`}><button aria-label={`Create ${engine.name} database`} className="inline-flex min-w-0 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 hover:shadow" onClick={() => onCreateDatabase(engine.engine)} type="button">Create database <ArrowUpRight className="shrink-0" size={16} /></button><button aria-label={`Update ${engine.name}`} className={`grid size-11 place-items-center rounded-xl border bg-white text-slate-500 shadow-sm transition hover:border-slate-400 hover:bg-slate-50 hover:text-slate-900 disabled:text-slate-300 disabled:shadow-none ${installation?.updateAvailable ? "border-amber-300 text-amber-700 hover:border-amber-400 hover:bg-amber-50 hover:text-amber-800" : "border-slate-200"}`} disabled={Boolean(updatingEngine)} onClick={() => onUpdateEngine(engine.engine)} title={updateLabel} type="button">{updating ? <LoaderCircle className="animate-spin" size={18} /> : <RefreshCw size={18} />}<span className="sr-only">{updateLabel}</span></button></div>}</div></article>;})}
    </div>
    <div className="border-t border-slate-100 bg-slate-50 px-6 py-4 text-sm leading-6 text-slate-500 sm:px-8">Every engine stores data privately under this Drive and is exposed only through database-scoped HTTPS keys.</div>
  </section>;
}

function DatabaseImportSettingsDialog({ isSaving, onClose, onSave, settings }: { isSaving: boolean; onClose: () => void; onSave: (importLimitBytes: number) => void; settings: DatabaseImportSettings }) {
  const [limitMb, setLimitMb] = useState(String(Math.round(settings.importLimitBytes / (1024 * 1024))));
  const [error, setError] = useState<string | null>(null);
  const minMb = settings.minImportLimitBytes / (1024 * 1024);
  const maxMb = settings.maxImportLimitBytes / (1024 * 1024);

  function save() {
    const value = Number(limitMb);
    if (!Number.isFinite(value) || value < minMb || value > maxMb) {
      setError(`Enter a whole number between ${minMb.toLocaleString()} MB and ${maxMb.toLocaleString()} MB.`);
      return;
    }
    setError(null);
    onSave(Math.floor(value * 1024 * 1024));
  }

  return <div aria-label="Database import settings" className="fixed inset-0 z-50 grid place-items-center bg-slate-950/35 p-4" role="dialog" aria-modal="true" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"><div className="flex items-start justify-between gap-4"><div><p className="text-sm font-medium text-blue-600">SQLite imports</p><h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-900">Import size limit</h2><p className="mt-2 text-sm leading-6 text-slate-500">Set the largest SQLite file this Drive may import. The limit cannot exceed your Drive storage allocation.</p></div><button aria-label="Close import settings" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" onClick={onClose}><X size={19} /></button></div><label className="mt-6 block text-sm font-semibold text-slate-700">Maximum file size<div className="mt-2 flex items-center gap-2"><input aria-label="Database import limit in MB" className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" min={minMb} max={maxMb} onChange={(event) => setLimitMb(event.target.value)} step="1" type="number" value={limitMb} /><span className="text-sm font-medium text-slate-500">MB</span></div></label><p className="mt-2 text-xs leading-5 text-slate-500">Available range: {formatBytes(settings.minImportLimitBytes)} to {formatBytes(settings.maxImportLimitBytes)}.</p>{error && <p className="mt-3 text-sm font-medium text-red-600" role="alert">{error}</p>}<div className="mt-6 flex justify-end gap-3"><button className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100" onClick={onClose}>Cancel</button><button className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:bg-slate-300" disabled={isSaving} onClick={save}>{isSaving ? "Saving…" : "Save limit"}</button></div></section></div>;
}

function databaseConnectionRequest(engine: DatabaseEngineId): Record<string, unknown> {
  if (engine === "sqlite") return { sql: "SELECT * FROM customers WHERE id = ?", params: ["cus_123"] };
  if (engine === "duckdb" || engine === "libsql") return { query: "SELECT * FROM customers WHERE id = ?", params: ["cus_123"] };
  if (engine === "pglite") return { query: "SELECT * FROM customers WHERE id = $1", params: ["cus_123"] };
  if (engine === "kuzu") return { query: "MATCH (customer:Customer {id: $id}) RETURN customer", params: { id: "cus_123" } };
  if (engine === "redis") return { command: "GET", args: ["customer:cus_123"] };
  if (engine === "leveldb") return { operation: "get", key: "customer:cus_123" };
  return { operation: "search", table: "customers", vector: [0.12, 0.84, 0.31], limit: 10 };
}

function DatabaseConnection({ client, database }: { client: DriveClient; database: DriveDatabase }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("Production backend");
  const [access, setAccess] = useState<DatabaseApiKeyScope>("write");
  const [expiry, setExpiry] = useState("90d");
  const [created, setCreated] = useState<string | null>(null);
  const supported = Boolean(client.createDatabaseApiKey && client.listDatabaseApiKeys && client.revokeDatabaseApiKey);
  const endpoint = `${window.location.origin}${appBasePath === "/" ? "" : appBasePath}/databases/${database.id}/${database.engine === "sqlite" ? "query" : "execute"}`;
  const expiryOptions = [
    { value: "30d", label: "30 days", durationMs: 30 * 24 * 60 * 60 * 1_000 },
    { value: "90d", label: "90 days", durationMs: 90 * 24 * 60 * 60 * 1_000 },
    { value: "365d", label: "1 year", durationMs: 365 * 24 * 60 * 60 * 1_000 },
    { value: "never", label: "Never", durationMs: null }
  ] as const;
  const expiresAt = (value: string) => {
    const option = expiryOptions.find((item) => item.value === value);
    return option?.durationMs ? new Date(Date.now() + option.durationMs).toISOString() : null;
  };
  const keysQuery = useQuery({ queryKey: ["database-api-keys", database.id], queryFn: () => client.listDatabaseApiKeys!(database.id), enabled: supported });
  const createMutation = useMutation({
    mutationFn: () => client.createDatabaseApiKey!({ databaseId: database.id, name: name.trim(), scopes: access === "write" ? ["read", "write"] : ["read"], expiresAt: expiresAt(expiry) }),
    onSuccess: async (key) => {
      setCreated(key.apiKey);
      await queryClient.invalidateQueries({ queryKey: ["database-api-keys", database.id] });
      toast.success("Database API key created");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not create database API key")
  });
  const revokeMutation = useMutation({
    mutationFn: (keyId: string) => client.revokeDatabaseApiKey!({ databaseId: database.id, keyId }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["database-api-keys", database.id] });
      toast.success("Database API key revoked");
    },
    onError: () => toast.error("Could not revoke database API key")
  });

  if (!supported) return <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="text-lg font-semibold text-slate-900">Connect from a backend</h2><p className="mt-2 text-sm text-slate-500">Update Zo Drive’s API and browser workspace together to create database-scoped credentials.</p></section>;

  const requestBody = databaseConnectionRequest(database.engine);
  const example = `const response = await fetch("${endpoint}", {\n  method: "POST",\n  headers: {\n    "Authorization": \`Bearer \${process.env.ZO_DATABASE_API_KEY}\`,\n    "Content-Type": "application/json"\n  },\n  body: JSON.stringify(${JSON.stringify(requestBody, null, 4).replace(/^/gm, "  ").trim()})\n});\n\nconst result = await response.json();`;
  const keys = keysQuery.data ?? [];

  return <section className="space-y-6">
    <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-600">HTTPS API · {database.engine}</p><h3 className="mt-1 text-xl font-semibold text-slate-900">Connect from your backend</h3><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">The {database.engine} data stays private. Generate a key scoped only to {database.name}, then send its native {database.engine === "kuzu" ? "Cypher" : database.engine === "redis" ? "command" : database.engine === "lancedb" || database.engine === "leveldb" ? "operation" : "query"} request through Zo Drive.</p></div>
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_19rem]">
      <div className="space-y-5"><div><label className="text-sm font-semibold text-slate-700">{database.engine === "sqlite" ? "Query" : "Execution"} endpoint</label><div className="mt-2 flex gap-2"><code className="min-w-0 flex-1 overflow-x-auto rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-700">POST {endpoint}</code><button aria-label="Copy database query endpoint" className="rounded-lg border border-slate-300 px-3 text-slate-600 hover:bg-slate-50" onClick={() => void copyText(endpoint, "Database endpoint copied")}><Copy size={18} /></button></div></div><div className="overflow-hidden rounded-xl bg-slate-950"><div className="flex items-center justify-between border-b border-white/10 px-4 py-3"><p className="text-xs font-bold uppercase tracking-[0.14em] text-cyan-300">Node.js example</p><button aria-label="Copy database connection example" className="rounded-md p-1.5 text-slate-300 hover:bg-white/10 hover:text-white" onClick={() => void copyText(example, "Connection example copied")}><Copy size={16} /></button></div><pre className="overflow-x-auto p-4 text-xs leading-6 text-slate-100"><code>{example}</code></pre></div><div className="flex gap-3 rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm leading-6 text-blue-950"><ShieldCheck className="mt-0.5 shrink-0 text-blue-700" size={18} />Use a read-only key for reads and searches. A read-and-write key is required for mutations. Keys are shown once and belong in backend environment variables, never browser code.</div></div>
      <div className="h-fit rounded-xl border border-slate-200 bg-slate-50 p-4"><h4 className="text-sm font-semibold text-slate-900">Create database key</h4><p className="mt-1 text-xs leading-5 text-slate-500">Keys are limited to this database.</p><label className="mt-4 block text-sm font-semibold text-slate-700">Key name<input aria-label="Database API key name" className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" value={name} onChange={(event) => setName(event.target.value)} /></label><fieldset className="mt-4"><legend className="text-sm font-semibold text-slate-700">Access</legend><div className="mt-2 grid gap-2"><button className={`rounded-lg border p-3 text-left text-sm ${access === "write" ? "border-blue-500 bg-blue-50 text-blue-800" : "border-slate-200 bg-white text-slate-600"}`} onClick={() => setAccess("write")} type="button"><strong className="block">Read & write</strong><span className="mt-1 block text-xs">Queries and database changes.</span></button><button className={`rounded-lg border p-3 text-left text-sm ${access === "read" ? "border-blue-500 bg-blue-50 text-blue-800" : "border-slate-200 bg-white text-slate-600"}`} onClick={() => setAccess("read")} type="button"><strong className="block">Read only</strong><span className="mt-1 block text-xs">Tables, rows, and SELECT queries.</span></button></div></fieldset><label className="mt-4 block text-sm font-semibold text-slate-700">Expires<select aria-label="Database API key expiry" className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm" value={expiry} onChange={(event) => setExpiry(event.target.value)}>{expiryOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label><button className="mt-5 w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:bg-slate-300" disabled={!name.trim() || createMutation.isPending} onClick={() => createMutation.mutate()}>{createMutation.isPending ? "Creating…" : "Create database key"}</button></div>
    </div>
    {created && <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-4"><div className="flex gap-3"><ShieldAlert className="mt-0.5 shrink-0 text-amber-700" size={20} /><div className="min-w-0 flex-1"><h3 className="font-semibold text-amber-950">Copy this database key now</h3><p className="mt-1 text-sm text-amber-900">Zo Drive stores only its hash and cannot show it again.</p><div className="mt-3 flex gap-2"><code className="min-w-0 flex-1 overflow-x-auto rounded-lg border border-amber-200 bg-white px-3 py-2.5 text-xs text-slate-800">{created}</code><button aria-label="Copy database API key" className="rounded-lg border border-amber-300 bg-white px-3 text-amber-800 hover:bg-amber-100" onClick={() => void copyText(created, "Database API key copied")}><Copy size={18} /></button></div></div></div></div>}
    <div className="border-t border-slate-100 pt-5"><h3 className="font-semibold text-slate-900">Active database keys</h3><p className="mt-1 text-sm text-slate-500">These keys can access only {database.name}.</p>{keysQuery.isPending ? <p className="py-5 text-sm text-slate-500">Loading database keys…</p> : keys.length === 0 ? <p className="py-5 text-sm text-slate-500">No database keys yet.</p> : <div className="mt-3 divide-y divide-slate-100">{keys.map((key) => <DatabaseApiKeyRow key={key.id} apiKey={key} onRevoke={() => { if (window.confirm(`Revoke ${key.name}? This cannot be undone.`)) revokeMutation.mutate(key.id); }} />)}</div>}</div>
  </section>;
}

function DatabaseApiKeyRow({ apiKey, onRevoke }: { apiKey: DatabaseApiKey; onRevoke: () => void }) {
  return <div className="flex flex-wrap items-center gap-3 py-3"><span className="grid size-9 place-items-center rounded-lg bg-blue-50 text-blue-700"><KeyRound size={17} /></span><div className="min-w-0 flex-1"><p className="font-semibold text-slate-900">{apiKey.name}</p><p className="mt-0.5 font-mono text-xs text-slate-500">{apiKey.prefix}… · {apiKey.scopes.join(", ")}</p><p className="mt-1 text-xs text-slate-400">{apiKey.lastUsedAt ? `Last used ${formatDate(apiKey.lastUsedAt)}` : "Never used"} · {apiKey.expiresAt ? `Expires ${formatDate(apiKey.expiresAt)}` : "No expiry"}</p></div><button className="rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50" onClick={onRevoke}>Revoke</button></div>;
}

function DatabaseTableGrid({ data, isLoading, tableName, total, dark = false }: { data?: DatabaseRows; isLoading: boolean; tableName: string; total: number; dark?: boolean }) {
  const columns = useMemo<ColumnDef<Record<string, unknown>>[]>(() => (data?.columns ?? []).map((name) => ({ accessorKey: name, header: name, cell: (context) => formatDatabaseValue(context.getValue()) })), [data?.columns]);
  const table = useReactTable({ columns, data: data?.rows ?? [], getCoreRowModel: getCoreRowModel() });
  if (isLoading) return <div className={`grid min-h-40 place-items-center text-sm ${dark ? "text-slate-400" : "text-slate-500"}`}><LoaderCircle className="mr-2 animate-spin" size={18} /> Loading {tableName}…</div>;
  if (!data || data.columns.length === 0) return <div className={`grid min-h-40 place-items-center text-center text-sm ${dark ? "text-slate-400" : "text-slate-500"}`}>No rows to display in {tableName}.</div>;
  return <div className="overflow-x-auto"><div className={`mb-3 text-xs font-medium ${dark ? "text-slate-400" : "text-slate-500"}`}>{total.toLocaleString()} row{total === 1 ? "" : "s"}</div><table className="min-w-full text-left text-sm"><thead className={dark ? "text-slate-400" : "text-slate-500"}>{table.getHeaderGroups().map((group) => <tr key={group.id}>{group.headers.map((header) => <th className="border-b border-current/15 px-3 py-2 font-semibold" key={header.id}>{header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}</th>)}</tr>)}</thead><tbody className={dark ? "text-slate-200" : "text-slate-700"}>{table.getRowModel().rows.map((row) => <tr className={dark ? "border-b border-white/10" : "border-b border-slate-100"} key={row.id}>{row.getVisibleCells().map((cell) => <td className="max-w-72 truncate px-3 py-2.5 font-mono text-xs" key={cell.id} title={formatDatabaseValue(cell.getValue())}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>)}</tr>)}</tbody></table></div>;
}

function formatDatabaseValue(value: unknown): string {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function databaseNameFromFile(fileName: string): string {
  const name = fileName.trim().replace(/\.(db|sqlite|sqlite3)$/i, "").trim();
  return (name || "imported-database").slice(0, 80);
}

function ApiKeys({ client }: { client: DriveClient }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [access, setAccess] = useState<"read" | "write">("write");
  const [expiry, setExpiry] = useState("90d");
  const [created, setCreated] = useState<string | null>(null);
  const driveUrl = `${window.location.origin}${appBasePath || "/"}`;
  const expiryOptions = [
    { value: "10m", label: "10 minutes", durationMs: 10 * 60 * 1_000 },
    { value: "1h", label: "1 hour", durationMs: 60 * 60 * 1_000 },
    { value: "12h", label: "12 hours", durationMs: 12 * 60 * 60 * 1_000 },
    { value: "1d", label: "1 day", durationMs: 24 * 60 * 60 * 1_000 },
    { value: "7d", label: "7 days", durationMs: 7 * 24 * 60 * 60 * 1_000 },
    { value: "10d", label: "10 days", durationMs: 10 * 24 * 60 * 60 * 1_000 },
    { value: "14d", label: "14 days", durationMs: 14 * 24 * 60 * 60 * 1_000 },
    { value: "30d", label: "30 days", durationMs: 30 * 24 * 60 * 60 * 1_000 },
    { value: "90d", label: "90 days", durationMs: 90 * 24 * 60 * 60 * 1_000 },
    { value: "365d", label: "1 year", durationMs: 365 * 24 * 60 * 60 * 1_000 },
    { value: "never", label: "Never", durationMs: null }
  ] as const;
  const expiryDate = (value: string) => {
    const option = expiryOptions.find((item) => item.value === value);
    return option?.durationMs ? new Date(Date.now() + option.durationMs).toISOString() : null;
  };
  const keysQuery = useQuery({ queryKey: ["api-keys"], queryFn: () => client.listApiKeys() });
  const createMutation = useMutation({
    mutationFn: () => client.createApiKey({
      name: name.trim(),
      scopes: access === "write" ? ["read", "write"] : ["read"],
      expiresAt: expiryDate(expiry)
    }),
    onSuccess: async (key) => {
      setCreated(key.apiKey);
      setName("");
      await queryClient.invalidateQueries({ queryKey: ["api-keys"] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not create API key")
  });
  const revokeMutation = useMutation({
    mutationFn: (id: string) => client.revokeApiKey(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["api-keys"] });
      toast.success("API key revoked");
    },
    onError: () => toast.error("Could not revoke API key")
  });
  const keys = keysQuery.data ?? [];

  return (
    <div className="max-w-5xl space-y-6">
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 px-6 py-8 text-white">
          <span className="inline-flex items-center gap-2 rounded-full border border-cyan-200/20 bg-cyan-200/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-100"><KeyRound size={14} /> Device access</span>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight">Scoped keys for your local machines.</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">Create one key per computer or automation. Keys are shown once, stored only as hashes, and can be revoked here without changing your Drive password.</p>
          <div className="mt-5 flex max-w-3xl flex-wrap items-center gap-2 rounded-xl border border-white/15 bg-white/10 p-3">
            <span className="text-xs font-bold uppercase tracking-[0.13em] text-cyan-100">Zo Drive URL</span>
            <code className="min-w-0 flex-1 overflow-x-auto font-mono text-sm text-white">{driveUrl}</code>
            <button aria-label="Copy Zo Drive URL" className="rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/20" onClick={() => void copyText(driveUrl, "Zo Drive URL copied")} type="button">Copy</button>
          </div>
        </div>
        <div className="grid gap-5 p-5 md:grid-cols-[minmax(0,1fr)_15rem]">
          <div>
            <label className="text-sm font-semibold text-slate-700">Key name
              <input aria-label="API key name" className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" placeholder="MacBook Pro" value={name} onChange={(event) => setName(event.target.value)} />
            </label>
            <div className="mt-4">
              <p className="text-sm font-semibold text-slate-700">Access</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <button className={"rounded-lg border p-3 text-left text-sm " + (access === "write" ? "border-blue-500 bg-blue-50 text-blue-800" : "border-slate-200 text-slate-600")} onClick={() => setAccess("write")} type="button"><strong className="block">Read & write</strong><span className="mt-1 block text-xs">Upload, edit, download, and list.</span></button>
                <button className={"rounded-lg border p-3 text-left text-sm " + (access === "read" ? "border-blue-500 bg-blue-50 text-blue-800" : "border-slate-200 text-slate-600")} onClick={() => setAccess("read")} type="button"><strong className="block">Read only</strong><span className="mt-1 block text-xs">List and download only.</span></button>
              </div>
            </div>
          </div>
          <label className="text-sm font-semibold text-slate-700">Expires
            <select aria-label="API key expiry" className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm" value={expiry} onChange={(event) => setExpiry(event.target.value)}>
              {expiryOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            <button className="mt-5 w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:bg-slate-300" disabled={!name.trim() || createMutation.isPending} onClick={() => createMutation.mutate()}>{createMutation.isPending ? "Creating…" : "Create API key"}</button>
          </label>
        </div>
      </section>
      {created && <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5"><div className="flex gap-3"><ShieldAlert className="mt-0.5 shrink-0 text-amber-700" size={20} /><div className="min-w-0 flex-1"><h2 className="font-semibold text-amber-950">Copy this key now</h2><p className="mt-1 text-sm leading-6 text-amber-900">This is the only time Zo Drive can show it. Store it in your machine's secret manager or environment, never in source code.</p><div className="mt-4 flex gap-2"><code className="min-w-0 flex-1 overflow-x-auto rounded-lg border border-amber-200 bg-white px-3 py-2.5 text-xs text-slate-800">{created}</code><button aria-label="Copy API key" className="rounded-lg border border-amber-300 bg-white px-3 text-amber-800 hover:bg-amber-100" onClick={() => void copyText(created, "API key copied") }><Copy size={18} /></button></div></div></div></section>}
      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-4"><h2 className="font-semibold text-slate-900">Active keys</h2><p className="mt-1 text-sm text-slate-500">Revoke a key immediately if a device is lost or an automation is retired.</p></div>
        {keysQuery.isPending ? <p className="p-6 text-sm text-slate-500">Loading API keys…</p> : keys.length === 0 ? <p className="p-6 text-sm text-slate-500">No API keys yet.</p> : <div className="divide-y divide-slate-100">{keys.map((key) => <ApiKeyRow key={key.id} apiKey={key} onRevoke={() => { if (window.confirm("Revoke " + key.name + "? This cannot be undone.")) revokeMutation.mutate(key.id); }} />)}</div>}
      </section>
    </div>
  );
}

function ApiKeyRow({ apiKey, onRevoke }: { apiKey: DriveApiKey; onRevoke: () => void }) {
  return <div className="flex flex-wrap items-center gap-4 p-5"><span className="grid size-10 place-items-center rounded-xl bg-blue-50 text-blue-700"><KeyRound size={19} /></span><div className="min-w-0 flex-1"><p className="font-semibold text-slate-900">{apiKey.name}</p><p className="mt-1 font-mono text-xs text-slate-500">{apiKey.prefix}… · {apiKey.scopes.join(", ")}</p><p className="mt-1 text-xs text-slate-400">Created {formatDate(apiKey.createdAt)} · {apiKey.lastUsedAt ? "Last used " + formatDate(apiKey.lastUsedAt) : "Never used"} · {apiKey.expiresAt ? "Expires " + formatDate(apiKey.expiresAt) : "No expiry"}</p></div><button className="rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50" onClick={onRevoke}>Revoke</button></div>;
}

function ZoTransfer({ client, onCreated, search: globalSearch }: { client: DriveClient; onCreated: () => Promise<void>; search: string }) {
  const [transferTab, setTransferTab] = useState<"transfer" | "active">("transfer");
  const [mode, setMode] = useState<"drive" | "upload">("drive");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [expiry, setExpiry] = useState("7d");
  const [access, setAccess] = useState<ShareAccess>("public");
  const [passcode, setPasscode] = useState("");
  const [showPasscode, setShowPasscode] = useState(false);
  const [fileSearch, setFileSearch] = useState("");
  const [link, setLink] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const filesQuery = useQuery({ queryKey: ["transfer-files"], queryFn: () => client.list({}) });
  const sharesQuery = useQuery({ queryKey: ["transfer-shares"], queryFn: () => client.listShares() });
  const normalizedGlobalSearch = globalSearch.trim().toLowerCase();
  const normalizedFileSearch = fileSearch.trim().toLowerCase();
  const files = (filesQuery.data ?? []).filter((file) => matchesSearch(normalizedGlobalSearch, file.name, file.key, file.contentType) && matchesSearch(normalizedFileSearch, file.name, file.key, file.contentType));
  const transfers = (sharesQuery.data ?? []).filter((share) => share.kind === "transfer" && matchesSearch(normalizedGlobalSearch, share.name, share.key, share.access, share.contentType));
  const canCreate = access === "public" || passcode.length > 0;
  const transferOptions = () => ({ access, kind: "transfer" as const, passcode: access === "passcode" ? passcode : undefined, expiresAt: ttlToDate(expiry) });
  const finish = async (share: DriveShare) => {
    setLink(shareLink(share.id));
    await onCreated();
    await Promise.all([filesQuery.refetch(), sharesQuery.refetch()]);
    toast.success(access === "passcode" ? "Passcode-protected transfer link created" : "Public transfer link created");
  };
  const createMutation = useMutation({
    mutationFn: (key: string) => client.createShare({ key, ...transferOptions() }),
    onSuccess: (share) => void finish(share),
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not create the transfer")
  });
  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const uploaded = await client.upload({ file, fileName: file.name });
      return client.createShare({ key: uploaded.key, ...transferOptions() });
    },
    onSuccess: (share) => void finish(share),
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not upload and transfer the file")
  });
  const revokeMutation = useMutation({
    mutationFn: (id: string) => client.revokeShare(id),
    onSuccess: () => { void sharesQuery.refetch(); toast.success("Transfer revoked"); },
    onError: () => toast.error("Could not revoke the transfer")
  });
  const working = createMutation.isPending || uploadMutation.isPending;
  const actionLabel = access === "passcode" ? "Create protected link" : "Create public link";

  return <div className="zo-transfer-view space-y-6" data-tab={transferTab}>
    <style>{`
      .zo-transfer-view[data-tab="active"] > section:first-of-type { display: none; }
      .zo-transfer-view[data-tab="transfer"] > section:nth-of-type(2) { display: none; }
    `}</style>
    <div aria-label="Zo Transfer views" className="flex max-w-md rounded-xl bg-slate-100 p-1" role="tablist">
      <button aria-selected={transferTab === "transfer"} className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold transition ${transferTab === "transfer" ? "bg-white text-blue-700 shadow-sm" : "text-slate-500 hover:text-slate-800"}`} onClick={() => setTransferTab("transfer")} role="tab" type="button">Transfer To</button>
      <button aria-selected={transferTab === "active"} className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold transition ${transferTab === "active" ? "bg-white text-blue-700 shadow-sm" : "text-slate-500 hover:text-slate-800"}`} onClick={() => setTransferTab("active")} role="tab" type="button">Active Transfers</button>
    </div>
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="relative overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 px-7 py-9 text-white md:px-10"><div className="absolute -right-28 -top-32 size-80 rounded-full bg-cyan-400/15 blur-3xl" /><div className="relative"><span className="inline-flex items-center gap-2 rounded-full border border-cyan-200/20 bg-cyan-200/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-100"><Send size={14} /> Ready to send</span><h2 className="mt-4 text-3xl font-semibold tracking-tight md:text-4xl">Send a file with Zo Transfer</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300 md:text-base">Upload a file or select one already in Zo Drive. Create a public or passcode-protected link, then revoke it whenever needed.</p><p className="mt-4 text-xs font-medium text-cyan-100/80">Inspired by WeTransfer.</p></div></div>
      <div className="grid gap-6 p-5 md:grid-cols-[minmax(0,1fr)_18rem] md:p-7">
        <div><div className="flex rounded-lg bg-slate-100 p-1"><button className={`flex-1 rounded-md px-3 py-2 text-sm font-semibold ${mode === "drive" ? "bg-white text-blue-700 shadow-sm" : "text-slate-500"}`} onClick={() => setMode("drive")}>Choose from Drive</button><button className={`flex-1 rounded-md px-3 py-2 text-sm font-semibold ${mode === "upload" ? "bg-white text-blue-700 shadow-sm" : "text-slate-500"}`} onClick={() => setMode("upload")}>Upload from computer</button></div>{mode === "drive" ? <div className="mt-4"><label className="sr-only" htmlFor="transfer-search">Search Drive files</label><input id="transfer-search" className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" placeholder="Search files in Zo Drive" value={fileSearch} onChange={(event) => setFileSearch(event.target.value)} />{filesQuery.isPending ? <p className="py-8 text-center text-sm text-slate-500">Loading files…</p> : <div className="mt-3 max-h-60 overflow-auto rounded-xl border border-slate-200">{files.length === 0 ? <p className="p-5 text-sm text-slate-500">No files found.</p> : files.map((file) => <button className={`flex w-full items-center gap-3 border-b border-slate-100 px-4 py-3 text-left last:border-b-0 hover:bg-slate-50 ${selectedKey === file.key ? "bg-blue-50" : ""}`} key={file.key} onClick={() => setSelectedKey(file.key)}><span className={`rounded-lg p-2 ${selectedKey === file.key ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-500"}`}>{fileIcon(file.contentType)}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-slate-800">{file.name}</span><span className="block text-xs text-slate-500">{formatBytes(file.size)} · {file.key.includes("/") ? file.key.slice(0, file.key.lastIndexOf("/")) : "My Drive"}</span></span>{selectedKey === file.key && <span className="text-xs font-bold text-blue-700">Selected</span>}</button>)}</div>}</div> : <div className="mt-4 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-8 text-center"><Upload className="mx-auto text-blue-600" size={30} /><h3 className="mt-3 font-semibold text-slate-800">Choose a file from your computer</h3><p className="mt-1 text-sm text-slate-500">The file is added to Zo Drive, then shared through your selected link access.</p><button className="mt-5 rounded-lg border border-blue-200 bg-white px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50 disabled:text-slate-400" onClick={() => input.current?.click()} disabled={working || !canCreate}>Browse files</button><input ref={input} className="hidden" type="file" onChange={(event) => { const file = event.target.files?.[0]; if (file) uploadMutation.mutate(file); event.target.value = ""; }} /></div>}</div>
        <aside className="rounded-xl border border-slate-200 bg-slate-50 p-5"><fieldset><legend className="text-sm font-semibold text-slate-700">Link access</legend><div className="mt-2 grid grid-cols-2 gap-2"><label className={`rounded-lg border p-3 text-sm font-medium ${access === "public" ? "border-blue-500 bg-blue-50 text-blue-700" : "border-slate-200 text-slate-600"}`}><input className="sr-only" type="radio" checked={access === "public"} onChange={() => setAccess("public")} />Public</label><label className={`rounded-lg border p-3 text-sm font-medium ${access === "passcode" ? "border-blue-500 bg-blue-50 text-blue-700" : "border-slate-200 text-slate-600"}`}><input className="sr-only" type="radio" checked={access === "passcode"} onChange={() => setAccess("passcode")} />Passcode</label></div></fieldset>{access === "passcode" && <div className="relative mt-3"><input aria-label="Transfer passcode" className="w-full rounded-lg border border-slate-300 py-2.5 pl-3 pr-11 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" type={showPasscode ? "text" : "password"} placeholder="Choose a passcode" value={passcode} onChange={(event) => setPasscode(event.target.value)} /><button aria-label={showPasscode ? "Hide transfer passcode" : "Show transfer passcode"} className="absolute right-1 top-1/2 -translate-y-1/2 rounded-md p-2 text-slate-400 hover:bg-white hover:text-slate-700" type="button" onClick={() => setShowPasscode((show) => !show)}>{showPasscode ? <EyeOff size={18} /> : <Eye size={18} />}</button></div>}<label className="mt-5 block text-sm font-semibold text-slate-700">Link expiry<select aria-label="Transfer expiry" className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm" value={expiry} onChange={(event) => setExpiry(event.target.value)}><option value="1d">1 day</option><option value="7d">7 days</option><option value="30d">30 days</option><option value="never">Never expires</option></select></label><div className="mt-5 rounded-lg border border-blue-100 bg-blue-50 p-3 text-sm leading-6 text-blue-800"><ShieldCheck className="mb-1" size={18} />{access === "public" ? "Anyone with the link can download this file." : "Recipients must enter the passcode before they can download this file."} You can revoke it from Zo Transfer or Shared with others.</div><button className="mt-5 w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:bg-slate-300" disabled={!selectedKey || working || mode !== "drive" || !canCreate} onClick={() => selectedKey && createMutation.mutate(selectedKey)}>{working ? mode === "upload" ? "Uploading…" : "Creating link…" : actionLabel}</button><div className="mt-5 border-t border-slate-200 pt-4"><p className="flex items-center gap-2 text-sm font-semibold text-slate-700"><CreditCard size={17} className="text-slate-400" /> Payments <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] uppercase tracking-wide text-slate-600">Coming soon</span></p><p className="mt-1 text-xs leading-5 text-slate-500">Payment-gated downloads are not enabled yet.</p></div></aside>
      </div>
      {link && <div className="border-t border-slate-100 bg-emerald-50 px-5 py-4 md:px-7"><p className="text-sm font-semibold text-emerald-900">Your {access === "passcode" ? "protected" : "public"} transfer is ready</p><div className="mt-2 flex gap-2"><input aria-label="Transfer link" className="min-w-0 flex-1 rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm text-slate-700" value={link} readOnly /><button aria-label="Copy transfer link" className="rounded-lg border border-emerald-200 bg-white px-3 text-emerald-700 hover:bg-emerald-100" onClick={() => void copyText(link, "Transfer link copied")}><Copy size={18} /></button></div></div>}
    </section>
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6"><div className="flex items-center justify-between gap-3"><div><h2 className="font-semibold text-slate-900">Active transfers</h2><p className="mt-1 text-sm text-slate-500">Links created through Zo Transfer.</p></div><button className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Refresh transfers" onClick={() => void sharesQuery.refetch()}><RotateCcw size={18} /></button></div>{sharesQuery.isPending ? <p className="py-6 text-sm text-slate-500">Loading transfers…</p> : transfers.length === 0 ? <p className="py-6 text-sm text-slate-500">{normalizedGlobalSearch ? `No transfers match “${globalSearch.trim()}”.` : "No active transfers yet."}</p> : <div className="mt-4 divide-y divide-slate-100">{transfers.map((share) => <article className="flex flex-wrap items-center gap-3 py-3" key={share.id}><span className="rounded-lg bg-blue-50 p-2 text-blue-600"><Send size={18} /></span><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-slate-800">{share.name}</p><p className="text-xs text-slate-500">{share.access === "passcode" ? "Passcode protected" : "Public"} · {formatBytes(share.size)} · {share.expiresAt ? `Expires ${new Date(share.expiresAt).toLocaleString()}` : "No expiry"}</p></div><button aria-label={`Copy transfer link for ${share.name}`} className="rounded-lg p-2 text-slate-500 hover:bg-blue-50 hover:text-blue-700" onClick={() => void copyText(shareLink(share.id), "Transfer link copied")}><Copy size={17} /></button><button className="rounded-lg px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50" disabled={revokeMutation.isPending} onClick={() => revokeMutation.mutate(share.id)}>Revoke</button></article>)}</div>}</section>
  </div>;
}

function ZoPaste({ files, isError, isLoading, onCreate, onDelete, onPreview, onRetry, onShare, onToggleStar }: { files: DriveObject[]; isError: boolean; isLoading: boolean; onCreate: () => void; onDelete: (key: string) => void; onPreview: (file: DriveObject) => void; onRetry: () => void; onShare: (file: DriveObject) => void; onToggleStar: (file: DriveObject) => void }) {
  return <div className="space-y-6">
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="relative overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-cyan-950 px-7 py-9 text-white md:px-10">
        <div className="absolute -right-28 -top-32 size-80 rounded-full bg-cyan-300/15 blur-3xl" />
        <div className="absolute -bottom-24 left-1/3 size-64 rounded-full bg-blue-500/15 blur-3xl" />
        <div className="relative max-w-3xl"><span className="inline-flex items-center gap-2 rounded-full border border-cyan-200/20 bg-cyan-200/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-100"><Code2 size={14} /> Snippets, simplified</span><h2 className="mt-4 text-3xl font-semibold tracking-tight md:text-4xl">Write it once. Share it when ready.</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300 md:text-base">Zo Paste keeps code, logs, notes, and configuration snippets private by default. Add syntax and tags, then create a protected or expiring link only when you need to send it.</p><p className="mt-4 text-xs font-medium text-cyan-100/80">Inspired by Pastebin.</p></div>
      </div>
      <div className="grid divide-y divide-slate-100 md:grid-cols-3 md:divide-x md:divide-y-0"><div className="flex gap-3 p-5"><span className="grid size-9 shrink-0 place-items-center rounded-lg bg-slate-900 text-cyan-300"><LockKeyhole size={18} /></span><div><p className="text-sm font-semibold text-slate-800">Private by default</p><p className="mt-1 text-xs leading-5 text-slate-500">Your paste stays in Zo Drive until you deliberately share it.</p></div></div><div className="flex gap-3 p-5"><span className="grid size-9 shrink-0 place-items-center rounded-lg bg-cyan-50 text-cyan-700"><Code2 size={18} /></span><div><p className="text-sm font-semibold text-slate-800">Built for text and code</p><p className="mt-1 text-xs leading-5 text-slate-500">Label the syntax and add tags so each snippet remains useful later.</p></div></div><div className="flex gap-3 p-5"><span className="grid size-9 shrink-0 place-items-center rounded-lg bg-blue-50 text-blue-700"><Share2 size={18} /></span><div><p className="text-sm font-semibold text-slate-800">Share on your terms</p><p className="mt-1 text-xs leading-5 text-slate-500">Use an expiry or passcode when a paste needs to leave your Drive.</p></div></div></div>
    </section>
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold text-slate-900">Your pastes</h2><p className="mt-1 text-sm text-slate-500">Create, open, and share your saved snippets.</p></div><button className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:border-cyan-300 hover:bg-cyan-50 hover:text-cyan-800" onClick={onCreate}><Plus size={17} /> New paste</button></div>{isLoading ? <div className="grid min-h-52 place-items-center text-sm text-slate-500"><span className="flex items-center gap-2"><LoaderCircle className="animate-spin" size={18} /> Loading your pastes…</span></div> : isError ? <div className="mt-5"><EmptyState title="We couldn't load your pastes" description="Check that the Drive API is running, then try again." action="Try again" onAction={onRetry} /></div> : files.length === 0 ? <div className="mt-5 grid min-h-60 place-items-center rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center"><div><span className="mx-auto grid size-12 place-items-center rounded-2xl bg-slate-900 text-cyan-300"><Code2 size={24} /></span><h3 className="mt-4 font-semibold text-slate-800">No pastes yet</h3><p className="mt-2 max-w-sm text-sm text-slate-500">Start a private Zo Paste for code, notes, logs, or any shareable text.</p><button className="mt-5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800" onClick={onCreate}>Create a paste</button></div></div> : <div className="mt-5 overflow-hidden rounded-xl border border-slate-200"><DriveEntries files={files} folders={[]} viewMode="list" onOpenFolder={() => undefined} onPreview={onPreview} onDelete={onDelete} onToggleStar={onToggleStar} onShare={onShare} /></div>}</section>
  </div>;
}

function FolderNavigation({ currentPath, onNavigate }: { currentPath: string; onNavigate: (path: string) => void }) {
  const segments = currentPath ? currentPath.split("/") : [];
  const parentPath = segments.slice(0, -1).join("/");
  const parentName = parentPath ? parentPath.split("/").at(-1) : "My Drive";
  return (
    <div>
      <button
        className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-100"
        onClick={() => onNavigate(parentPath)}
      >
        <ArrowLeft size={17} /> Back to {parentName}
      </button>
      <div className="mt-3 flex flex-wrap items-center gap-1 text-sm text-slate-500" aria-label="Folder path">
        <button className="hover:text-blue-600" onClick={() => onNavigate("")}>My Drive</button>
        {segments.map((segment, index) => {
          const target = segments.slice(0, index + 1).join("/");
          return <span key={target}><span className="mx-1 text-slate-300">/</span><button className="hover:text-blue-600" onClick={() => onNavigate(target)}>{segment}</button></span>;
        })}
      </div>
    </div>
  );
}

function DriveEntries({ files, folders, viewMode, onOpenFolder, onRenameFolder, onDeleteFolder, onPreview, onDelete, onToggleStar, onShare }: {
  files: DriveObject[];
  folders: DriveFolder[];
  viewMode: ViewMode;
  onOpenFolder: (folder: DriveFolder) => void;
  onRenameFolder?: (folder: DriveFolder) => void;
  onDeleteFolder?: (folder: DriveFolder) => void;
  onPreview: (file: DriveObject) => void;
  onDelete: (key: string) => void;
  onToggleStar: (file: DriveObject) => void;
  onShare: (file: DriveObject) => void;
}) {
  const isGrid = viewMode === "grid";
  return (
    <div data-testid="drive-entries" className={isGrid ? "grid w-full min-w-0 max-w-full gap-3 sm:grid-cols-2 xl:grid-cols-3" : "w-full min-w-0 max-w-full overflow-hidden rounded-xl border border-slate-200 bg-white"}>
      {folders.map((folder) => (
        <article key={folder.key} className={isGrid ? "group flex min-w-0 items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 hover:border-blue-300 hover:shadow-sm" : "group flex w-full min-w-0 max-w-full items-center gap-3 border-b border-slate-100 px-4 py-3 text-left hover:bg-slate-50"}>
          <button className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={() => onOpenFolder(folder)}>
            <span className="rounded-lg bg-blue-50 p-2 text-blue-600"><Folder size={20} fill="currentColor" /></span>
            <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-800">{folder.name}</span>
          </button>
          {onRenameFolder && onDeleteFolder && <div className="flex shrink-0 items-center gap-1">
            <button aria-label={`Rename folder ${folder.name}`} className="rounded-md p-2 text-slate-400 transition hover:bg-blue-50 hover:text-blue-600" onClick={() => onRenameFolder(folder)} title="Rename folder"><Pencil size={17} /></button>
            <button aria-label={`Move folder ${folder.name} to Trash`} className="rounded-md p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-600" onClick={() => onDeleteFolder(folder)} title="Move folder to Trash"><Trash2 size={17} /></button>
          </div>}
        </article>
      ))}
      {files.map((file) => (
        <article key={file.key} className={isGrid ? "group relative flex min-w-0 items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 hover:border-blue-300 hover:shadow-sm" : "group flex w-full min-w-0 max-w-full items-center gap-3 border-b border-slate-100 px-4 py-3 last:border-b-0 hover:bg-slate-50"}>
          <button className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={() => void onPreview(file)}>
            <span className="rounded-lg bg-slate-100 p-2 text-slate-500">{fileIcon(file.contentType)}</span>
            <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium text-slate-800">{file.name}</span><span className="block truncate text-xs text-slate-400">{formatBytes(file.size)} · {new Date(file.updatedAt).toLocaleDateString()}</span></span>
          </button>
          <div className="flex shrink-0 items-center gap-1">
            <button aria-label={`${file.starred ? "Remove" : "Add"} ${file.name} ${file.starred ? "from" : "to"} Starred`} className={`rounded-md p-2 transition hover:bg-amber-50 hover:text-amber-500 ${file.starred ? "text-amber-400" : "text-slate-400"}`} onClick={() => onToggleStar(file)}><Star size={17} fill={file.starred ? "currentColor" : "none"} /></button>
            <button aria-label={`Share ${file.name}`} className="rounded-md p-2 text-slate-400 transition hover:bg-blue-50 hover:text-blue-600" onClick={() => onShare(file)}><Share2 size={17} /></button>
            <button aria-label={`Move ${file.name} to Trash`} className="rounded-md p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-600" onClick={() => onDelete(file.key)}><Trash2 size={17} /></button>
          </div>
        </article>
      ))}
    </div>
  );
}

function RecentFiltersBar({ filters, onChange }: { filters: RecentFilters; onChange: (filters: RecentFilters) => void }) {
  return (
    <div data-testid="recent-filters" className="mb-6 grid grid-cols-2 gap-2" aria-label="Recent filters">
      <label className="sr-only" htmlFor="recent-type">Type</label>
      <select id="recent-type" aria-label="Recent file type" className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm outline-none hover:border-blue-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-100" value={filters.type} onChange={(event) => onChange({ ...filters, type: event.target.value as RecentFilters["type"] })}>
        <option value="any">All types</option><option value="document">Documents</option><option value="spreadsheet">Spreadsheets</option><option value="presentation">Presentations</option><option value="form">Forms</option><option value="image">Images</option><option value="video">Videos</option><option value="audio">Audio</option><option value="pdf">PDFs</option><option value="other">Other files</option>
      </select>
      <label className="sr-only" htmlFor="recent-modified">Modified</label>
      <select id="recent-modified" aria-label="Recent modified date" className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm outline-none hover:border-blue-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-100" value={filters.modified} onChange={(event) => onChange({ ...filters, modified: event.target.value as RecentFilters["modified"] })}>
        <option value="any">Any time</option><option value="today">Modified today</option><option value="week">Past week</option><option value="month">Past month</option><option value="year">Past year</option>
      </select>
      <label className="sr-only" htmlFor="recent-source">Source</label>
      <select id="recent-source" aria-label="Recent source" className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm outline-none hover:border-blue-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-100" value={filters.source} onChange={(event) => onChange({ ...filters, source: event.target.value as RecentFilters["source"] })}>
        <option value="any">All sources</option><option value="uploaded">Uploaded files</option><option value="zo-native">Zo-native files</option>
      </select>
      {(filters.type !== "any" || filters.modified !== "any" || filters.source !== "any") && <button className="rounded-lg px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50" onClick={() => onChange(defaultRecentFilters)}>Clear filters</button>}
    </div>
  );
}

function RecentEntries({ files, onOpenShared, onPreview, onDelete, onToggleStar, onShare }: {
  files: Array<DriveObject | SharedDriveFile>;
  onOpenShared: (file: SharedDriveFile) => void;
  onPreview: (file: DriveObject) => void;
  onDelete: (key: string) => void;
  onToggleStar: (file: DriveObject) => void;
  onShare: (file: DriveObject) => void;
}) {
  const groups = groupRecentFiles(files);
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="hidden grid-cols-[minmax(13rem,1fr)_11rem_7rem_9rem_11rem_7rem] gap-4 border-b border-slate-100 bg-slate-50 px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-400 lg:grid"><span>Name</span><span>Last activity</span><span>File size</span><span>Location</span><span>Access</span><span /></div>
      {groups.map(([label, items]) => (
        <section key={label}>
          <h2 className="border-b border-slate-100 bg-white px-5 py-3 text-sm font-semibold text-slate-600">{label}</h2>
          {items.map((file) => {
            const sharedFile = isSharedDriveFile(file);
            return <article key={sharedFile ? `${file.mountId}:${file.key}` : file.key} className="group grid gap-3 border-b border-slate-100 px-5 py-3 last:border-b-0 hover:bg-slate-50 lg:grid-cols-[minmax(13rem,1fr)_11rem_7rem_9rem_11rem_7rem] lg:items-center lg:gap-4">
              <button className="flex min-w-0 items-center gap-3 text-left" onClick={() => sharedFile ? onOpenShared(file) : void onPreview(file)}><span className={`rounded-lg p-2 ${sharedFile ? "bg-cyan-50 text-cyan-700" : "bg-slate-100 text-slate-500"}`}>{sharedFile ? <Network size={18} /> : fileIcon(file.contentType)}</span><span className="min-w-0"><span className="block truncate text-sm font-medium text-slate-800">{file.name}</span>{sharedFile && <span className="mt-0.5 block truncate text-xs text-cyan-800">Shared by {sharedDriveAuthor(file.mountAuthor)}</span>}</span></button>
              <span className="text-xs text-slate-500">{formatRecentActivity(file.updatedAt)}</span>
              <span className="text-xs text-slate-500">{formatBytes(file.size)}</span>
              <span className="truncate text-xs text-slate-500" title={sharedFile ? `${file.mountFolder} / ${file.key}` : recentFileLocation(file.key)}>{sharedFile ? file.mountFolder : recentFileLocation(file.key)}</span>
              <span className="text-xs text-slate-500">{sharedFile ? sharedDriveRoleLabel(file.mountRole) : "Private"}</span>
              {sharedFile ? <span className="text-right text-xs font-semibold text-cyan-800">Shared Drive</span> : <div className="flex items-center justify-end gap-1"><button aria-label={`${file.starred ? "Remove" : "Add"} ${file.name} ${file.starred ? "from" : "to"} Starred`} className={`rounded-md p-2 transition hover:bg-amber-50 hover:text-amber-500 ${file.starred ? "text-amber-400" : "text-slate-400"}`} onClick={() => onToggleStar(file)}><Star size={17} fill={file.starred ? "currentColor" : "none"} /></button><button aria-label={`Share ${file.name}`} className="rounded-md p-2 text-slate-400 transition hover:bg-blue-50 hover:text-blue-600" onClick={() => onShare(file)}><Share2 size={17} /></button><button aria-label={`Move ${file.name} to Trash`} className="rounded-md p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-600" onClick={() => onDelete(file.key)}><Trash2 size={17} /></button></div>}
            </article>;
          })}
        </section>
      ))}
    </div>
  );
}

function TrashEntries({ items, onRestore, onPermanentlyDelete }: { items: DriveTrashItem[]; onRestore: (id: string) => void; onPermanentlyDelete: (item: DriveTrashItem) => void }) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="hidden grid-cols-[minmax(0,1fr)_10rem_10rem_7rem] gap-4 border-b border-slate-100 bg-slate-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-400 md:grid"><span>Name</span><span>Date trashed</span><span>Original location</span><span className="text-right">Actions</span></div>
      {items.map((item) => (
        <article key={item.id} className="group grid gap-3 border-b border-slate-100 px-4 py-3 last:border-b-0 md:grid-cols-[minmax(0,1fr)_10rem_10rem_7rem] md:items-center md:gap-4 hover:bg-slate-50">
          <div className="flex min-w-0 items-center gap-3"><span className="rounded-lg bg-slate-100 p-2 text-slate-500">{item.kind === "folder" ? <Folder size={18} fill="currentColor" /> : fileIcon(item.contentType)}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium text-slate-800">{item.name}</span><span className="block text-xs text-slate-400">{item.kind === "folder" ? "Folder · " : ""}{formatBytes(item.size)} · {formatTrashExpiry(item.expiresAt)}</span></span></div>
          <span className="text-xs text-slate-500">{new Date(item.trashedAt).toLocaleDateString()}</span>
          <span className="truncate text-xs text-slate-500" title={item.originalKey}>{item.originalKey.includes("/") ? item.originalKey.slice(0, item.originalKey.lastIndexOf("/")) : "My Drive"}</span>
          <div className="flex shrink-0 items-center justify-end gap-1"><button aria-label={`Restore ${item.name}`} title="Restore to original location" className="rounded-md p-2 text-slate-400 transition hover:bg-blue-50 hover:text-blue-600" onClick={() => onRestore(item.id)}><RotateCcw size={17} /></button><button aria-label={`Permanently delete ${item.name}`} title="Permanently delete" className="rounded-md p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-600" onClick={() => onPermanentlyDelete(item)}><Trash2 size={17} /></button></div>
        </article>
      ))}
    </div>
  );
}

function FolderDialog({ folderName, onCancel, onCreate, onNameChange }: { folderName: string; onCancel: () => void; onCreate: () => void; onNameChange: (name: string) => void }) {
  return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/30 p-4" role="dialog" aria-modal="true" aria-label="Create folder"><form className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl" onSubmit={(event) => { event.preventDefault(); onCreate(); }}><h2 className="text-lg font-semibold text-slate-900">Create folder</h2><p className="mt-1 text-sm text-slate-500">Choose a name for the new folder.</p><input aria-label="Folder name" autoFocus className="mt-5 w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" maxLength={128} placeholder="e.g. Projects" value={folderName} onChange={(event) => onNameChange(event.target.value)} required /><div className="mt-5 flex justify-end gap-2"><button className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100" type="button" onClick={onCancel}>Cancel</button><button className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:bg-slate-300" type="submit" disabled={!folderName.trim()}>Create folder</button></div></form></div>;
}

function FolderRenameDialog({ folder, name, onCancel, onNameChange, onRename }: { folder: DriveFolder; name: string; onCancel: () => void; onNameChange: (name: string) => void; onRename: () => void }) {
  return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/30 p-4" role="dialog" aria-modal="true" aria-label="Rename folder"><form className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl" onSubmit={(event) => { event.preventDefault(); onRename(); }}><h2 className="text-lg font-semibold text-slate-900">Rename folder</h2><p className="mt-1 text-sm text-slate-500">Choose a new name for {folder.name}.</p><input aria-label="New folder name" autoFocus className="mt-5 w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" maxLength={128} value={name} onChange={(event) => onNameChange(event.target.value)} required /><div className="mt-5 flex justify-end gap-2"><button className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100" type="button" onClick={onCancel}>Cancel</button><button className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:bg-slate-300" type="submit" disabled={!name.trim()}>Rename folder</button></div></form></div>;
}

function NativeFileDialog({ type, name, onCancel, onCreate, onNameChange }: { type: NativeFileType; name: string; onCancel: () => void; onCreate: () => void; onNameChange: (name: string) => void }) {
  const label = nativeFileLabel(type);
  const description = type === "paste" ? "Pastes stay private in Zo Drive until you create a share link." : "This is a private, structured Zo-native file in the current folder.";
  return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/30 p-4" role="dialog" aria-modal="true" aria-label={`Create Zo ${label}`}><form className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl" onSubmit={(event) => { event.preventDefault(); onCreate(); }}><h2 className="text-lg font-semibold text-slate-900">Create Zo {label}</h2><p className="mt-1 text-sm text-slate-500">{description}</p><input aria-label={`${label} name`} autoFocus className="mt-5 w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" maxLength={128} value={name} onChange={(event) => onNameChange(event.target.value)} required /><div className="mt-5 flex justify-end gap-2"><button className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100" type="button" onClick={onCancel}>Cancel</button><button className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:bg-slate-300" disabled={!name.trim()} type="submit">Create</button></div></form></div>;
}

function AdvancedSearchDialog({ filters, itemName, onCancel, onFiltersChange, onItemNameChange, onReset, onSearch }: { filters: AdvancedFilters; itemName: string; onCancel: () => void; onFiltersChange: (filters: AdvancedFilters) => void; onItemNameChange: (value: string) => void; onReset: () => void; onSearch: () => void }) {
  const update = (change: Partial<AdvancedFilters>) => onFiltersChange({ ...filters, ...change });
  return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4" role="dialog" aria-modal="true" aria-label="Advanced search"><form className="w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl" onSubmit={(event) => { event.preventDefault(); onSearch(); }}><header className="flex items-center justify-between border-b border-slate-100 px-6 py-5"><div><h2 className="text-xl font-semibold text-slate-900">Advanced search</h2><p className="mt-1 text-sm text-slate-500">Search your private Drive with precise file filters.</p></div><button aria-label="Close advanced search" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" onClick={onCancel} type="button"><X size={20} /></button></header><div className="grid gap-5 p-6 sm:grid-cols-[10rem_minmax(0,1fr)]"><label className="text-sm font-semibold text-slate-700 sm:pt-2">Type</label><select aria-label="File type" className="rounded-lg border border-slate-300 bg-white px-3 py-2.5" value={filters.type} onChange={(event) => update({ type: event.target.value as AdvancedFilters["type"] })}><option value="any">Any</option><option value="document">Documents</option><option value="spreadsheet">Spreadsheets</option><option value="presentation">Presentations</option><option value="form">Forms</option><option value="paste">Pastes</option><option value="image">Images</option><option value="video">Videos</option><option value="audio">Audio</option><option value="pdf">PDFs</option><option value="other">Other files</option></select><label className="text-sm font-semibold text-slate-700 sm:pt-2" htmlFor="advanced-content">Has the words</label><input id="advanced-content" className="rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" placeholder="Words within a text or Zo-native file" value={filters.contentQuery} onChange={(event) => update({ contentQuery: event.target.value })} /><label className="text-sm font-semibold text-slate-700 sm:pt-2" htmlFor="advanced-name">Item name</label><input id="advanced-name" className="rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" placeholder="Part of the file name" value={itemName} onChange={(event) => onItemNameChange(event.target.value)} /><label className="text-sm font-semibold text-slate-700 sm:pt-2">Location</label><div className="space-y-3"><select aria-label="Search location" className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5" value={filters.location} onChange={(event) => update({ location: event.target.value as AdvancedFilters["location"] })}><option value="anywhere">Anywhere in My Drive</option><option value="current">Current folder only</option></select><label className="flex items-center gap-2 text-sm font-medium text-slate-700"><input aria-label="Search in Trash" className="size-4 accent-blue-600" type="checkbox" checked={filters.inTrash} onChange={(event) => update({ inTrash: event.target.checked })} /> Search in Trash</label><label className="flex items-center gap-2 text-sm font-medium text-slate-700"><input aria-label="Only starred files" className="size-4 accent-blue-600" type="checkbox" checked={filters.starred} onChange={(event) => update({ starred: event.target.checked })} /> Only Starred</label></div><label className="text-sm font-semibold text-slate-700 sm:pt-2">Date modified</label><select aria-label="Date modified" className="rounded-lg border border-slate-300 bg-white px-3 py-2.5" value={filters.modified} onChange={(event) => update({ modified: event.target.value as AdvancedFilters["modified"] })}><option value="any">Any time</option><option value="today">Today</option><option value="week">Past week</option><option value="month">Past month</option><option value="year">Past year</option></select></div><footer className="flex items-center justify-between border-t border-slate-100 px-6 py-4"><button className="text-sm font-semibold text-blue-700 hover:text-blue-900" type="button" onClick={onReset}>Reset</button><div className="flex gap-2"><button className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100" type="button" onClick={onCancel}>Cancel</button><button className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700" type="submit">Search</button></div></footer></form></div>;
}

function ShareDialog({ client, file, initialSettings, onClose }: { client: DriveClient; file: DriveObject; initialSettings?: PasteShareSettings; onClose: () => void }) {
  const [access, setAccess] = useState<ShareAccess>(initialSettings?.access ?? "public");
  const [editable, setEditable] = useState(initialSettings?.editable ?? false);
  const [passcode, setPasscode] = useState(initialSettings?.passcode ?? "");
  const [showPasscode, setShowPasscode] = useState(false);
  const [ttl, setTtl] = useState(initialSettings?.ttl ?? "never");
  const [link, setLink] = useState<string | null>(null);
  const mutation = useMutation({
    mutationFn: async () => client.createShare({ key: file.key, access, editable, passcode: access === "passcode" ? passcode : undefined, expiresAt: ttlToDate(ttl) }),
    onSuccess: (share) => {
      const nextLink = shareLink(share.id);
      setLink(nextLink);
      void copyText(nextLink, "Share link copied");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not create share link")
  });
  const isPaste = file.nativeType === "paste" || file.contentType === "application/vnd.zo.paste+json";
  return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4" role="dialog" aria-modal="true" aria-label={`Share ${file.name}`}><div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"><div className="flex items-start justify-between gap-4"><div><h2 className="text-lg font-semibold text-slate-900">Share {file.name}</h2><p className="mt-1 text-sm text-slate-500">Create a {editable ? "collaborative" : "view-only"} link you can manage later.</p></div><button className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" onClick={onClose} aria-label="Close share dialog"><X size={20} /></button></div>{link ? <div className="mt-5"><p className="text-sm font-medium text-slate-700">{editable ? "Editable link ready" : "Link ready"}</p><div className="mt-2 flex gap-2"><input className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm" value={link} readOnly /><button className="rounded-lg border border-slate-300 px-3 text-slate-700 hover:border-blue-300 hover:text-blue-700" onClick={() => void copyText(link, "Share link copied")} aria-label="Copy share link"><Copy size={18} /></button></div><button className="mt-5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700" onClick={onClose}>Done</button></div> : <div className="mt-5 space-y-4"><fieldset><legend className="text-sm font-medium text-slate-700">Who can open this link?</legend><div className="mt-2 grid grid-cols-2 gap-2"><label className={`rounded-lg border p-3 text-sm ${access === "public" ? "border-blue-500 bg-blue-50 text-blue-700" : "border-slate-200"}`}><input className="sr-only" type="radio" checked={access === "public"} onChange={() => setAccess("public")} />Anyone with link</label><label className={`rounded-lg border p-3 text-sm ${access === "passcode" ? "border-blue-500 bg-blue-50 text-blue-700" : "border-slate-200"}`}><input className="sr-only" type="radio" checked={access === "passcode"} onChange={() => setAccess("passcode")} />Passcode required</label></div></fieldset>{isPaste && <label className="flex cursor-pointer gap-3 rounded-lg border border-cyan-200 bg-cyan-50 p-3 text-sm text-slate-700"><input aria-label="Allow editing" className="mt-0.5 size-4 accent-cyan-700" type="checkbox" checked={editable} onChange={(event) => setEditable(event.target.checked)} /><span><span className="block font-semibold text-slate-800">Let people edit this paste</span><span className="mt-0.5 block text-xs leading-5 text-slate-500">Editors need no account. A passcode, expiry, and revocation apply to editing too.</span></span></label>}{access === "passcode" && <div className="relative"><input aria-label="Share passcode" className="w-full rounded-lg border border-slate-300 py-2.5 pl-3 pr-11 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" type={showPasscode ? "text" : "password"} placeholder="Choose a secret passcode" value={passcode} onChange={(event) => setPasscode(event.target.value)} required /><button aria-label={showPasscode ? "Hide share passcode" : "Show share passcode"} className="absolute right-1 top-1/2 -translate-y-1/2 rounded-md p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700" onClick={() => setShowPasscode((show) => !show)} type="button">{showPasscode ? <EyeOff size={18} /> : <Eye size={18} />}</button></div>}<label className="block text-sm font-medium text-slate-700">Link expiry<select aria-label="Link expiry" className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5" value={ttl} onChange={(event) => setTtl(event.target.value)}><option value="never">Never expires</option><option value="1d">Expires in 1 day</option><option value="7d">Expires in 7 days</option><option value="30d">Expires in 30 days</option></select></label><button className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:bg-slate-300" disabled={mutation.isPending || (access === "passcode" && !passcode)} onClick={() => mutation.mutate()}>{mutation.isPending ? "Creating link…" : editable ? "Create editable link" : "Create share link"}</button></div>}</div></div>;
}

function ChangePasscodeDialog({ client, share, onClose, onUpdated }: { client: DriveClient; share: DriveShare; onClose: () => void; onUpdated: () => void }) {
  const [passcode, setPasscode] = useState("");
  const [showPasscode, setShowPasscode] = useState(false);
  const mutation = useMutation({
    mutationFn: () => client.updateSharePasscode({ id: share.id, passcode }),
    onSuccess: () => {
      toast.success("Passcode changed");
      onUpdated();
      onClose();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not change the passcode")
  });
  return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4" role="dialog" aria-modal="true" aria-label={`Change passcode for ${share.name}`}><form className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl" onSubmit={(event) => { event.preventDefault(); mutation.mutate(); }}><div className="flex items-start justify-between gap-4"><div><h2 className="text-lg font-semibold text-slate-900">Change passcode</h2><p className="mt-1 text-sm text-slate-500">Set a new passcode for {share.name}. The current passcode cannot be viewed because it is encrypted.</p></div><button className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" onClick={onClose} aria-label="Close passcode dialog" type="button"><X size={20} /></button></div><div className="relative mt-5"><input aria-label="New share passcode" autoFocus className="w-full rounded-lg border border-slate-300 py-2.5 pl-3 pr-11 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" type={showPasscode ? "text" : "password"} placeholder="Enter a new passcode" value={passcode} onChange={(event) => setPasscode(event.target.value)} required /><button aria-label={showPasscode ? "Hide new share passcode" : "Show new share passcode"} className="absolute right-1 top-1/2 -translate-y-1/2 rounded-md p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700" onClick={() => setShowPasscode((show) => !show)} type="button">{showPasscode ? <EyeOff size={18} /> : <Eye size={18} />}</button></div><div className="mt-5 flex justify-end gap-2"><button className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100" onClick={onClose} type="button">Cancel</button><button className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:bg-slate-300" disabled={mutation.isPending || !passcode} type="submit">{mutation.isPending ? "Saving…" : "Save passcode"}</button></div></form></div>;
}

function SharedLinks({ shares, onCopy, onChangePasscode, onPreview, onRevoke }: { shares: DriveShare[]; onCopy: (share: DriveShare) => void; onChangePasscode: (share: DriveShare) => void; onPreview: (share: DriveShare) => void; onRevoke: (id: string) => void }) {
  if (shares.length === 0) return <EmptyState title="No active share links" description="Use the share button on a file to create a public or passcode-protected link." action="Go to My Drive" onAction={() => window.location.reload()} />;
  return <section aria-label="Links shared by you" className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><header className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-4 sm:px-5"><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">Share links</p><h2 className="mt-1 text-base font-semibold text-slate-900">Links shared by you</h2></div><span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">{shares.length} active</span></header><div className="divide-y divide-slate-100">{shares.map((share) => <article key={share.id} className="min-w-0 p-4 sm:flex sm:items-center sm:gap-4 sm:px-5"><div className="flex min-w-0 items-center gap-3 sm:flex-1"><span className="grid size-11 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-600"><Share2 size={20} /></span><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-slate-800" title={share.name}>{share.name}</p><p className="mt-1 text-xs leading-5 text-slate-500">{share.access === "public" ? "Anyone with the link" : "Passcode protected"} · {share.expiresAt ? `Expires ${new Date(share.expiresAt).toLocaleString()}` : "No expiry"}</p></div></div><div aria-label={`Actions for ${share.name}`} className="mt-4 grid grid-cols-[auto_auto_1fr] items-center gap-2 border-t border-slate-100 pt-3 sm:mt-0 sm:flex sm:shrink-0 sm:border-0 sm:pt-0"><button className="grid size-10 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-blue-700" onClick={() => onPreview(share)} aria-label={`View ${share.name}`} title="Preview"><Eye size={18} /></button><button className="grid size-10 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-blue-700" onClick={() => onCopy(share)} aria-label={`Copy link for ${share.name}`} title="Copy link"><Copy size={17} /></button><button className="col-start-3 justify-self-end rounded-lg px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50" onClick={() => onRevoke(share.id)}>Revoke</button>{share.access === "passcode" && <button className="col-span-3 inline-flex min-h-10 items-center justify-center rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 sm:col-auto" onClick={() => onChangePasscode(share)}>Change passcode</button>}</div></article>)}</div></section>;
}

function ClusterIncomingEntries({ files, mounts, onManage, onOpen }: { files: SharedDriveFile[]; mounts: ClusterMount[]; onManage: () => void; onOpen: (file: SharedDriveFile) => void }) {
  if (mounts.length === 0) return null;
  return <section className="overflow-hidden rounded-xl border border-cyan-200 bg-cyan-50/40"><header className="flex flex-wrap items-center justify-between gap-3 border-b border-cyan-100 px-5 py-4"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-cyan-800">Shared with me</p><h2 className="mt-1 text-lg font-semibold text-slate-900">{mounts.length} connected folder{mounts.length === 1 ? "" : "s"}</h2></div><button className="rounded-lg bg-cyan-700 px-3 py-2 text-sm font-semibold text-white hover:bg-cyan-800" onClick={onManage}>Manage Shared Drives</button></header>{files.length > 0 ? <div className="divide-y divide-cyan-100">{files.slice(0, 20).map((file) => <button className="flex w-full flex-wrap items-center gap-3 px-5 py-3 text-left hover:bg-cyan-100/60" key={`${file.mountId}:${file.key}`} onClick={() => onOpen(file)}><Network size={17} className="text-cyan-700" /><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-slate-800">{file.name}</span><span className="block truncate text-xs text-slate-500">{file.mountFolder} / {file.key}</span><span className="mt-1 block text-xs text-cyan-800">Shared by {sharedDriveAuthor(file.mountAuthor)} · {sharedDriveRoleLabel(file.mountRole)}</span></span><span className="text-xs text-slate-500">{formatDate(file.updatedAt)}</span></button>)}</div> : <p className="px-5 py-4 text-sm text-slate-500">The connected folder is ready. Its files will appear here when the remote Zo adds or changes them.</p>}</section>;
}

function SharedFilePage({ client, shareId }: { client: SharedClient; shareId: string }) {
  const shareQuery = useQuery({ queryKey: ["public-share", shareId], queryFn: () => client.getPublicShare(shareId), retry: false });
  const [passcode, setPasscode] = useState("");
  const [showPasscode, setShowPasscode] = useState(false);
  const [preview, setPreview] = useState<{ object: DriveObject; url: string } | null>(null);
  const downloadMutation = useMutation({
    mutationFn: () => client.downloadShared(shareId, passcode || undefined),
    onSuccess: async (response) => {
      const share = shareQuery.data;
      if (!share) return;
      const url = URL.createObjectURL(await response.blob());
        setPreview({ object: { key: share.id, name: share.name, size: share.size, contentType: share.contentType, updatedAt: new Date().toISOString(), starred: false }, url });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not open this shared file")
  });
  if (shareQuery.isPending) return <AuthLoading />;
  if (shareQuery.isError || !shareQuery.data) return <main className="grid min-h-screen place-items-center bg-[#f8faff] p-5 text-center"><div><h1 className="text-2xl font-semibold text-slate-900">This link is unavailable</h1><p className="mt-2 text-sm text-slate-500">It may have expired or been revoked.</p></div></main>;
  const share: PublicShare = shareQuery.data;
  if (share.contentType === "application/vnd.zo.paste+json") return <SharedPastePage client={client} share={share} shareId={shareId} />;
  return <main className="grid min-h-screen place-items-center bg-[#f8faff] p-5"><section className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-7 shadow-sm"><p className="text-sm font-medium text-blue-600">Zo Drive shared file</p><h1 className="mt-2 break-words text-2xl font-semibold text-slate-900">{share.name}</h1><p className="mt-2 text-sm text-slate-500">{formatBytes(share.size)} · {share.expiresAt ? `Available until ${new Date(share.expiresAt).toLocaleString()}` : "No expiry"}</p>{share.requiresPasscode && <label className="mt-6 block text-sm font-medium text-slate-700">Passcode<div className="relative mt-1.5"><input aria-label="Shared file passcode" className="w-full rounded-lg border border-slate-300 py-2.5 pl-3 pr-11 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" type={showPasscode ? "text" : "password"} value={passcode} onChange={(event) => setPasscode(event.target.value)} /><button aria-label={showPasscode ? "Hide shared file passcode" : "Show shared file passcode"} className="absolute right-1 top-1/2 -translate-y-1/2 rounded-md p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700" onClick={() => setShowPasscode((show) => !show)} type="button">{showPasscode ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></label>}<button className="mt-6 w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:bg-slate-300" disabled={downloadMutation.isPending || (share.requiresPasscode && !passcode)} onClick={() => downloadMutation.mutate()}>{downloadMutation.isPending ? "Opening…" : "Open shared file"}</button><button className="mt-3 w-full rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100" onClick={() => { window.location.href = driveAppUrl(); }}>Open Zo Drive</button></section>{preview && <PreviewDialog preview={preview} onClose={() => { URL.revokeObjectURL(preview.url); setPreview(null); }} />}</main>;
}

function LegacyPublicFormPage({ client, formId }: { client: PublicFormClient; formId: string }) {
  const formQuery = useQuery({ queryKey: ["public-form", formId], queryFn: () => client.getPublicForm(formId), retry: false });
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [submitted, setSubmitted] = useState(false);
  const submitMutation = useMutation({
    mutationFn: () => client.submitFormResponse(formId, answers),
    onSuccess: () => setSubmitted(true),
    onError: (error) => toast.error(error instanceof Error ? error.message : "Complete every required question")
  });
  if (formQuery.isPending) return <AuthLoading />;
  if (formQuery.isError || !formQuery.data) return <main className="grid min-h-screen place-items-center bg-slate-50 p-5 text-center"><div><h1 className="text-2xl font-semibold text-slate-900">This form is unavailable</h1><p className="mt-2 text-sm text-slate-500">It may have been unpublished or deleted.</p></div></main>;
  const form = formQuery.data;
  const theme = formThemes[formTheme(form.theme)];
  if (submitted) return <main className="grid min-h-screen place-items-center p-5" style={{ background: theme.background }}><section className="w-full max-w-xl overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"><div className="h-2" style={{ background: theme.accent }} /><div className="p-8 text-center"><h1 className="text-2xl font-semibold text-slate-900">Response recorded</h1><p className="mt-3 text-sm leading-6 text-slate-600">Thank you for completing {form.title}.</p></div></section></main>;
  const updateAnswer = (questionId: string, value: string | string[]) => setAnswers((current) => ({ ...current, [questionId]: value }));
  return <main className="min-h-screen px-4 py-8 md:py-12" style={{ background: theme.background }}><form className="mx-auto max-w-2xl space-y-4" onSubmit={(event) => { event.preventDefault(); submitMutation.mutate(); }}><section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"><div className="h-2" style={{ background: theme.accent }} /><div className="p-6 md:p-8"><h1 className="text-3xl font-semibold tracking-tight text-slate-900">{form.title}</h1>{form.description && <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-slate-600">{form.description}</p>}<p className="mt-5 text-xs text-slate-500"><span className="text-red-600">*</span> Required</p></div></section>{form.questions.map((question) => <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm" key={question.id}><label className="block text-base font-medium text-slate-900">{question.title}{question.required && <span className="ml-1 text-red-600">*</span>}</label>{question.description && <p className="mt-2 text-sm text-slate-500">{question.description}</p>}{question.type === "short-answer" && <input className="mt-5 w-full border-0 border-b border-slate-300 px-0 py-2 text-sm outline-none" required={question.required} value={typeof answers[question.id] === "string" ? answers[question.id] : ""} onChange={(event) => updateAnswer(question.id, event.target.value)} />}{question.type === "paragraph" && <textarea className="mt-5 min-h-28 w-full resize-y rounded-lg border border-slate-300 p-3 text-sm outline-none" required={question.required} value={typeof answers[question.id] === "string" ? answers[question.id] : ""} onChange={(event) => updateAnswer(question.id, event.target.value)} />}{question.type === "multiple-choice" && <div className="mt-5 space-y-3">{question.options.map((option) => <label className="flex cursor-pointer items-center gap-3 text-sm text-slate-700" key={option}><input required={question.required && !answers[question.id]} type="radio" name={question.id} value={option} checked={answers[question.id] === option} onChange={() => updateAnswer(question.id, option)} style={{ accentColor: theme.accent }} />{option}</label>)}</div>}{question.type === "checkboxes" && <div className="mt-5 space-y-3">{question.options.map((option) => { const existingAnswer = answers[question.id]; const selected: string[] = Array.isArray(existingAnswer) ? existingAnswer : []; return <label className="flex cursor-pointer items-center gap-3 text-sm text-slate-700" key={option}><input type="checkbox" checked={selected.includes(option)} onChange={(event) => updateAnswer(question.id, event.target.checked ? [...selected, option] : selected.filter((item) => item !== option))} style={{ accentColor: theme.accent }} />{option}</label>; })}</div>}{question.type === "dropdown" && <select className="mt-5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none" required={question.required} value={typeof answers[question.id] === "string" ? answers[question.id] : ""} onChange={(event) => updateAnswer(question.id, event.target.value)}><option value="">Choose an answer</option>{question.options.map((option) => <option key={option} value={option}>{option}</option>)}</select>}</section>)}<button className="rounded-lg px-6 py-3 text-sm font-semibold text-white disabled:opacity-60" disabled={submitMutation.isPending} style={{ background: theme.accent }} type="submit">{submitMutation.isPending ? "Submitting…" : "Submit"}</button><p className="pb-4 text-center text-xs text-slate-400">Powered by Zo Forms</p></form></main>;
}

function LegacyPublicFormPage2({ client, formId }: { client: PublicFormClient; formId: string }) {
  const formQuery = useQuery({ queryKey: ["public-form", formId], queryFn: () => client.getPublicForm(formId), retry: false });
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [submitted, setSubmitted] = useState(false);
  const submitMutation = useMutation({ mutationFn: () => client.submitFormResponse(formId, answers), onSuccess: () => setSubmitted(true), onError: (error) => toast.error(error instanceof Error ? error.message : "Complete every required question") });
  if (formQuery.isPending) return <AuthLoading />;
  if (formQuery.isError || !formQuery.data) return <main className="grid min-h-screen place-items-center bg-slate-50 p-5 text-center"><div><h1 className="text-2xl font-semibold text-slate-900">This form is unavailable</h1><p className="mt-2 text-sm text-slate-500">It may have been unpublished or deleted.</p></div></main>;
  const form = formQuery.data;
  const theme = formThemes[formTheme(form.theme)];
  const updateAnswer = (id: string, value: string | string[]) => setAnswers((current) => ({ ...current, [id]: value }));
  if (submitted) return <main className="grid min-h-screen place-items-center p-5" style={{ background: theme.background }}><section className="w-full max-w-xl overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"><div className="h-2" style={{ background: theme.accent }} /><div className="p-8 text-center"><h1 className="text-2xl font-semibold text-slate-900">Response recorded</h1><p className="mt-3 text-sm leading-6 text-slate-600">{form.settings.confirmationMessage || `Thank you for completing ${form.title}.`}</p></div></section></main>;
  return <main className="min-h-screen px-4 py-8 md:py-12" style={{ background: theme.background }}><form className="mx-auto max-w-2xl space-y-4" onSubmit={(event) => { event.preventDefault(); submitMutation.mutate(); }}><section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"><div className="h-2" style={{ background: theme.accent }} /><div className="p-6 md:p-8"><h1 className="text-3xl font-semibold tracking-tight text-slate-900">{form.title}</h1>{form.description && <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-slate-600">{form.description}</p>}<p className="mt-5 text-xs text-slate-500"><span className="text-red-600">*</span> Required</p></div></section>{form.settings.showProgressBar && <div className="h-1 overflow-hidden rounded-full bg-white/70"><div className="h-full" style={{ width: `${form.questions.length ? Math.round((Object.keys(answers).length / form.questions.length) * 100) : 0}%`, background: theme.accent }} /></div>}{!form.settings.acceptingResponses && <section className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">This form is not accepting responses.</section>}{form.questions.map((question) => <PublicFormQuestion accent={theme.accent} answer={answers[question.id]} key={question.id} question={question} onChange={(value) => updateAnswer(question.id, value)} />)}<button className="rounded-lg px-6 py-3 text-sm font-semibold text-white disabled:opacity-60" disabled={submitMutation.isPending || !form.settings.acceptingResponses} style={{ background: theme.accent }} type="submit">{submitMutation.isPending ? "Submitting…" : "Submit"}</button><p className="pb-4 text-center text-xs text-slate-400">Powered by Zo Forms</p></form></main>;
}

function FormBanner({ banner, className = "" }: { banner: "none" | "botanical" | "fireworks"; className?: string }) {
  if (banner === "none") return null;
  return <img alt="" className={`w-full object-cover ${className}`} src={`${appBasePath || ""}/form-banners/${banner}.png`} />;
}

function PublicFormPage({ client, formId }: { client: PublicFormClient; formId: string }) {
  const formQuery = useQuery({ queryKey: ["public-form", formId], queryFn: () => client.getPublicForm(formId), retry: false });
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [submitted, setSubmitted] = useState(false);
  const submitMutation = useMutation({ mutationFn: () => client.submitFormResponse(formId, answers), onSuccess: () => setSubmitted(true), onError: (error) => toast.error(error instanceof Error ? error.message : "Complete every required question") });
  if (formQuery.isPending) return <AuthLoading />;
  if (formQuery.isError || !formQuery.data) return <main className="grid min-h-screen place-items-center bg-slate-50 p-5 text-center"><div><h1 className="text-2xl font-semibold text-slate-900">This form is unavailable</h1><p className="mt-2 text-sm text-slate-500">It may have been unpublished or deleted.</p></div></main>;
  const form = formQuery.data;
  const theme = formThemes[formTheme(form.theme)];
  if (submitted) return <main className="grid min-h-screen place-items-center p-5" style={{ background: theme.background }}><section className="w-full max-w-xl overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"><FormBanner banner={form.banner} className="h-36" /><div className="h-2" style={{ background: theme.accent }} /><div className="p-8 text-center"><h1 className="text-2xl font-semibold text-slate-900">Response recorded</h1><p className="mt-3 text-sm leading-6 text-slate-600">{form.settings.confirmationMessage}</p></div></section></main>;
  return <main className="min-h-screen px-4 py-8 md:py-12" style={{ background: theme.background }}><form className="mx-auto max-w-2xl space-y-4" onSubmit={(event) => { event.preventDefault(); submitMutation.mutate(); }}><section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"><FormBanner banner={form.banner} className="h-48 md:h-60" /><div className="h-2" style={{ background: theme.accent }} /><div className="p-6 md:p-8"><h1 className="text-3xl font-semibold tracking-tight text-slate-900">{form.title}</h1>{form.description && <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-slate-600">{form.description}</p>}<p className="mt-5 text-xs text-slate-500"><span className="text-red-600">*</span> Required</p></div></section>{form.settings.showProgressBar && <div className="h-1 overflow-hidden rounded-full bg-white/70"><div className="h-full" style={{ width: `${form.questions.length ? Math.round((Object.keys(answers).length / form.questions.length) * 100) : 0}%`, background: theme.accent }} /></div>}{!form.settings.acceptingResponses && <section className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">This form is not accepting responses.</section>}{form.questions.map((question) => <PublicFormQuestion accent={theme.accent} answer={answers[question.id]} key={question.id} question={question} onChange={(value) => setAnswers((current) => ({ ...current, [question.id]: value }))} />)}<button className="rounded-lg px-6 py-3 text-sm font-semibold text-white disabled:opacity-60" disabled={submitMutation.isPending || !form.settings.acceptingResponses} style={{ background: theme.accent }} type="submit">{submitMutation.isPending ? "Submitting…" : "Submit"}</button><p className="pb-4 text-center text-xs text-slate-400">Powered by Zo Forms</p></form></main>;
}

function PublicFormQuestion({ accent, answer, question, onChange }: { accent: string; answer: string | string[] | undefined; question: import("@zo-drive/types").FormQuestion; onChange: (value: string | string[]) => void }) {
  const selected = Array.isArray(answer) ? answer : [];
  const stringAnswer = typeof answer === "string" ? answer : "";
  const icon = question.ratingIcon === "heart" ? "♥" : question.ratingIcon === "thumb" ? "👍" : "★";
  const grid = question.type === "multiple-choice-grid" || question.type === "checkbox-grid";
  return <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"><label className="block text-base font-medium text-slate-900">{question.title}{question.required && <span className="ml-1 text-red-600">*</span>}</label>{question.description && <p className="mt-2 text-sm text-slate-500">{question.description}</p>}{question.type === "short-answer" && <input className="mt-5 w-full border-0 border-b border-slate-300 px-0 py-2 text-sm outline-none" required={question.required} value={stringAnswer} onChange={(event) => onChange(event.target.value)} />}{question.type === "paragraph" && <textarea className="mt-5 min-h-28 w-full resize-y rounded-lg border border-slate-300 p-3 text-sm outline-none" required={question.required} value={stringAnswer} onChange={(event) => onChange(event.target.value)} />}{question.type === "date" && <input className="mt-5 rounded-lg border border-slate-300 px-3 py-2.5 text-sm" required={question.required} type="date" value={stringAnswer} onChange={(event) => onChange(event.target.value)} />}{question.type === "time" && <input className="mt-5 rounded-lg border border-slate-300 px-3 py-2.5 text-sm" required={question.required} type="time" value={stringAnswer} onChange={(event) => onChange(event.target.value)} />}{question.type === "multiple-choice" && <div className="mt-5 space-y-3">{question.options.map((option) => <label className="flex cursor-pointer items-center gap-3 text-sm text-slate-700" key={option}><input required={question.required && !answer} type="radio" name={question.id} checked={answer === option} onChange={() => onChange(option)} style={{ accentColor: accent }} />{option}</label>)}</div>}{question.type === "checkboxes" && <div className="mt-5 space-y-3">{question.options.map((option) => <label className="flex cursor-pointer items-center gap-3 text-sm text-slate-700" key={option}><input type="checkbox" checked={selected.includes(option)} onChange={(event) => onChange(event.target.checked ? [...selected, option] : selected.filter((item) => item !== option))} style={{ accentColor: accent }} />{option}</label>)}</div>}{question.type === "dropdown" && <select className="mt-5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none" required={question.required} value={stringAnswer} onChange={(event) => onChange(event.target.value)}><option value="">Choose an answer</option>{question.options.map((option) => <option key={option} value={option}>{option}</option>)}</select>}{question.type === "linear-scale" && <div className="mt-5"><div className="flex flex-wrap gap-3">{Array.from({ length: question.scaleMax - question.scaleMin + 1 }, (_, index) => question.scaleMin + index).map((value) => <label className="grid cursor-pointer justify-items-center gap-1 text-sm text-slate-600" key={value}><input required={question.required && !answer} type="radio" name={question.id} checked={answer === String(value)} onChange={() => onChange(String(value))} style={{ accentColor: accent }} />{value}</label>)}</div><div className="mt-2 flex justify-between text-xs text-slate-500"><span>{question.scaleMinLabel}</span><span>{question.scaleMaxLabel}</span></div></div>}{question.type === "rating" && <div className="mt-5 flex gap-1">{Array.from({ length: question.scaleMax }, (_, index) => index + 1).map((value) => <button aria-label={`Rate ${value}`} className="text-3xl transition hover:scale-110" key={value} style={{ color: Number(answer) >= value ? accent : "#cbd5e1" }} type="button" onClick={() => onChange(String(value))}>{icon}</button>)}</div>}{grid && <div className="mt-5 overflow-x-auto"><table className="min-w-full text-left text-sm"><thead><tr><th /><>{question.columns.map((column) => <th className="px-2 pb-2 text-center font-medium text-slate-500" key={column}>{column}</th>)}</></tr></thead><tbody>{question.rows.map((row) => <tr className="border-t border-slate-100" key={row}><th className="py-3 pr-3 font-medium text-slate-700">{row}</th>{question.columns.map((column) => { const token = `${row}::${column}`; const rowSelected = selected.filter((item) => item.startsWith(`${row}::`)); return <td className="px-2 py-3 text-center" key={column}><input type={question.type === "checkbox-grid" ? "checkbox" : "radio"} name={`${question.id}-${row}`} checked={selected.includes(token)} onChange={(event) => onChange(question.type === "checkbox-grid" ? (event.target.checked ? [...selected, token] : selected.filter((item) => item !== token)) : [...selected.filter((item) => !item.startsWith(`${row}::`)), token])} style={{ accentColor: accent }} /></td>; })}</tr>)}</tbody></table></div>}</section>;
}

function SharedPastePage({ client, share, shareId }: { client: SharedClient; share: PublicShare; shareId: string }) {
  const [passcode, setPasscode] = useState("");
  const [showPasscode, setShowPasscode] = useState(false);
  const [paste, setPaste] = useState<{ language: string; tags: string[]; text: string } | null>(null);
  const [revision, setRevision] = useState<string | null>(null);
  const openMutation = useMutation({
    mutationFn: async (): Promise<{ paste: { language: string; tags: string[]; text: string }; revision: string | null }> => {
      if (share.editable) {
        const opened = await client.openSharedPaste(shareId, passcode || undefined);
        return { paste: opened.content, revision: opened.revision };
      }
      return { paste: parsePasteContent(await (await client.downloadShared(shareId, passcode || undefined)).text()), revision: null };
    },
    onSuccess: (opened) => {
      try {
        setPaste(opened.paste);
        setRevision(opened.revision);
      } catch {
        toast.error("This shared paste has an unsupported format");
      }
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not open this paste")
  });
  const saveMutation = useMutation({
    mutationFn: () => {
      if (!paste || !revision) throw new Error("Open the latest version of this paste before saving");
      return client.saveSharedPaste({ id: shareId, content: { format: "zo-native", type: "paste", version: 1, ...paste }, expectedRevision: revision, passcode: passcode || undefined });
    },
    onSuccess: (saved) => {
      setPaste(saved.content);
      setRevision(saved.revision);
      toast.success("Changes saved");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not save changes")
  });
  if (!paste) return <main className="grid min-h-screen place-items-center bg-[#f8faff] p-5"><section className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-7 shadow-sm"><p className="text-sm font-medium text-blue-600">Zo Paste</p><h1 className="mt-2 break-words text-2xl font-semibold text-slate-900">{share.name}</h1><p className="mt-2 text-sm text-slate-500">{share.editable ? "You can edit this paste without an account." : "View-only paste."} {share.expiresAt ? `Available until ${new Date(share.expiresAt).toLocaleString()}` : "No expiry"}</p>{share.requiresPasscode && <label className="mt-6 block text-sm font-medium text-slate-700">Passcode<div className="relative mt-1.5"><input aria-label="Shared paste passcode" className="w-full rounded-lg border border-slate-300 py-2.5 pl-3 pr-11 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" type={showPasscode ? "text" : "password"} value={passcode} onChange={(event) => setPasscode(event.target.value)} /><button aria-label={showPasscode ? "Hide shared paste passcode" : "Show shared paste passcode"} className="absolute right-1 top-1/2 -translate-y-1/2 rounded-md p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700" onClick={() => setShowPasscode((show) => !show)} type="button">{showPasscode ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></label>}<button className="mt-6 w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:bg-slate-300" disabled={openMutation.isPending || (share.requiresPasscode && !passcode)} onClick={() => openMutation.mutate()}>{openMutation.isPending ? "Opening…" : share.editable ? "Open editor" : "View paste"}</button></section></main>;
  return <main className="min-h-screen bg-[#10151d] p-4 text-slate-100 md:p-8"><section className="mx-auto max-w-5xl overflow-hidden rounded-2xl border border-white/10 bg-[#161d27] shadow-2xl"><header className="flex flex-wrap items-start justify-between gap-4 border-b border-white/10 bg-[#1d2632] px-5 py-5 md:px-7"><div><p className="flex items-center gap-2 text-sm font-semibold text-cyan-300"><Code2 size={17} /> Zo Paste {share.editable && <span className="rounded bg-cyan-300/15 px-2 py-0.5 text-xs">Editable</span>}</p><h1 className="mt-2 break-words text-2xl font-semibold tracking-tight text-white">{share.name}</h1>{paste.tags.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{paste.tags.map((tag) => <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs font-medium text-slate-300" key={tag}>{tag}</span>)}</div>}</div><span className="rounded-md bg-white/10 px-2.5 py-1 font-mono text-xs font-semibold text-slate-300">{paste.language}</span></header>{share.editable ? <div><textarea aria-label="Shared paste content" className="min-h-[60vh] w-full resize-y bg-transparent p-5 font-mono text-sm leading-6 text-slate-100 outline-none placeholder:text-slate-600 md:p-7" spellCheck={false} value={paste.text} onChange={(event) => setPaste({ ...paste, text: event.target.value })} /><footer className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 bg-[#1d2632] px-5 py-4 md:px-7"><p className="text-xs text-slate-400">Saving checks that nobody changed the paste first.</p><button className="rounded-lg bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-200 disabled:bg-slate-600 disabled:text-slate-300" disabled={saveMutation.isPending} onClick={() => saveMutation.mutate()}>{saveMutation.isPending ? "Saving…" : "Save changes"}</button></footer></div> : <pre className="max-h-[70vh] overflow-auto p-5 font-mono text-sm leading-6 text-slate-100 md:p-7"><code>{paste.text}</code></pre>}</section></main>;
}

function PreviewDialog({ preview, onClose }: { preview: { object: DriveObject; url: string }; onClose: () => void }) {
  const { object, url } = preview;
  const [fullScreenPdf, setFullScreenPdf] = useState(false);

  useEffect(() => {
    if (!fullScreenPdf) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setFullScreenPdf(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [fullScreenPdf]);

  const media = object.contentType.startsWith("image/") ? <img className="max-h-[72vh] max-w-full rounded-lg object-contain" src={url} alt={object.name} />
    : object.contentType === "application/pdf" ? <iframe className="h-[72vh] w-full rounded-lg bg-white" src={url} title={object.name} />
      : object.contentType.startsWith("audio/") ? <audio className="w-full" src={url} controls />
        : object.contentType.startsWith("video/") ? <video className="max-h-[72vh] max-w-full rounded-lg" src={url} controls />
          : <a className="rounded-lg bg-blue-600 px-4 py-2 font-medium text-white" href={url} download={object.name}>Download {object.name}</a>;
  if (fullScreenPdf) return <div className="fixed inset-0 z-[60] flex flex-col bg-slate-950" role="dialog" aria-modal="true" aria-label={`Full screen PDF ${object.name}`}><header className="flex min-h-14 items-center gap-3 border-b border-white/10 bg-slate-900 px-4 text-white"><FileText className="shrink-0 text-blue-300" size={19} /><span className="min-w-0 flex-1 truncate text-sm font-medium">{object.name}</span><span className="hidden text-xs text-slate-400 sm:inline">Press Esc to exit</span><button className="rounded-lg px-3 py-2 text-sm font-medium hover:bg-white/10" onClick={() => setFullScreenPdf(false)}>Exit full screen</button></header><iframe className="min-h-0 flex-1 w-full bg-white" src={url} title={`${object.name} full screen`} /></div>;
  return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4" role="dialog" aria-modal="true" aria-label={`Preview ${object.name}`}><div className="w-full max-w-5xl rounded-2xl bg-slate-900 p-4 shadow-2xl"><div className="mb-4 flex items-center justify-between gap-4 text-white"><span className="truncate text-sm font-medium">{object.name}</span><div className="flex items-center gap-1">{object.contentType === "application/pdf" && <button className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium hover:bg-white/10" onClick={() => setFullScreenPdf(true)} aria-label="View PDF full screen"><Maximize2 size={18} /> <span className="hidden sm:inline">Full screen</span></button>}<button className="rounded-lg p-2 hover:bg-white/10" onClick={onClose} aria-label="Close preview"><X size={20} /></button></div></div><div className="grid min-h-48 place-items-center">{media}</div></div></div>;
}

function DocumentComposer({ blocks, html, onChange }: { blocks: string[]; html: string; onChange: (value: { blocks: string[]; html: string }) => void }) {
  const editor = useRef<HTMLDivElement>(null);
  const initialHtml = html ? sanitizeRichHtml(html) : blocksToHtml(blocks);

  useEffect(() => {
    if (editor.current && editor.current.innerHTML !== initialHtml) editor.current.innerHTML = initialHtml;
  }, [initialHtml]);

  function sync() {
    const nextHtml = sanitizeRichHtml(editor.current?.innerHTML ?? "");
    onChange({ blocks: richHtmlToBlocks(nextHtml), html: nextHtml });
  }

  function format(command: string, value?: string) {
    editor.current?.focus();
    document.execCommand(command, false, value);
    sync();
  }

  return <div className="min-h-full bg-slate-100 px-4 py-5 md:px-8"><div className="mx-auto max-w-4xl overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"><div className="flex flex-wrap items-center gap-1 border-b border-slate-200 bg-slate-50 p-2"><select aria-label="Text style" className="rounded-md bg-transparent px-2 py-1.5 text-sm font-medium text-slate-700 outline-none hover:bg-white" defaultValue="p" onChange={(event) => format("formatBlock", event.target.value)}><option value="p">Paragraph</option><option value="h1">Title</option><option value="h2">Heading</option><option value="blockquote">Quote</option></select><span className="mx-1 h-5 border-l border-slate-200" />{[["bold", <Bold size={17} />], ["italic", <Italic size={17} />], ["underline", <Underline size={17} />], ["insertUnorderedList", <List size={17} />], ["insertOrderedList", <ListOrdered size={17} />]].map(([command, icon]) => <button aria-label={`Format ${command}`} className="rounded-md p-2 text-slate-600 hover:bg-white hover:text-blue-700" key={String(command)} onMouseDown={(event) => event.preventDefault()} onClick={() => format(command as string)}>{icon}</button>)}</div><div ref={editor} aria-label="Document content" contentEditable suppressContentEditableWarning className="min-h-[62vh] p-8 text-[1.05rem] leading-8 text-slate-800 outline-none empty:before:pointer-events-none empty:before:text-slate-300 empty:before:content-[attr(data-placeholder)] md:p-12" data-placeholder="Start writing…" onInput={sync} /></div></div>;
}

function SpreadsheetComposer({ cells, onChange }: { cells: Record<string, string>; onChange: (cells: Record<string, string>) => void }) {
  const [selected, setSelected] = useState("A1");
  const columns = ["A", "B", "C", "D", "E", "F", "G", "H"];
  const updateCell = (cell: string, value: string) => onChange({ ...cells, [cell]: value });
  return <div className="min-h-full overflow-auto bg-slate-100 p-4 md:p-7"><div className="mx-auto min-w-[58rem] max-w-7xl overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"><div className="flex items-center gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3"><span className="rounded bg-slate-200 px-2 py-1 text-xs font-semibold text-slate-600">{selected}</span><Sigma size={18} className="text-slate-400" /><input aria-label="Formula bar" className="min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-700 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" placeholder="Enter a value or formula, e.g. =SUM(A1:A5)" value={cells[selected] ?? ""} onChange={(event) => updateCell(selected, event.target.value)} /><span className="text-xs text-slate-400">{formulaDisplay(cells[selected] ?? "", cells)}</span></div><div className="grid grid-cols-[3.25rem_repeat(8,minmax(7.5rem,1fr))] bg-slate-50 text-center text-xs font-semibold text-slate-400"><span className="border-b border-r border-slate-200 py-2" />{columns.map((column) => <span className="border-b border-r border-slate-200 py-2 last:border-r-0" key={column}>{column}</span>)}</div>{Array.from({ length: 24 }, (_, index) => index + 1).map((row) => <div className="grid grid-cols-[3.25rem_repeat(8,minmax(7.5rem,1fr))]" key={row}><span className="border-b border-r border-slate-200 bg-slate-50 py-2 text-center text-xs font-semibold text-slate-400">{row}</span>{columns.map((column) => { const cell = `${column}${row}`; const isSelected = selected === cell; return <button aria-label={`Cell ${cell}`} className={`min-w-0 border-b border-r border-slate-200 px-2 py-2 text-left text-sm text-slate-700 outline-none hover:bg-blue-50 focus:z-10 focus:ring-2 focus:ring-inset focus:ring-blue-500 ${isSelected ? "bg-blue-50 ring-2 ring-inset ring-blue-500" : "bg-white"}`} key={cell} onClick={() => setSelected(cell)} onDoubleClick={() => { const next = window.prompt(`Edit ${cell}`, cells[cell] ?? ""); if (next !== null) updateCell(cell, next); }} title={cells[cell] ?? ""}>{formulaDisplay(cells[cell] ?? "", cells)}</button>; })}</div>)}</div><p className="mx-auto mt-3 max-w-7xl text-xs text-slate-500">Select a cell and use the formula bar. Supports `+`, `-`, `*`, `/`, cell references, and `SUM(A1:A5)`.</p></div>;
}

function PresentationComposer({ activeSlide, onAdd, onSelect, onUpdate, slide, slides }: { activeSlide: number; onAdd: () => void; onSelect: (index: number) => void; onUpdate: (change: Record<string, unknown>) => void; slide: Record<string, unknown>; slides: Record<string, unknown>[] }) {
  const themeName = typeof slide.theme === "string" && slide.theme in presentationThemes ? slide.theme : "ocean";
  const theme = presentationThemes[themeName as keyof typeof presentationThemes];
  const layout = typeof slide.layout === "string" ? slide.layout : "title-body";
  return <div className="grid min-h-[calc(100vh-4rem)] md:grid-cols-[14rem_minmax(0,1fr)]"><aside className="border-b border-slate-200 bg-white p-4 md:border-b-0 md:border-r"><button className="mb-4 flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 py-2.5 text-sm font-semibold text-white hover:bg-blue-700" onClick={onAdd}><Plus size={17} /> New slide</button><div className="space-y-3">{slides.map((item, index) => { const itemTheme = presentationThemes[typeof item.theme === "string" && item.theme in presentationThemes ? item.theme as keyof typeof presentationThemes : "ocean"]; return <button className={`w-full overflow-hidden rounded-lg border text-left transition ${index === activeSlide ? "border-blue-500 ring-2 ring-blue-100" : "border-slate-200 hover:border-blue-300"}`} key={index} onClick={() => onSelect(index)}><span className="flex aspect-video flex-col justify-center p-3" style={{ background: itemTheme.background, color: itemTheme.foreground }}><span className="text-[0.55rem] font-bold uppercase opacity-60">{index + 1}</span><span className="mt-1 line-clamp-2 text-xs font-semibold">{typeof item.title === "string" ? item.title : "Untitled slide"}</span></span></button>; })}</div></aside><section className="min-w-0 bg-slate-100 p-4 md:p-8"><div className="mx-auto mb-4 flex max-w-6xl flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2"><Palette size={18} className="text-slate-500" /><label className="text-sm font-medium text-slate-600">Theme <select aria-label="Slide theme" className="ml-1 rounded-md border border-slate-300 bg-white px-2 py-1.5" value={themeName} onChange={(event) => onUpdate({ theme: event.target.value })}>{Object.keys(presentationThemes).map((name) => <option key={name} value={name}>{name[0]?.toUpperCase()}{name.slice(1)}</option>)}</select></label></div><label className="text-sm font-medium text-slate-600">Layout <select aria-label="Slide layout" className="ml-1 rounded-md border border-slate-300 bg-white px-2 py-1.5" value={layout} onChange={(event) => onUpdate({ layout: event.target.value })}><option value="title-body">Title and body</option><option value="statement">Big statement</option><option value="two-column">Two columns</option></select></label></div><article className={`mx-auto flex aspect-video w-full max-w-6xl flex-col overflow-hidden rounded-xl p-7 shadow-xl md:p-14 ${layout === "statement" ? "justify-center text-center" : ""}`} style={{ background: theme.background, color: theme.foreground }}><input aria-label="Slide title" className={`w-full border-0 bg-transparent font-semibold tracking-tight outline-none placeholder:opacity-40 ${layout === "statement" ? "text-4xl md:text-6xl" : "text-3xl md:text-5xl"}`} placeholder="Slide title" style={{ color: theme.foreground }} value={typeof slide.title === "string" ? slide.title : ""} onChange={(event) => onUpdate({ title: event.target.value })} /><textarea aria-label="Slide body" className={`mt-8 min-h-0 flex-1 resize-none border-0 bg-transparent text-lg leading-8 outline-none placeholder:opacity-40 md:text-2xl ${layout === "two-column" ? "columns-2 gap-12" : ""}`} placeholder="Write your key message…" style={{ color: theme.foreground }} value={typeof slide.body === "string" ? slide.body : ""} onChange={(event) => onUpdate({ body: event.target.value })} /></article></section></div>;
}

const pasteLanguages = ["plaintext", "bash", "css", "html", "javascript", "json", "markdown", "python", "sql", "typescript", "yaml"];

function PasteComposer({ language, settings, tags, text, onChange, onSettingsChange }: { language: string; settings: PasteShareSettings; tags: string[]; text: string; onChange: (content: { language: string; tags: string[]; text: string }) => void; onSettingsChange: (settings: PasteShareSettings) => void }) {
  const tagValue = tags.join(", ");
  const lineCount = Math.max(1, text.split("\n").length);
  return <div className="min-h-full bg-[#10151d] p-4 text-slate-100 md:p-8"><section className="mx-auto max-w-6xl overflow-hidden rounded-2xl border border-white/10 bg-[#161d27] shadow-2xl"><header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-[#1d2632] px-4 py-3 md:px-5"><div className="flex items-center gap-2 text-sm font-semibold"><Code2 size={18} className="text-cyan-300" /> Zo Paste <span className="rounded bg-white/10 px-2 py-0.5 font-mono text-xs font-medium text-slate-300">{language}</span></div><label className="text-xs font-medium text-slate-400">Syntax <select aria-label="Paste syntax" className="ml-2 rounded-md border border-white/10 bg-slate-900 px-2 py-1.5 text-sm text-slate-100 outline-none focus:border-cyan-400" value={language} onChange={(event) => onChange({ language: event.target.value, tags, text })}>{pasteLanguages.map((item) => <option key={item} value={item}>{item}</option>)}</select></label></header><div className="grid min-h-[60vh] grid-cols-[3.5rem_minmax(0,1fr)] font-mono text-sm leading-6"><div aria-hidden="true" className="select-none border-r border-white/10 bg-[#121923] px-3 py-5 text-right text-slate-600">{Array.from({ length: lineCount }, (_, index) => <div key={index}>{index + 1}</div>)}</div><textarea aria-label="Paste content" className="min-h-[60vh] resize-none bg-transparent px-5 py-5 text-slate-100 outline-none placeholder:text-slate-600" spellCheck={false} placeholder="Paste or write text here…" value={text} onChange={(event) => onChange({ language, tags, text: event.target.value })} /></div><footer className="grid gap-5 border-t border-white/10 bg-[#1d2632] p-4 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]"><label className="text-sm font-medium text-slate-300">Tags <input aria-label="Paste tags" className="mt-1.5 w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-cyan-400" placeholder="e.g. api, debugging, release-notes" value={tagValue} onChange={(event) => onChange({ language, tags: event.target.value.split(",").map((tag) => tag.trim()).filter(Boolean).slice(0, 12), text })} /></label><section className="rounded-xl border border-white/10 bg-[#121923] p-4"><div><p className="text-sm font-semibold text-white">Paste settings</p><p className="mt-1 text-xs leading-5 text-slate-400">These options apply when you create the share link. Your paste remains private until then.</p></div><fieldset className="mt-4"><legend className="text-xs font-semibold uppercase tracking-wide text-slate-400">Link exposure</legend><div className="mt-2 grid grid-cols-2 gap-2"><label className={`rounded-lg border px-3 py-2 text-sm font-medium ${settings.access === "public" ? "border-cyan-400 bg-cyan-400/10 text-cyan-100" : "border-white/10 text-slate-300"}`}><input className="sr-only" type="radio" checked={settings.access === "public"} onChange={() => onSettingsChange({ ...settings, access: "public", passcode: "" })} />Anyone with link</label><label className={`rounded-lg border px-3 py-2 text-sm font-medium ${settings.access === "passcode" ? "border-cyan-400 bg-cyan-400/10 text-cyan-100" : "border-white/10 text-slate-300"}`}><input className="sr-only" type="radio" checked={settings.access === "passcode"} onChange={() => onSettingsChange({ ...settings, access: "passcode" })} />Passcode required</label></div></fieldset><div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="text-sm font-medium text-slate-300">Paste expiration<select aria-label="Paste expiration" className="mt-1.5 w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-400" value={settings.ttl} onChange={(event) => onSettingsChange({ ...settings, ttl: event.target.value })}><option value="never">Never expires</option><option value="1d">1 day</option><option value="7d">7 days</option><option value="30d">30 days</option></select></label>{settings.access === "passcode" && <label className="text-sm font-medium text-slate-300">Passcode<input aria-label="Paste share passcode" className="mt-1.5 w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-cyan-400" type="password" placeholder="Choose a passcode" value={settings.passcode} onChange={(event) => onSettingsChange({ ...settings, passcode: event.target.value })} /></label>}</div></section></footer></section></div>;
}

type FormQuestionType = "short-answer" | "paragraph" | "multiple-choice" | "checkboxes" | "dropdown" | "linear-scale" | "rating" | "multiple-choice-grid" | "checkbox-grid" | "date" | "time";
type FormQuestion = {
  columns: string[];
  description: string;
  id: string;
  options: string[];
  ratingIcon: "star" | "heart" | "thumb";
  required: boolean;
  rows: string[];
  scaleMax: number;
  scaleMaxLabel: string;
  scaleMin: number;
  scaleMinLabel: string;
  title: string;
  type: FormQuestionType;
};

const formQuestionTypes: Array<{ label: string; value: FormQuestionType }> = [
  { value: "short-answer", label: "Short answer" },
  { value: "paragraph", label: "Paragraph" },
  { value: "multiple-choice", label: "Multiple choice" },
  { value: "checkboxes", label: "Checkboxes" },
  { value: "dropdown", label: "Dropdown" },
  { value: "linear-scale", label: "Linear scale" },
  { value: "rating", label: "Rating" },
  { value: "multiple-choice-grid", label: "Multiple choice grid" },
  { value: "checkbox-grid", label: "Checkbox grid" },
  { value: "date", label: "Date" },
  { value: "time", label: "Time" }
];

function createFormQuestion(index: number, type: FormQuestionType = "multiple-choice"): FormQuestion {
  const choice = type === "multiple-choice" || type === "checkboxes" || type === "dropdown";
  const grid = type === "multiple-choice-grid" || type === "checkbox-grid";
  return { id: `question-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`, title: "", description: "", type, options: choice ? ["Option 1"] : [], rows: grid ? ["Row 1"] : [], columns: grid ? ["Column 1"] : [], required: false, scaleMin: 1, scaleMax: 5, scaleMinLabel: "", scaleMaxLabel: "", ratingIcon: "star" };
}

function parseFormQuestions(value: unknown): FormQuestion[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 100).flatMap((question, index): FormQuestion[] => {
    if (typeof question === "string") return [{ ...createFormQuestion(index), title: question, type: "short-answer", options: [] }];
    if (!question || typeof question !== "object" || Array.isArray(question)) return [];
    const item = question as Partial<FormQuestion>;
    const type = formQuestionTypes.some((candidate) => candidate.value === item.type) ? item.type as FormQuestionType : "short-answer";
    const options = Array.isArray(item.options) ? item.options.filter((option): option is string => typeof option === "string").slice(0, 50) : [];
    const rows = Array.isArray(item.rows) ? item.rows.filter((row): row is string => typeof row === "string").slice(0, 50) : [];
    const columns = Array.isArray(item.columns) ? item.columns.filter((column): column is string => typeof column === "string").slice(0, 50) : [];
    return [{
      id: typeof item.id === "string" && item.id ? item.id : createFormQuestion(index).id,
      title: typeof item.title === "string" ? item.title : "",
      description: typeof item.description === "string" ? item.description : "",
      type,
      options: type === "multiple-choice" || type === "checkboxes" || type === "dropdown" ? (options.length > 0 ? options : ["Option 1"]) : [],
      rows: type === "multiple-choice-grid" || type === "checkbox-grid" ? (rows.length > 0 ? rows : ["Row 1"]) : [],
      columns: type === "multiple-choice-grid" || type === "checkbox-grid" ? (columns.length > 0 ? columns : ["Column 1"]) : [],
      required: item.required === true,
      scaleMin: typeof item.scaleMin === "number" && item.scaleMin >= 0 && item.scaleMin < 10 ? item.scaleMin : 1,
      scaleMax: typeof item.scaleMax === "number" && item.scaleMax > 0 && item.scaleMax <= 10 ? item.scaleMax : 5,
      scaleMinLabel: typeof item.scaleMinLabel === "string" ? item.scaleMinLabel : "",
      scaleMaxLabel: typeof item.scaleMaxLabel === "string" ? item.scaleMaxLabel : "",
      ratingIcon: item.ratingIcon === "heart" || item.ratingIcon === "thumb" ? item.ratingIcon : "star"
    }];
  });
}

const formThemes = {
  violet: { accent: "#673ab7", background: "#f3f0f9", name: "Violet" },
  ocean: { accent: "#00796b", background: "#edf8f7", name: "Ocean" },
  forest: { accent: "#2e7d32", background: "#f1f8f1", name: "Forest" },
  sunset: { accent: "#e65100", background: "#fff4eb", name: "Sunset" },
  rose: { accent: "#c2185b", background: "#fff1f6", name: "Rose" }
} as const;

type FormTheme = keyof typeof formThemes;

function formTheme(value: unknown): FormTheme {
  return typeof value === "string" && value in formThemes ? value as FormTheme : "violet";
}

function LegacyFormComposer({ description, questions, title, onChange }: { description: string; questions: FormQuestion[]; title: string; onChange: (next: { description: string; questions: FormQuestion[]; title: string }) => void }) {
  const updateQuestion = (id: string, change: Partial<FormQuestion>) => onChange({ title, description, questions: questions.map((question) => question.id === id ? { ...question, ...change } : question) });
  const isChoiceQuestion = (type: FormQuestionType) => type === "multiple-choice" || type === "checkboxes" || type === "dropdown";
  const addQuestion = () => onChange({ title, description, questions: [...questions, createFormQuestion(questions.length)] });

  return <div className="min-h-full bg-[#f3f0f9] px-4 py-6 md:px-8 md:py-10"><div className="mx-auto max-w-3xl"><div className="mb-5 flex items-center justify-between border-b border-slate-200 px-2"><span className="border-b-2 border-[#673ab7] px-3 pb-3 text-sm font-semibold text-[#673ab7]">Questions</span><span className="px-3 pb-3 text-sm font-medium text-slate-400">Private draft</span></div><section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"><div className="h-2 bg-[#673ab7]" /><div className="p-6 md:p-8"><input aria-label="Form title" className="w-full border-0 border-b border-slate-200 bg-transparent pb-2 text-3xl font-semibold tracking-tight text-slate-900 outline-none placeholder:text-slate-300 focus:border-[#673ab7]" placeholder="Untitled form" value={title} onChange={(event) => onChange({ title: event.target.value, description, questions })} /><textarea aria-label="Form description" className="mt-4 min-h-12 w-full resize-none border-0 bg-transparent text-sm leading-6 text-slate-600 outline-none placeholder:text-slate-400" placeholder="Form description" value={description} onChange={(event) => onChange({ title, description: event.target.value, questions })} /></div></section><div className="relative mt-4 space-y-4">{questions.map((question, index) => <section className="relative overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm focus-within:border-[#673ab7] focus-within:ring-2 focus-within:ring-[#ede7f6]" key={question.id}><div className="absolute inset-y-0 left-0 w-1 bg-[#673ab7]" /><div className="p-5 pl-6 md:p-7 md:pl-8"><div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_12rem]"><input aria-label={`Question ${index + 1}`} className="min-w-0 border-0 border-b border-slate-300 bg-slate-50 px-3 py-3 text-base font-medium text-slate-900 outline-none focus:border-[#673ab7]" placeholder="Question" value={question.title} onChange={(event) => updateQuestion(question.id, { title: event.target.value })} /><select aria-label={`Question ${index + 1} type`} className="rounded border border-slate-300 bg-white px-3 py-3 text-sm font-medium text-slate-700 outline-none focus:border-[#673ab7]" value={question.type} onChange={(event) => { const type = event.target.value as FormQuestionType; updateQuestion(question.id, { type, options: isChoiceQuestion(type) ? (question.options.length > 0 ? question.options : ["Option 1"]) : [] }); }}>{formQuestionTypes.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></div><input aria-label={`Question ${index + 1} description`} className="mt-3 w-full border-0 border-b border-transparent bg-transparent py-2 text-sm text-slate-600 outline-none placeholder:text-slate-400 focus:border-[#673ab7]" placeholder="Description (optional)" value={question.description} onChange={(event) => updateQuestion(question.id, { description: event.target.value })} />{isChoiceQuestion(question.type) ? <div className="mt-5 space-y-2">{question.options.map((option, optionIndex) => <div className="flex items-center gap-3" key={`${question.id}-${optionIndex}`}><span className={`size-4 shrink-0 border border-slate-400 ${question.type === "checkboxes" ? "rounded-sm" : question.type === "dropdown" ? "rounded" : "rounded-full"}`} /><input aria-label={`Question ${index + 1} option ${optionIndex + 1}`} className="min-w-0 flex-1 border-0 border-b border-transparent px-1 py-2 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-[#673ab7]" placeholder={`Option ${optionIndex + 1}`} value={option} onChange={(event) => updateQuestion(question.id, { options: question.options.map((item, itemIndex) => itemIndex === optionIndex ? event.target.value : item) })} /><button aria-label={`Remove option ${optionIndex + 1} from question ${index + 1}`} className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600" disabled={question.options.length === 1} onClick={() => updateQuestion(question.id, { options: question.options.filter((_, itemIndex) => itemIndex !== optionIndex) })}><X size={16} /></button></div>)}<button className="ml-7 text-sm font-medium text-[#673ab7] hover:underline" onClick={() => updateQuestion(question.id, { options: [...question.options, `Option ${question.options.length + 1}`] })}>Add option</button></div> : <div className={`mt-5 border-b border-slate-300 text-sm text-slate-400 ${question.type === "paragraph" ? "pb-12" : "pb-2"}`}>{question.type === "paragraph" ? "Long answer text" : "Short answer text"}</div>}<div className="mt-6 flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 pt-4"><button aria-label={`Duplicate question ${index + 1}`} className="rounded-md p-2 text-slate-500 hover:bg-[#f3f0f9] hover:text-[#673ab7]" onClick={() => onChange({ title, description, questions: [...questions.slice(0, index + 1), { ...question, id: createFormQuestion(index).id, options: [...question.options] }, ...questions.slice(index + 1)] })}><Copy size={17} /></button><button aria-label={`Remove question ${index + 1}`} className="rounded-md p-2 text-slate-500 hover:bg-red-50 hover:text-red-600" onClick={() => onChange({ title, description, questions: questions.filter((item) => item.id !== question.id) })}><Trash2 size={17} /></button><span className="mx-1 h-6 border-l border-slate-200" /><label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-600">Required<input aria-label={`Question ${index + 1} required`} className="accent-[#673ab7]" type="checkbox" checked={question.required} onChange={(event) => updateQuestion(question.id, { required: event.target.checked })} /></label></div></div></section>)}<div className="sticky bottom-6 flex justify-end"><button className="flex items-center gap-2 rounded-full bg-[#673ab7] px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-900/20 transition hover:bg-[#5b2fa1]" onClick={addQuestion}><Plus size={18} /> Add question</button></div></div></div></div>;
}

function FormComposer({ description, questions, theme = "violet", title, onChange }: { description: string; questions: FormQuestion[]; theme?: FormTheme; title: string; onChange: (next: { description: string; questions: FormQuestion[]; title: string }) => void }) {
  const accent = formThemes[theme].accent;
  const updateQuestion = (id: string, change: Partial<FormQuestion>) => onChange({ title, description, questions: questions.map((question) => question.id === id ? { ...question, ...change } : question) });
  const insertQuestion = (type: FormQuestionType = "multiple-choice") => onChange({ title, description, questions: [...questions, createFormQuestion(questions.length, type)] });
  const addListItem = (question: FormQuestion, field: "options" | "rows" | "columns", label: string) => updateQuestion(question.id, { [field]: [...question[field], `${label} ${question[field].length + 1}`] });
  const isChoice = (type: FormQuestionType) => type === "multiple-choice" || type === "checkboxes" || type === "dropdown";
  const isGrid = (type: FormQuestionType) => type === "multiple-choice-grid" || type === "checkbox-grid";
  return <div className="min-h-full px-4 py-7 md:px-8 md:py-10" style={{ background: formThemes[theme].background }}><div className="mx-auto max-w-3xl"><section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"><div className="h-2" style={{ background: accent }} /><div className="p-6 md:p-8"><input aria-label="Form title" className="w-full border-0 border-b border-slate-200 bg-transparent pb-2 text-3xl font-semibold tracking-tight text-slate-900 outline-none placeholder:text-slate-300 focus:border-[var(--form-accent)]" style={{ "--form-accent": accent } as React.CSSProperties} placeholder="Untitled form" value={title} onChange={(event) => onChange({ title: event.target.value, description, questions })} /><textarea aria-label="Form description" className="mt-4 min-h-12 w-full resize-none border-0 bg-transparent text-sm leading-6 text-slate-600 outline-none placeholder:text-slate-400" placeholder="Form description" value={description} onChange={(event) => onChange({ title, description: event.target.value, questions })} /></div></section><div className="mt-4 space-y-4">{questions.map((question, index) => <section className="relative overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm focus-within:ring-2" style={{ "--tw-ring-color": `${accent}30` } as React.CSSProperties} key={question.id}><div className="absolute inset-y-0 left-0 w-1" style={{ background: accent }} /><div className="p-5 pl-6 md:p-7 md:pl-8"><div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_14rem]"><input aria-label={`Question ${index + 1}`} className="min-w-0 border-0 border-b border-slate-300 bg-slate-50 px-3 py-3 text-base font-medium text-slate-900 outline-none focus:border-slate-500" placeholder="Question" value={question.title} onChange={(event) => updateQuestion(question.id, { title: event.target.value })} /><select aria-label={`Question ${index + 1} type`} className="rounded border border-slate-300 bg-white px-3 py-3 text-sm font-medium text-slate-700 outline-none focus:border-slate-500" value={question.type} onChange={(event) => { const type = event.target.value as FormQuestionType; updateQuestion(question.id, { ...createFormQuestion(index, type), id: question.id, title: question.title, description: question.description, required: question.required }); }}>{formQuestionTypes.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></div><input aria-label={`Question ${index + 1} description`} className="mt-3 w-full border-0 border-b border-transparent bg-transparent py-2 text-sm text-slate-600 outline-none placeholder:text-slate-400 focus:border-slate-400" placeholder="Description (optional)" value={question.description} onChange={(event) => updateQuestion(question.id, { description: event.target.value })} />{isChoice(question.type) && <EditableOptionList accent={accent} field="options" label="Option" question={question} onAdd={addListItem} onChange={updateQuestion} />} {isGrid(question.type) && <div className="mt-5 grid gap-6 md:grid-cols-2"><EditableOptionList accent={accent} field="rows" label="Row" question={question} onAdd={addListItem} onChange={updateQuestion} /><EditableOptionList accent={accent} field="columns" label="Column" question={question} onAdd={addListItem} onChange={updateQuestion} /></div>}{question.type === "linear-scale" && <div className="mt-5 grid gap-4 sm:grid-cols-[8rem_8rem_minmax(0,1fr)]"><label className="text-sm font-medium text-slate-600">From<select aria-label={`Question ${index + 1} scale minimum`} className="mt-1 block w-full rounded border border-slate-300 bg-white px-2 py-2" value={question.scaleMin} onChange={(event) => updateQuestion(question.id, { scaleMin: Number(event.target.value) })}>{[0, 1].map((value) => <option key={value} value={value}>{value}</option>)}</select></label><label className="text-sm font-medium text-slate-600">To<select aria-label={`Question ${index + 1} scale maximum`} className="mt-1 block w-full rounded border border-slate-300 bg-white px-2 py-2" value={question.scaleMax} onChange={(event) => updateQuestion(question.id, { scaleMax: Number(event.target.value) })}>{[3, 4, 5, 6, 7, 8, 9, 10].map((value) => <option key={value} value={value}>{value}</option>)}</select></label><div className="grid gap-2 sm:grid-cols-2"><input aria-label={`Question ${index + 1} scale low label`} className="rounded border border-slate-300 px-2 py-2 text-sm" placeholder="Low label (optional)" value={question.scaleMinLabel} onChange={(event) => updateQuestion(question.id, { scaleMinLabel: event.target.value })} /><input aria-label={`Question ${index + 1} scale high label`} className="rounded border border-slate-300 px-2 py-2 text-sm" placeholder="High label (optional)" value={question.scaleMaxLabel} onChange={(event) => updateQuestion(question.id, { scaleMaxLabel: event.target.value })} /></div></div>}{question.type === "rating" && <div className="mt-5 flex flex-wrap items-center gap-3"><select aria-label={`Question ${index + 1} rating icon`} className="rounded border border-slate-300 bg-white px-2 py-2 text-sm" value={question.ratingIcon} onChange={(event) => updateQuestion(question.id, { ratingIcon: event.target.value as FormQuestion["ratingIcon"] })}><option value="star">Stars</option><option value="heart">Hearts</option><option value="thumb">Thumbs</option></select><select aria-label={`Question ${index + 1} rating limit`} className="rounded border border-slate-300 bg-white px-2 py-2 text-sm" value={question.scaleMax} onChange={(event) => updateQuestion(question.id, { scaleMax: Number(event.target.value) })}>{[3, 4, 5, 6, 7, 8, 9, 10].map((value) => <option key={value} value={value}>{value} icons</option>)}</select><span className="text-xl tracking-wide text-slate-400">{Array.from({ length: question.scaleMax }, () => question.ratingIcon === "heart" ? "♡" : question.ratingIcon === "thumb" ? "👍" : "☆").join("")}</span></div>}{["short-answer", "paragraph", "date", "time"].includes(question.type) && <div className={`mt-5 border-b border-slate-300 text-sm text-slate-400 ${question.type === "paragraph" ? "pb-12" : "pb-2"}`}>{question.type === "paragraph" ? "Long answer text" : question.type === "date" ? "Date" : question.type === "time" ? "Time" : "Short answer text"}</div>}<div className="mt-6 flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 pt-4"><button aria-label={`Duplicate question ${index + 1}`} className="rounded-md p-2 text-slate-500 hover:bg-slate-100" type="button" onClick={() => onChange({ title, description, questions: [...questions.slice(0, index + 1), { ...question, id: createFormQuestion(index).id, options: [...question.options], rows: [...question.rows], columns: [...question.columns] }, ...questions.slice(index + 1)] })}><Copy size={17} /></button><button aria-label={`Remove question ${index + 1}`} className="rounded-md p-2 text-slate-500 hover:bg-red-50 hover:text-red-600" type="button" onClick={() => onChange({ title, description, questions: questions.filter((item) => item.id !== question.id) })}><Trash2 size={17} /></button><span className="mx-1 h-6 border-l border-slate-200" /><label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-600">Required<input aria-label={`Question ${index + 1} required`} className="size-4" style={{ accentColor: accent }} type="checkbox" checked={question.required} onChange={(event) => updateQuestion(question.id, { required: event.target.checked })} /></label></div></div></section>)}</div><div className="sticky bottom-6 mt-5 flex justify-end"><button className="flex items-center gap-2 rounded-full px-5 py-3 text-sm font-semibold text-white shadow-lg" style={{ background: accent }} onClick={() => insertQuestion()} type="button"><Plus size={18} /> Add question</button></div></div></div>;
}

function EditableOptionList({ accent, field, label, question, onAdd, onChange }: { accent: string; field: "options" | "rows" | "columns"; label: string; question: FormQuestion; onAdd: (question: FormQuestion, field: "options" | "rows" | "columns", label: string) => void; onChange: (id: string, change: Partial<FormQuestion>) => void }) {
  const values = question[field];
  return <div className="space-y-2"><p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}s</p>{values.map((value, index) => <div className="flex items-center gap-2" key={`${question.id}-${field}-${index}`}><span className="size-3 rounded-full border border-slate-400" /><input aria-label={`${label} ${index + 1}`} className="min-w-0 flex-1 border-0 border-b border-transparent px-1 py-2 text-sm text-slate-700 outline-none focus:border-slate-400" placeholder={`${label} ${index + 1}`} value={value} onChange={(event) => onChange(question.id, { [field]: values.map((item, itemIndex) => itemIndex === index ? event.target.value : item) })} /><button aria-label={`Remove ${label} ${index + 1}`} className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600" disabled={values.length === 1} onClick={() => onChange(question.id, { [field]: values.filter((_, itemIndex) => itemIndex !== index) })} type="button"><X size={15} /></button></div>)}<button className="text-sm font-medium hover:underline" style={{ color: accent }} onClick={() => onAdd(question, field, label)} type="button">Add {label.toLowerCase()}</button></div>;
}

function FormNativeEditor({ initialContent, initialFileName, onClose, onListResponses, onPublish, onRename, onSave }: { initialContent: NativeFileContent; initialFileName: string; onClose: () => void; onListResponses: (id: string) => Promise<FormResponse[]>; onPublish: () => Promise<PublishedForm>; onRename: (name: string) => Promise<void>; onSave: (content: NativeFileContent) => Promise<void> }) {
  const [content, setContent] = useState(initialContent);
  const [fileName, setFileName] = useState(initialFileName);
  const [publishedForm, setPublishedForm] = useState<PublishedForm | null>(null);
  const [tab, setTab] = useState<"questions" | "responses" | "settings">("questions");
  const [preview, setPreview] = useState(false);
  const [saveState, setSaveState] = useState<"saved" | "saving" | "error">("saved");
  const savedContent = useRef(JSON.stringify(initialContent));
  const saveTimer = useRef<number | null>(null);
  const renameTimer = useRef<number | null>(null);
  const settingsValue = content.settings && typeof content.settings === "object" && !Array.isArray(content.settings) ? content.settings as Record<string, unknown> : {};
  const settings = { acceptingResponses: settingsValue.acceptingResponses !== false, confirmationMessage: typeof settingsValue.confirmationMessage === "string" ? settingsValue.confirmationMessage : "Your response has been recorded.", showProgressBar: settingsValue.showProgressBar === true };
  const theme = formTheme(content.theme);
  const responsesQuery = useQuery({ queryKey: ["form-responses", publishedForm?.id], queryFn: () => onListResponses(publishedForm!.id), enabled: tab === "responses" && Boolean(publishedForm?.id) });

  useEffect(() => {
    const signature = JSON.stringify(content);
    if (signature === savedContent.current) return;
    setSaveState("saving");
    saveTimer.current = window.setTimeout(() => { void onSave(content).then(() => { savedContent.current = signature; setSaveState("saved"); }).catch(() => setSaveState("error")); }, 700);
    return () => { if (saveTimer.current !== null) window.clearTimeout(saveTimer.current); };
  }, [content, onSave]);

  useEffect(() => {
    if (!fileName.trim() || fileName.trim() === initialFileName) return;
    renameTimer.current = window.setTimeout(() => { void onRename(fileName.trim()).catch(() => toast.error("Could not rename the form")); }, 700);
    return () => { if (renameTimer.current !== null) window.clearTimeout(renameTimer.current); };
  }, [fileName, initialFileName, onRename]);

  async function saveNow() {
    if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
    const signature = JSON.stringify(content);
    if (signature === savedContent.current) return;
    setSaveState("saving");
    await onSave(content);
    savedContent.current = signature;
    setSaveState("saved");
  }

  async function publish() {
    try {
      await saveNow();
      const form = await onPublish();
      setPublishedForm(form);
      await copyText(formLink(form.shortCode), "Form link copied");
      toast.success("Form published");
    } catch { toast.error("Could not publish the form"); }
  }

  async function close() {
    try { await saveNow(); await onRename(fileName.trim() || initialFileName); onClose(); } catch { toast.error("Could not save the latest changes"); }
  }

  const questions = parseFormQuestions(content.questions);
  const updateSettings = (change: Partial<typeof settings>) => setContent({ ...content, settings: { ...settings, ...change } });
  if (preview) return <FormPreview content={content} fileName={fileName} onClose={() => setPreview(false)} />;
  return <div className="fixed inset-0 z-50 flex flex-col bg-slate-100" role="dialog" aria-modal="true" aria-label="Edit Zo Form"><header className="flex min-h-16 items-center gap-3 border-b border-slate-200 bg-white px-4 md:px-6"><button aria-label="Close editor" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" onClick={() => void close()}><X size={20} /></button><input aria-label="File name" className="min-w-0 flex-1 border-0 bg-transparent text-base font-semibold text-slate-800 outline-none md:max-w-sm" value={fileName} onChange={(event) => setFileName(event.target.value)} /><span aria-live="polite" className={`hidden text-xs font-medium sm:block ${saveState === "error" ? "text-red-600" : "text-slate-400"}`}>{saveState === "saving" ? "Saving…" : saveState === "error" ? "Changes not saved" : "All changes saved"}</span><button aria-label="Preview form" className="rounded-lg p-2 text-slate-600 hover:bg-slate-100" onClick={() => setPreview(true)}><Eye size={20} /></button><button className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-white" style={{ background: formThemes[theme].accent }} onClick={() => void publish()}><Send size={17} /> {publishedForm ? "Copy form link" : "Publish"}</button></header><nav className="flex justify-center gap-1 border-b border-slate-200 bg-white px-4"><FormTab active={tab === "questions"} label="Questions" onClick={() => setTab("questions")} /><FormTab active={tab === "responses"} label={publishedForm ? "Responses" : "Responses"} onClick={() => { setTab("responses"); if (!publishedForm) void publish(); }} /><FormTab active={tab === "settings"} label="Settings" onClick={() => setTab("settings")} /></nav><main className="min-h-0 flex-1 overflow-auto">{tab === "questions" && <FormComposer description={typeof content.description === "string" ? content.description : ""} questions={questions} theme={theme} title={typeof content.title === "string" ? content.title : ""} onChange={(form) => setContent({ ...content, ...form, theme })} />}{tab === "responses" && <FormResponsesPanel publishedForm={publishedForm} query={responsesQuery} theme={theme} />}{tab === "settings" && <FormSettingsPanel settings={settings} theme={theme} onSettingsChange={updateSettings} onThemeChange={(nextTheme) => setContent({ ...content, theme: nextTheme })} />}</main></div>;
}

function FormTab({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return <button className={`border-b-2 px-5 py-4 text-sm font-semibold ${active ? "border-violet-600 text-violet-700" : "border-transparent text-slate-500 hover:text-slate-800"}`} onClick={onClick} type="button">{label}</button>;
}

function FormResponsesPanel({ publishedForm, query, theme }: { publishedForm: PublishedForm | null; query: UseQueryResult<FormResponse[], Error>; theme: FormTheme }) {
  const responses = Array.isArray(query.data) ? query.data : [];
  return <div className="min-h-full p-5 md:p-9" style={{ background: formThemes[theme].background }}><section className="mx-auto max-w-4xl rounded-xl border border-slate-200 bg-white shadow-sm"><header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-6"><div><h2 className="text-2xl font-semibold text-slate-900">{publishedForm ? `${responses.length} response${responses.length === 1 ? "" : "s"}` : "Publish to collect responses"}</h2><p className="mt-1 text-sm text-slate-500">Responses are private to this Zo Drive form.</p></div>{publishedForm && <button className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50" onClick={() => void copyText(formLink(publishedForm.shortCode), "Form link copied")}>Copy form link</button>}</header>{query.isPending ? <div className="p-10 text-center text-sm text-slate-500">Loading responses…</div> : responses.length === 0 ? <div className="p-12 text-center text-sm text-slate-500">No responses yet. Share the published link to start collecting them.</div> : <div className="divide-y divide-slate-100">{responses.map((response) => <article className="p-5" key={response.id}><p className="text-xs font-medium text-slate-400">{new Date(response.submittedAt).toLocaleString()}</p><dl className="mt-3 grid gap-2 text-sm">{Object.entries(response.answers).map(([questionId, answer]) => <div className="grid grid-cols-[9rem_minmax(0,1fr)] gap-3" key={questionId}><dt className="truncate text-slate-400">{questionId}</dt><dd className="break-words text-slate-700">{Array.isArray(answer) ? answer.join(", ") : answer}</dd></div>)}</dl></article>)}</div>}</section></div>;
}

function LegacyFormSettingsPanel({ settings, theme, onSettingsChange, onThemeChange }: { settings: { acceptingResponses: boolean; confirmationMessage: string; showProgressBar: boolean }; theme: FormTheme; onSettingsChange: (change: Partial<{ acceptingResponses: boolean; confirmationMessage: string; showProgressBar: boolean }>) => void; onThemeChange: (theme: FormTheme) => void }) {
  return <div className="min-h-full p-5 md:p-9" style={{ background: formThemes[theme].background }}><div className="mx-auto grid max-w-4xl gap-5"><section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="text-xl font-semibold text-slate-900">Response settings</h2><label className="mt-6 flex items-center justify-between gap-6 text-sm font-medium text-slate-700">Accepting responses<input aria-label="Accepting responses" className="size-5" style={{ accentColor: formThemes[theme].accent }} type="checkbox" checked={settings.acceptingResponses} onChange={(event) => onSettingsChange({ acceptingResponses: event.target.checked })} /></label><label className="mt-6 block text-sm font-medium text-slate-700">Confirmation message<textarea aria-label="Confirmation message" className="mt-2 min-h-24 w-full rounded-lg border border-slate-300 p-3 text-sm font-normal outline-none" value={settings.confirmationMessage} onChange={(event) => onSettingsChange({ confirmationMessage: event.target.value })} /></label><label className="mt-6 flex items-center justify-between gap-6 text-sm font-medium text-slate-700">Show a completion progress bar<input aria-label="Show progress bar" className="size-5" style={{ accentColor: formThemes[theme].accent }} type="checkbox" checked={settings.showProgressBar} onChange={(event) => onSettingsChange({ showProgressBar: event.target.checked })} /></label></section><section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="text-xl font-semibold text-slate-900">Theme</h2><p className="mt-1 text-sm text-slate-500">Applies to the editor, preview, and public form.</p><div className="mt-5 flex flex-wrap gap-3">{(Object.keys(formThemes) as FormTheme[]).map((name) => <button aria-label={`${formThemes[name].name} theme`} className={`grid size-12 place-items-center rounded-full border-4 ${name === theme ? "border-slate-900" : "border-white"}`} key={name} style={{ background: formThemes[name].accent }} onClick={() => onThemeChange(name)} type="button">{name === theme && <span className="text-lg text-white">✓</span>}</button>)}</div></section></div></div>;
}

function FormSettingsPanel({ settings, theme, onSettingsChange, onThemeChange }: { settings: { acceptingResponses: boolean; confirmationMessage: string; showProgressBar: boolean }; theme: FormTheme; onSettingsChange: (change: Partial<{ acceptingResponses: boolean; confirmationMessage: string; showProgressBar: boolean }>) => void; onThemeChange: (theme: FormTheme) => void }) {
  const accent = formThemes[theme].accent;
  const toggleClass = "size-5 cursor-pointer rounded border-slate-300";
  return <div className="min-h-full p-5 md:p-9" style={{ background: formThemes[theme].background }}><div className="mx-auto grid max-w-5xl gap-5 lg:grid-cols-[minmax(0,1fr)_19rem]"><div className="space-y-5"><section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"><header className="border-b border-slate-100 px-6 py-5"><p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Responses</p><h2 className="mt-1 text-xl font-semibold text-slate-900">Response collection</h2><p className="mt-1 text-sm text-slate-500">Control when people can submit and what they see afterwards.</p></header><div className="divide-y divide-slate-100 px-6"><label className="flex items-center justify-between gap-6 py-5 text-sm font-medium text-slate-700"><span><span className="block">Accepting responses</span><span className="mt-1 block text-xs font-normal text-slate-500">Turn this off to close the published form.</span></span><input aria-label="Accepting responses" className={toggleClass} style={{ accentColor: accent }} type="checkbox" checked={settings.acceptingResponses} onChange={(event) => onSettingsChange({ acceptingResponses: event.target.checked })} /></label><label className="block py-5 text-sm font-medium text-slate-700">Confirmation message<textarea aria-label="Confirmation message" className="mt-2 min-h-24 w-full rounded-lg border border-slate-300 p-3 text-sm font-normal outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100" value={settings.confirmationMessage} onChange={(event) => onSettingsChange({ confirmationMessage: event.target.value })} /></label></div></section><section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"><header className="border-b border-slate-100 px-6 py-5"><p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Presentation</p><h2 className="mt-1 text-xl font-semibold text-slate-900">Respondent experience</h2></header><label className="flex items-center justify-between gap-6 px-6 py-5 text-sm font-medium text-slate-700"><span><span className="block">Show progress bar</span><span className="mt-1 block text-xs font-normal text-slate-500">Shows completion progress while a respondent fills in the form.</span></span><input aria-label="Show progress bar" className={toggleClass} style={{ accentColor: accent }} type="checkbox" checked={settings.showProgressBar} onChange={(event) => onSettingsChange({ showProgressBar: event.target.checked })} /></label></section></div><aside className="h-fit overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"><header className="border-b border-slate-100 px-5 py-5"><p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Theme</p><h2 className="mt-1 text-xl font-semibold text-slate-900">Style your form</h2><p className="mt-1 text-sm text-slate-500">Applied to editing, preview, and the published form.</p></header><div className="space-y-5 p-5"><div><p className="text-sm font-semibold text-slate-700">Header image</p><div className="mt-3 grid gap-3"><button aria-label="Botanical header image" className={`overflow-hidden rounded-lg border-2 text-left transition ${theme === "ocean" ? "border-slate-900 ring-2 ring-slate-200" : "border-slate-200 hover:border-slate-400"}`} onClick={() => onThemeChange("ocean")} type="button"><img alt="Botanical form banner" className="h-20 w-full object-cover" src={`${appBasePath || ""}/form-banners/botanical.png`} /><span className="block px-3 py-2 text-xs font-semibold text-slate-700">Botanical</span></button><button aria-label="Fireworks header image" className={`overflow-hidden rounded-lg border-2 text-left transition ${theme === "violet" ? "border-slate-900 ring-2 ring-slate-200" : "border-slate-200 hover:border-slate-400"}`} onClick={() => onThemeChange("violet")} type="button"><img alt="Fireworks form banner" className="h-20 w-full object-cover" src={`${appBasePath || ""}/form-banners/fireworks.png`} /><span className="block px-3 py-2 text-xs font-semibold text-slate-700">Fireworks</span></button></div></div><div><p className="text-sm font-semibold text-slate-700">Colour</p><div className="mt-3 flex flex-wrap gap-2">{(Object.keys(formThemes) as FormTheme[]).map((name) => <button aria-label={`${formThemes[name].name} theme`} className={`grid size-10 place-items-center rounded-full border-4 ${name === theme ? "border-slate-900" : "border-white shadow-sm"}`} key={name} style={{ background: formThemes[name].accent }} onClick={() => onThemeChange(name)} type="button">{name === theme && <span className="text-sm text-white">✓</span>}</button>)}</div></div><p className="rounded-lg bg-slate-50 p-3 text-xs leading-5 text-slate-500">Choose a header image to use its paired colour palette. Choose another colour to return to a clean, image-free header.</p></div></aside></div></div>;
}

function formBannerForTheme(theme: FormTheme): "none" | "botanical" | "fireworks" {
  return theme === "ocean" ? "botanical" : theme === "violet" ? "fireworks" : "none";
}

function FormPreview({ content, fileName, onClose }: { content: NativeFileContent; fileName: string; onClose: () => void }) {
  const theme = formTheme(content.theme);
  const questions = parseFormQuestions(content.questions);
  return <div className="fixed inset-0 z-[60] flex flex-col bg-slate-50"><header className="flex min-h-16 items-center gap-3 border-b border-slate-200 bg-white px-4"><button aria-label="Exit preview" className="rounded-lg p-2 text-slate-600 hover:bg-slate-100" onClick={onClose}><ArrowLeft size={21} /></button><p className="font-semibold text-slate-800">Preview mode</p><span className="ml-auto text-sm text-slate-500">{fileName}</span></header><main className="min-h-0 flex-1 overflow-auto px-4 py-8" style={{ background: formThemes[theme].background }}><div className="mx-auto max-w-2xl space-y-4"><section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"><FormBanner banner={formBannerForTheme(theme)} className="h-48 md:h-60" /><div className="h-2" style={{ background: formThemes[theme].accent }} /><div className="p-6"><h1 className="text-3xl font-semibold text-slate-900">{typeof content.title === "string" ? content.title : "Untitled form"}</h1><p className="mt-3 text-sm text-slate-600">{typeof content.description === "string" ? content.description : ""}</p></div></section>{questions.map((question) => <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm" key={question.id}><p className="font-medium text-slate-900">{question.title || "Untitled question"}{question.required && <span className="ml-1 text-red-600">*</span>}</p><p className="mt-4 text-sm text-slate-400">{question.type.replaceAll("-", " ")}</p></section>)}</div></main></div>;
}

function NativeEditor({ content: initialContent, fileName: initialFileName, onClose, onListResponses, onPublish, onRename, onSave, onShare }: { content: NativeFileContent; fileName: string; onClose: () => void; onListResponses: (id: string) => Promise<FormResponse[]>; onPublish: () => Promise<PublishedForm>; onRename: (name: string) => Promise<void>; onSave: (content: NativeFileContent) => Promise<void>; onShare: (settings?: PasteShareSettings) => void }) {
  const [content, setContent] = useState(initialContent);
  const [activeSlide, setActiveSlide] = useState(0);
  const [fileName, setFileName] = useState(initialFileName);
  const [saveState, setSaveState] = useState<"error" | "saved" | "saving">("saved");
  const [renaming, setRenaming] = useState(false);
  const [publishedForm, setPublishedForm] = useState<PublishedForm | null>(null);
  const [pasteShareSettings, setPasteShareSettings] = useState<PasteShareSettings>({ access: "public", editable: false, passcode: "", ttl: "never" });
  const savedContent = useRef(JSON.stringify(initialContent));
  const saveGeneration = useRef(0);
  const saveTimer = useRef<number | null>(null);
  const renameTimer = useRef<number | null>(null);
  const type = content.type;

  if (initialContent.type === "form") return <FormNativeEditor initialContent={initialContent} initialFileName={initialFileName} onClose={onClose} onListResponses={onListResponses} onPublish={onPublish} onRename={onRename} onSave={onSave} />;

  async function saveNow() {
    if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
    const nextContent = content;
    const signature = JSON.stringify(nextContent);
    if (signature === savedContent.current) return;
    const generation = ++saveGeneration.current;
    setSaveState("saving");
    try {
      await onSave(nextContent);
      if (generation === saveGeneration.current) {
        savedContent.current = signature;
        setSaveState("saved");
      }
    } catch {
      if (generation === saveGeneration.current) setSaveState("error");
      throw new Error("Could not save");
    }
  }

  async function renameNow() {
    if (renameTimer.current !== null) window.clearTimeout(renameTimer.current);
    const nextName = fileName.trim();
    if (!nextName || nextName === initialFileName) return;
    setRenaming(true);
    try {
      await onRename(nextName);
    } finally {
      setRenaming(false);
    }
  }

  useEffect(() => {
    const signature = JSON.stringify(content);
    if (signature === savedContent.current) return;
    const generation = ++saveGeneration.current;
    setSaveState("saving");
    saveTimer.current = window.setTimeout(() => {
      void onSave(content).then(() => {
        if (generation === saveGeneration.current) {
          savedContent.current = signature;
          setSaveState("saved");
        }
      }).catch(() => {
        if (generation === saveGeneration.current) setSaveState("error");
      });
    }, 700);
    return () => { if (saveTimer.current !== null) window.clearTimeout(saveTimer.current); };
  }, [content]);

  useEffect(() => {
    if (fileName.trim() === initialFileName) return;
    renameTimer.current = window.setTimeout(() => { void renameNow(); }, 700);
    return () => { if (renameTimer.current !== null) window.clearTimeout(renameTimer.current); };
  }, [fileName]);

  async function sharePaste() {
    if (pasteShareSettings.access === "passcode" && !pasteShareSettings.passcode) {
      toast.error("Enter a passcode before creating a protected paste link");
      return;
    }
    await saveNow();
    onShare(pasteShareSettings);
  }

  async function publishForm() {
    try {
      await saveNow();
      const form = await onPublish();
      setPublishedForm(form);
      await copyText(formLink(form.id), "Form link copied");
      toast.success("Form published");
    } catch {
      toast.error("Could not publish the form");
    }
  }

  async function closeEditor() {
    try {
      await saveNow();
      await renameNow();
      onClose();
    } catch {
      toast.error("Could not save the latest changes");
    }
  }

  let editor: React.ReactNode;
  if (type === "document") {
    const blocks = Array.isArray(content.blocks) ? content.blocks.filter((block): block is string => typeof block === "string") : [];
    editor = <DocumentComposer blocks={blocks} html={typeof content.html === "string" ? content.html : ""} onChange={({ blocks: nextBlocks, html }) => setContent({ ...content, blocks: nextBlocks, html })} />;
  } else if (type === "spreadsheet") {
    const sheets = Array.isArray(content.sheets) ? content.sheets : [];
    const sheet = sheets[0] && typeof sheets[0] === "object" && sheets[0] !== null ? sheets[0] as Record<string, unknown> : { name: "Sheet 1", cells: {} };
    const cells = sheet.cells && typeof sheet.cells === "object" && !Array.isArray(sheet.cells) ? sheet.cells as Record<string, string> : {};
    editor = <SpreadsheetComposer cells={cells} onChange={(nextCells) => setContent({ ...content, sheets: [{ ...sheet, cells: nextCells }, ...sheets.slice(1)] })} />;
  } else if (type === "presentation") {
    const slides = Array.isArray(content.slides) ? content.slides.filter((slide): slide is Record<string, unknown> => typeof slide === "object" && slide !== null) : [];
    const currentIndex = Math.min(activeSlide, Math.max(0, slides.length - 1));
    const slide = slides[currentIndex] ?? { title: "Untitled slide", body: "" };
    const updateSlide = (change: Record<string, unknown>) => setContent({ ...content, slides: slides.map((item, index) => index === currentIndex ? { ...item, ...change } : item) });
    editor = <PresentationComposer activeSlide={currentIndex} onAdd={() => { setContent({ ...content, slides: [...slides, { title: `Slide ${slides.length + 1}`, body: "", theme: "ocean" }] }); setActiveSlide(slides.length); }} onSelect={setActiveSlide} onUpdate={updateSlide} slide={slide} slides={slides} />;
  } else if (type === "paste") {
    const tags = Array.isArray(content.tags) ? content.tags.filter((tag): tag is string => typeof tag === "string") : [];
    editor = <PasteComposer language={typeof content.language === "string" && pasteLanguages.includes(content.language) ? content.language : "plaintext"} settings={pasteShareSettings} tags={tags} text={typeof content.text === "string" ? content.text : ""} onChange={(paste) => setContent({ ...content, ...paste })} onSettingsChange={setPasteShareSettings} />;
  } else {
    const questions = parseFormQuestions(content.questions);
    const theme = formTheme(content.theme);
    editor = <div style={{ background: formThemes[theme].background }}><div className="mx-auto flex max-w-3xl items-center justify-end gap-2 px-4 pt-5 md:px-8"><Palette size={16} className="text-slate-500" /><label className="text-sm font-medium text-slate-600">Theme <select aria-label="Form theme" className="ml-1 rounded-md border border-slate-300 bg-white px-2 py-1.5" value={theme} onChange={(event) => setContent({ ...content, theme: event.target.value })}>{Object.entries(formThemes).map(([name, option]) => <option key={name} value={name}>{option.name}</option>)}</select></label></div><FormComposer description={typeof content.description === "string" ? content.description : ""} questions={questions} title={typeof content.title === "string" ? content.title : ""} onChange={(form) => setContent({ ...content, ...form, theme })} />{publishedForm && <section className="mx-auto max-w-3xl border-t border-slate-200 bg-white px-4 pb-6 md:px-8"><p className="pt-5 text-sm font-semibold text-slate-800">Published form link</p><div className="mt-2 flex gap-2"><input aria-label="Published form link" className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-700" value={formLink(publishedForm.id)} readOnly /><button aria-label="Copy published form link" className="rounded-lg border border-slate-300 px-3 text-slate-600 hover:bg-slate-50" onClick={() => void copyText(formLink(publishedForm.id), "Form link copied")}><Copy size={17} /></button></div></section>}</div>;
  }

  const status = renaming || saveState === "saving" ? "Saving…" : saveState === "error" ? "Changes not saved" : "All changes saved";
  return <div className="fixed inset-0 z-50 flex flex-col bg-slate-100" role="dialog" aria-modal="true" aria-label={`Edit Zo ${nativeFileLabel(type)}`}><header className="flex min-h-16 items-center gap-3 border-b border-slate-200 bg-white px-4 md:px-6"><button aria-label="Close editor" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" onClick={() => void closeEditor()}><X size={20} /></button><p className="text-sm font-medium text-slate-500">Zo {nativeFileLabel(type)} · private</p><div className="ml-auto flex min-w-0 items-center gap-3"><span aria-live="polite" className={`hidden shrink-0 text-xs font-medium sm:block ${saveState === "error" ? "text-red-600" : "text-slate-400"}`}>{status}</span><div className="min-w-0"><label className="sr-only" htmlFor="native-file-name">File name</label><input id="native-file-name" aria-label="File name" className="w-40 border-0 border-b border-transparent bg-transparent py-1 text-right text-sm font-semibold text-slate-800 outline-none placeholder:text-slate-400 focus:border-blue-500 md:w-56" value={fileName} onChange={(event) => setFileName(event.target.value)} /></div>{type === "form" && <button className="flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-white" style={{ background: formThemes[formTheme(content.theme)].accent }} onClick={() => void publishForm()}><Send size={17} /> {publishedForm ? "Copy form link" : "Publish"}</button>}{type === "paste" && <button className="flex shrink-0 items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700" onClick={() => void sharePaste()}><Share2 size={17} /> Share paste</button>}</div></header><main className="min-h-0 flex-1 overflow-auto">{editor}</main></div>;
}

function visibleFiles(objects: DriveObject[], currentPath: string) {
  const prefix = currentPath ? `${currentPath}/` : "";
  const files: DriveObject[] = [];
  for (const object of objects) {
    if (!object.key.startsWith(prefix)) continue;
    const remainder = object.key.slice(prefix.length);
    const separator = remainder.indexOf("/");
    if (separator < 0) files.push(object);
  }
  return files;
}

function fileIcon(contentType: string) {
  if (contentType.startsWith("image/")) return <FileImage size={20} />;
  if (contentType.startsWith("audio/")) return <FileAudio size={20} />;
  if (contentType === "application/pdf" || contentType.startsWith("text/")) return <FileText size={20} />;
  return <File size={20} />;
}

function nativeFileLabel(type: NativeFileType): string {
  return { document: "Document", spreadsheet: "Spreadsheet", presentation: "Presentation", form: "Form", paste: "Paste" }[type];
}

function parseNativeFileContent(value: string, expectedType: NativeFileType): NativeFileContent {
  const parsed: unknown = JSON.parse(value);
  if (!parsed || typeof parsed !== "object") throw new Error("This Zo-native file is invalid");
  const content = parsed as Partial<NativeFileContent>;
  if (content.format !== "zo-native" || content.type !== expectedType || content.version !== 1) {
    throw new Error("This Zo-native file has an unsupported format");
  }
  return content as NativeFileContent;
}

function parsePasteContent(value: string): { language: string; tags: string[]; text: string } {
  const parsed: unknown = JSON.parse(value);
  if (!parsed || typeof parsed !== "object") throw new Error("Invalid paste");
  const content = parsed as { format?: unknown; language?: unknown; tags?: unknown; text?: unknown; type?: unknown; version?: unknown };
  if (content.format !== "zo-native" || content.type !== "paste" || content.version !== 1 || typeof content.text !== "string") throw new Error("Invalid paste");
  return {
    language: typeof content.language === "string" ? content.language : "plaintext",
    tags: Array.isArray(content.tags) ? content.tags.filter((tag): tag is string => typeof tag === "string") : [],
    text: content.text
  };
}

const presentationThemes = {
  ocean: { background: "linear-gradient(135deg, #082f49, #0e7490)", foreground: "#ecfeff" },
  ember: { background: "linear-gradient(135deg, #431407, #c2410c)", foreground: "#fff7ed" },
  plum: { background: "linear-gradient(135deg, #3b0764, #7e22ce)", foreground: "#faf5ff" },
  paper: { background: "#fffdf7", foreground: "#1c1917" }
} as const;

function blocksToHtml(blocks: string[]): string {
  return blocks.map((block) => `<p>${escapeHtml(block)}</p>`).join("");
}

function richHtmlToBlocks(html: string): string[] {
  const element = document.createElement("div");
  element.innerHTML = sanitizeRichHtml(html);
  return (element.textContent ?? "").split(/\n{2,}/).map((block) => block.trim()).filter(Boolean);
}

function sanitizeRichHtml(html: string): string {
  const template = document.createElement("template");
  template.innerHTML = html;
  const allowed = new Set(["P", "DIV", "H1", "H2", "BLOCKQUOTE", "UL", "OL", "LI", "STRONG", "B", "EM", "I", "U", "BR", "SPAN"]);
  for (const element of [...template.content.querySelectorAll("*")]) {
    if (!allowed.has(element.tagName)) {
      element.replaceWith(...[...element.childNodes]);
      continue;
    }
    for (const attribute of [...element.attributes]) element.removeAttribute(attribute.name);
  }
  return template.innerHTML;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] ?? character);
}

function sameAdvancedFilters(left: AdvancedFilters, right: AdvancedFilters): boolean {
  return left.contentQuery === right.contentQuery && left.inTrash === right.inTrash && left.location === right.location && left.modified === right.modified && left.starred === right.starred && left.type === right.type;
}

function dateRangeFor(value: AdvancedFilters["modified"]): { after: string; before: string } | null {
  if (value === "any") return null;
  const now = new Date();
  const after = new Date(now);
  if (value === "today") after.setHours(0, 0, 0, 0);
  if (value === "week") after.setDate(after.getDate() - 7);
  if (value === "month") after.setMonth(after.getMonth() - 1);
  if (value === "year") after.setFullYear(after.getFullYear() - 1);
  return { after: after.toISOString(), before: now.toISOString() };
}

function matchesTrashSearch(item: DriveTrashItem, query: string, filters: AdvancedFilters): boolean {
  if (query && !item.name.toLowerCase().includes(query.toLowerCase())) return false;
  if (filters.starred && !item.starred) return false;
  if (filters.type !== "any" && !matchesContentTypeCategory(item.contentType, filters.type)) return false;
  const range = dateRangeFor(filters.modified);
  return !range || (item.trashedAt >= range.after && item.trashedAt <= range.before);
}

function matchesContentTypeCategory(contentType: string, type: AdvancedFileType): boolean {
  if (type === "document") return contentType === "application/vnd.zo.document+json" || contentType.startsWith("text/");
  if (type === "spreadsheet") return contentType === "application/vnd.zo.spreadsheet+json";
  if (type === "presentation") return contentType === "application/vnd.zo.presentation+json";
  if (type === "form") return contentType === "application/vnd.zo.form+json";
  if (type === "paste") return contentType === "application/vnd.zo.paste+json";
  if (type === "image") return contentType.startsWith("image/");
  if (type === "video") return contentType.startsWith("video/");
  if (type === "audio") return contentType.startsWith("audio/");
  if (type === "pdf") return contentType === "application/pdf";
  return !contentType.startsWith("text/") && !contentType.startsWith("image/") && !contentType.startsWith("video/") && !contentType.startsWith("audio/") && contentType !== "application/pdf" && !contentType.startsWith("application/vnd.zo.");
}

function isZoNativeFile(file: DriveObject): boolean {
  return Boolean(file.nativeType) || file.contentType.startsWith("application/vnd.zo.");
}

function isSharedDriveFile(file: DriveObject | SharedDriveFile): file is SharedDriveFile {
  return "mountId" in file;
}

function sharedDriveAuthor(author: string | null): string {
  return author || "the folder owner";
}

function sharedDriveRoleLabel(role: ClusterRole): string {
  return role === "editor" ? "Read & write" : "Read only";
}

function groupRecentFiles(files: Array<DriveObject | SharedDriveFile>): Array<[string, Array<DriveObject | SharedDriveFile>]> {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = new Date(todayStart);
  weekStart.setDate(todayStart.getDate() - 7);
  const lastWeekStart = new Date(todayStart);
  lastWeekStart.setDate(todayStart.getDate() - 14);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const groups = new Map<string, Array<DriveObject | SharedDriveFile>>();
  for (const file of files) {
    const updatedAt = new Date(file.updatedAt);
    const label = updatedAt >= todayStart ? "Today" : updatedAt >= weekStart ? "Earlier this week" : updatedAt >= lastWeekStart ? "Last week" : updatedAt >= monthStart ? "Earlier this month" : updatedAt.toLocaleDateString([], { month: "long", year: "numeric" });
    groups.set(label, [...(groups.get(label) ?? []), file]);
  }
  return [...groups.entries()];
}

async function copyShareLink(id: string): Promise<void> {
  await copyText(shareLink(id), "Share link copied");
}
