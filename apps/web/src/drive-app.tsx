import { QueryClient, QueryClientProvider, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Bold,
  Cloud,
  Clock3,
  Copy,
  Eye,
  EyeOff,
  File,
  FileAudio,
  FileImage,
  FileText,
  Folder,
  FolderPlus,
  FolderUp,
  Grid2X2,
  HardDrive,
  KeyRound,
  Italic,
  List,
  ListOrdered,
  LoaderCircle,
  LockKeyhole,
  LogOut,
  MoreHorizontal,
  Plus,
  Palette,
  Search,
  Sigma,
  SlidersHorizontal,
  RotateCcw,
  Share2,
  ShieldAlert,
  Star,
  Trash2,
  Upload,
  Underline,
  UserRound,
  UsersRound,
  X
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { toast, Toaster } from "sonner";
import { create } from "zustand";

import { ZoDriveClient } from "@zo-drive/sdk";
import type { AuthStatus, DriveFolder, DriveObject, DriveShare, DriveTrashItem, DriveUser, NativeFileType, PublicShare, ShareAccess, StorageUsage } from "@zo-drive/types";

type DriveClient = Pick<ZoDriveClient, "createFolder" | "createNativeFile" | "createShare" | "delete" | "download" | "emptyTrash" | "getUsage" | "list" | "listFolders" | "listShares" | "listStarred" | "listTrash" | "permanentlyDeleteTrash" | "restoreTrash" | "revokeShare" | "saveNativeFile" | "star" | "unstar" | "updateSharePasscode" | "upload">;
type AuthClient = Pick<ZoDriveClient, "changePassword" | "deleteAccount" | "getAuthStatus" | "login" | "logout" | "registerInitialUser" | "updateProfile">;
type SharedClient = Pick<ZoDriveClient, "downloadShared" | "getPublicShare">;
type ViewMode = "grid" | "list";
type AdvancedFileType = "document" | "spreadsheet" | "presentation" | "form" | "image" | "video" | "audio" | "pdf" | "other";
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

type UploadTask = {
  id: string;
  loaded: number;
  name: string;
  size: number;
  startedAt: number;
};

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
  const shareId = new URLSearchParams(window.location.search).get("share");

  return (
    <QueryClientProvider client={queryClient}>
      {shareId ? <SharedFilePage client={defaultClient} shareId={shareId} /> : <DriveGate client={driveClient} authClient={sessionClient} />}
      <Toaster position="bottom-right" richColors />
    </QueryClientProvider>
  );
}

function DriveGate({ client, authClient }: { client: DriveClient; authClient: AuthClient }) {
  const queryClient = useQueryClient();
  const [page, setPage] = useState<"drive" | "account">("drive");
  const authQuery = useQuery({ queryKey: ["auth-status"], queryFn: () => authClient.getAuthStatus(), retry: false });
  const logoutMutation = useMutation({
    mutationFn: () => authClient.logout(),
    onSuccess: async () => {
      useDriveUi.getState().setCurrentPath("");
      setPage("drive");
      await queryClient.invalidateQueries();
      toast.success("Signed out");
    },
    onError: () => toast.error("Could not sign out")
  });

  if (authQuery.isPending) return <AuthLoading />;
  if (authQuery.isError || !authQuery.data) return <AuthUnavailable onRetry={() => void authQuery.refetch()} />;
  if (!authQuery.data.authenticated || !authQuery.data.user) {
    return <AuthScreen auth={authQuery.data} client={authClient} onAuthenticated={() => void authQuery.refetch()} />;
  }
  if (page === "account") {
    return <AccountScreen user={authQuery.data.user} client={authClient} onBack={() => setPage("drive")} onAccountDeleted={() => void authQuery.refetch()} onSignOut={() => logoutMutation.mutate()} />;
  }
  return <DriveScreen client={client} user={authQuery.data.user} onAccount={() => setPage("account")} onSignOut={() => logoutMutation.mutate()} />;
}

function AuthLoading() {
  return <main className="grid min-h-screen place-items-center bg-[#f8faff] text-sm text-slate-500"><span className="flex items-center gap-2"><LoaderCircle className="animate-spin" size={18} /> Checking your private drive…</span></main>;
}

function AuthUnavailable({ onRetry }: { onRetry: () => void }) {
  return <main className="grid min-h-screen place-items-center bg-[#f8faff] p-5 text-center text-slate-700"><div><LockKeyhole className="mx-auto mb-3 text-blue-600" size={32} /><h1 className="text-xl font-semibold text-slate-900">Zo Drive is unavailable</h1><p className="mt-2 text-sm text-slate-500">We could not check your sign-in session.</p><button className="mt-5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700" onClick={onRetry}>Try again</button></div></main>;
}

function AuthScreen({ auth, client, onAuthenticated }: { auth: AuthStatus; client: AuthClient; onAuthenticated: () => void }) {
  const isBootstrap = auth.registrationAllowed;
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
        <div className="mt-8"><LockKeyhole className="mb-3 text-blue-600" size={24} /><h1 className="text-2xl font-semibold tracking-tight text-slate-900">{isBootstrap ? "Create your owner account" : "Sign in to Zo Drive"}</h1><p className="mt-2 text-sm leading-6 text-slate-500">{isBootstrap ? "No owner account exists yet. Create one to initialise this private drive. Registration closes immediately after this." : "Use the owner account for this private drive."}</p></div>
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

function AccountScreen({ user, client, onBack, onAccountDeleted, onSignOut }: { user: DriveUser; client: AuthClient; onBack: () => void; onAccountDeleted: () => void; onSignOut: () => void }) {
  const queryClient = useQueryClient();
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
    <main className="min-h-screen bg-[#f8faff] text-slate-800">
      <header className="flex h-18 items-center gap-4 border-b border-slate-200 bg-white px-5">
        <button className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100" onClick={onBack}><ArrowLeft size={18} /> Back to Drive</button>
        <div className="ml-auto flex items-center gap-2"><button className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100" onClick={onSignOut}>Sign out</button></div>
      </header>
      <section className="mx-auto max-w-3xl p-6 md:p-10">
        <div><p className="text-sm font-medium text-blue-600">Account</p><h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-900">Profile & controls</h1><p className="mt-2 text-sm text-slate-500">Manage the owner account for this private drive.</p></div>
        <div className="mt-8 space-y-5">
          <SettingsCard icon={<UserRound size={20} />} title="Profile" description="Your username is how you sign in.">
            <form className="flex flex-col gap-3 sm:flex-row" onSubmit={(event) => { event.preventDefault(); profileMutation.mutate(); }}><input aria-label="Account username" className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" minLength={3} maxLength={32} value={username} onChange={(event) => setUsername(event.target.value)} required /><button className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:bg-slate-300" disabled={profileMutation.isPending || username === user.username} type="submit">Save username</button></form>
          </SettingsCard>
          <SettingsCard icon={<KeyRound size={20} />} title="Password" description="Use a password you will remember. Minimum 6 characters.">
            <form className="grid gap-3 sm:grid-cols-2" onSubmit={(event) => { event.preventDefault(); passwordMutation.mutate(); }}><input aria-label="Current password" className="rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" type="password" minLength={6} placeholder="Current password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required /><input aria-label="New password" className="rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" type="password" minLength={6} placeholder="New password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required /><button className="w-fit rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:border-blue-300 hover:text-blue-700 disabled:text-slate-400 sm:col-span-2" disabled={passwordMutation.isPending} type="submit">Update password</button></form>
          </SettingsCard>
          <SettingsCard icon={<HardDrive size={20} />} title="Drive data" description="Your files are private and stored in this Zo Drive data root.">
            <div className="rounded-lg bg-slate-50 px-3 py-2.5 text-sm text-slate-600"><span className="font-medium text-slate-700">Account:</span> {user.username} <span className="mx-2 text-slate-300">•</span> Private owner drive</div>
          </SettingsCard>
          <SettingsCard danger icon={<ShieldAlert size={20} />} title="Danger zone" description="Permanently delete this owner account and every file in its drive.">
            <div className="rounded-lg border border-red-100 bg-red-50 p-4"><p className="text-sm leading-6 text-red-800">This cannot be undone. Type <strong>DELETE MY DRIVE</strong> and enter your current password to continue.</p><div className="mt-3 grid gap-3 sm:grid-cols-2"><input aria-label="Delete confirmation" className="rounded-lg border border-red-200 bg-white px-3 py-2.5 outline-none focus:border-red-500 focus:ring-4 focus:ring-red-100" placeholder="DELETE MY DRIVE" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /><input aria-label="Delete account password" className="rounded-lg border border-red-200 bg-white px-3 py-2.5 outline-none focus:border-red-500 focus:ring-4 focus:ring-red-100" type="password" placeholder="Current password" value={deletePassword} onChange={(event) => setDeletePassword(event.target.value)} /><button className="w-fit rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-red-200 sm:col-span-2" disabled={confirmation !== "DELETE MY DRIVE" || deletePassword.length < 6 || deleteMutation.isPending} onClick={() => deleteMutation.mutate()}>Delete account and files</button></div></div>
          </SettingsCard>
        </div>
      </section>
    </main>
  );
}

function SettingsCard({ children, description, danger = false, icon, title }: { children: React.ReactNode; description: string; danger?: boolean; icon: React.ReactNode; title: string }) {
  return <section className={`rounded-xl border bg-white p-5 shadow-sm ${danger ? "border-red-200" : "border-slate-200"}`}><div className={`flex items-start gap-3 ${danger ? "text-red-600" : "text-blue-600"}`}><span className="rounded-lg bg-current/10 p-2">{icon}</span><div><h2 className="font-semibold text-slate-900">{title}</h2><p className="mt-1 text-sm leading-5 text-slate-500">{description}</p></div></div><div className="mt-5">{children}</div></section>;
}

function DriveScreen({ client, user, onAccount, onSignOut }: { client: DriveClient; user: DriveUser; onAccount: () => void; onSignOut: () => void }) {
  const { currentPath, setCurrentPath, viewMode, setViewMode } = useDriveUi();
  const [section, setSection] = useState<"home" | "my-drive" | "shared" | "starred" | "trash">("my-drive");
  const [search, setSearch] = useState("");
  const [advancedSearchOpen, setAdvancedSearchOpen] = useState(false);
  const [advancedFilters, setAdvancedFilters] = useState<AdvancedFilters>(defaultAdvancedFilters);
  const [appliedAdvancedFilters, setAppliedAdvancedFilters] = useState<AdvancedFilters>(defaultAdvancedFilters);
  const [recentFilters, setRecentFilters] = useState<RecentFilters>(defaultRecentFilters);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [newMenuOpen, setNewMenuOpen] = useState(false);
  const [folderDialogOpen, setFolderDialogOpen] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [nativeFileType, setNativeFileType] = useState<NativeFileType | null>(null);
  const [nativeFileName, setNativeFileName] = useState("");
  const [shareFile, setShareFile] = useState<DriveObject | null>(null);
  const [passcodeShare, setPasscodeShare] = useState<DriveShare | null>(null);
  const [preview, setPreview] = useState<{ object: DriveObject; url: string } | null>(null);
  const [nativeEditor, setNativeEditor] = useState<{ content: NativeFileContent; object: DriveObject } | null>(null);
  const [uploads, setUploads] = useState<UploadTask[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const advancedSearchActive = !sameAdvancedFilters(appliedAdvancedFilters, defaultAdvancedFilters);
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
      type: isRecent ? recentFilters.type === "any" ? undefined : recentFilters.type : appliedAdvancedFilters.type === "any" ? undefined : appliedAdvancedFilters.type,
      starred: isRecent ? undefined : appliedAdvancedFilters.starred || undefined,
      modifiedAfter: isRecent ? recentDateRange?.after : advancedDateRange?.after,
      modifiedBefore: isRecent ? recentDateRange?.before : advancedDateRange?.before
    }),
    enabled: section !== "shared" && section !== "starred" && section !== "trash"
  });
  const foldersQuery = useQuery({
    queryKey: ["folders", currentPath],
    queryFn: () => client.listFolders(currentPath || undefined),
    enabled: section === "my-drive"
  });
  const sharesQuery = useQuery({ queryKey: ["shares"], queryFn: () => client.listShares(), enabled: section === "shared" });
  const starredQuery = useQuery({ queryKey: ["stars"], queryFn: () => client.listStarred(), enabled: section === "starred" });
  const trashQuery = useQuery({ queryKey: ["trash"], queryFn: () => client.listTrash(), enabled: section === "trash" });
  const usageQuery = useQuery({ queryKey: ["usage"], queryFn: () => client.getUsage() });

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["objects"] }),
      queryClient.invalidateQueries({ queryKey: ["folders"] }),
      queryClient.invalidateQueries({ queryKey: ["stars"] }),
      queryClient.invalidateQueries({ queryKey: ["trash"] }),
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
  const starredFiles = (starredQuery.data ?? []).filter((file) => !search || file.name.toLowerCase().includes(search.toLowerCase()));
  const trashItems = (trashQuery.data ?? []).filter((item) => matchesTrashSearch(item, search, appliedAdvancedFilters));
  const displayedFiles = section === "home" ? recentFiles : section === "starred" ? starredFiles : files;
  const folders = search || advancedSearchActive ? [] : foldersQuery.data ?? [];
  const isLoading = section === "shared" ? sharesQuery.isPending || usageQuery.isPending : section === "starred" ? starredQuery.isPending || usageQuery.isPending : section === "trash" ? trashQuery.isPending || usageQuery.isPending : filesQuery.isPending || (section === "my-drive" && foldersQuery.isPending) || usageQuery.isPending;
  const loadError = filesQuery.error ?? foldersQuery.error ?? sharesQuery.error ?? starredQuery.error ?? trashQuery.error ?? usageQuery.error;

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
      await client.saveNativeFile(nativeEditor.object.key, content);
      await refresh();
      setNativeEditor(null);
      toast.success("Saved to Zo Drive");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save the Zo-native file");
      throw error;
    }
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

  function startNativeFile(type: NativeFileType) {
    setNewMenuOpen(false);
    setNativeFileType(type);
    setNativeFileName(`Untitled ${nativeFileLabel(type).toLowerCase()}`);
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
    void uploadFiles(event.dataTransfer.files);
  }

  return (
    <main className="min-h-screen bg-[#f8faff] text-slate-800" onDragOver={(event) => event.preventDefault()} onDrop={handleDrop}>
      <header className="flex h-18 items-center gap-5 border-b border-slate-200 bg-white px-5">
        <div className="flex items-center gap-2.5 text-xl font-semibold tracking-tight text-slate-900">
          <span className="relative block h-11 w-11 shrink-0" role="img" aria-label="Zo Drive Pegasus on a cloud">
            <img className="absolute inset-0 h-full w-full" src={driveCloudLogoUrl} alt="" />
            <img className="absolute left-[5.94%] top-0 h-[88.44%] w-[88.44%]" src={drivePegasusLogoUrl} alt="" />
          </span>
          Zo Drive
        </div>
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
        <button aria-label="Advanced search" className={`rounded-lg p-2 transition ${advancedSearchActive ? "bg-blue-50 text-blue-700" : "text-slate-500 hover:bg-slate-100 hover:text-slate-800"}`} onClick={() => { setAdvancedFilters(appliedAdvancedFilters); setAdvancedSearchOpen(true); }}><SlidersHorizontal size={21} /></button>
        <div className="flex items-center text-sm font-medium text-slate-500">
          <div className="relative">
            <button title="Account menu" aria-label="Account menu" aria-expanded={accountMenuOpen} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800" onClick={() => setAccountMenuOpen((open) => !open)}><MoreHorizontal size={21} /></button>
            {accountMenuOpen && <div className="absolute right-0 top-11 z-20 w-52 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg">
              <p className="truncate px-3 py-2 text-xs font-medium text-slate-400">{user.username}</p>
              <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-100" onClick={() => { setAccountMenuOpen(false); onAccount(); }}><UserRound size={17} /> Profile & controls</button>
              <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-100" onClick={onSignOut}><LogOut size={17} /> Sign out</button>
            </div>}
          </div>
        </div>
      </header>

      <div className="flex min-h-[calc(100vh-4.5rem)]">
        <aside className="w-64 shrink-0 border-r border-slate-200 bg-white px-3 py-5">
          <div className="relative">
            <button aria-expanded={newMenuOpen} className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-3 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700" onClick={() => setNewMenuOpen((open) => !open)}>
              <Plus size={18} /> New
            </button>
            {newMenuOpen && <div className="absolute left-0 top-[calc(100%+0.5rem)] z-30 w-full overflow-hidden rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl">
              <button className="new-menu-item" onClick={() => { setNewMenuOpen(false); fileInput.current?.click(); }}><Upload size={17} /> File upload</button>
              <button className="new-menu-item" onClick={() => { setNewMenuOpen(false); folderInput.current?.click(); }}><FolderUp size={17} /> Folder upload</button>
              <button className="new-menu-item" onClick={() => { setNewMenuOpen(false); setFolderDialogOpen(true); }}><FolderPlus size={17} /> New folder</button>
              <div className="my-1 border-t border-slate-100" />
              {(["document", "spreadsheet", "presentation", "form"] as NativeFileType[]).map((type) => <button aria-label={`New Zo ${nativeFileLabel(type)}`} className="new-menu-item new-menu-native-item" key={type} onClick={() => startNativeFile(type)}><img className="size-9 shrink-0 rounded-md" src={nativeIllustrationUrl(type)} alt={`${nativeFileLabel(type)} illustration`} /><span>New Zo {nativeFileLabel(type)}</span></button>)}
            </div>}
          </div>
          <input ref={fileInput} aria-label="Upload files" className="hidden" type="file" multiple onChange={handleFileInput} />
          <input ref={folderInput} aria-label="Upload folder" className="hidden" type="file" multiple {...{ webkitdirectory: "" }} onChange={handleFolderInput} />

          <nav className="mt-6 space-y-1">
            <button className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-semibold ${section === "home" ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-50"}`} onClick={() => { setSection("home"); setCurrentPath(""); }}><Clock3 size={18} /> Recent</button>
            <button className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-semibold ${section === "my-drive" ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-50"}`} onClick={() => { setSection("my-drive"); setCurrentPath(""); }}><HardDrive size={18} /> My Drive</button>
            <button className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-semibold ${section === "starred" ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-50"}`} onClick={() => { setSection("starred"); setCurrentPath(""); }}><Star size={18} /> Starred</button>
            <button className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-semibold ${section === "shared" ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-50"}`} onClick={() => setSection("shared")}><UsersRound size={18} /> Shared with others</button>
            <button className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-semibold ${section === "trash" ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-50"}`} onClick={() => { setSection("trash"); setCurrentPath(""); }}><Trash2 size={18} /> Trash</button>
          </nav>

          <UsageCard usage={usageQuery.data} />
        </aside>

        <section className="min-w-0 flex-1 p-6 md:p-9">
          <div className="mb-7 flex flex-wrap items-center justify-between gap-4">
            <div>
              {section === "my-drive" && currentPath && <FolderNavigation currentPath={currentPath} onNavigate={setCurrentPath} />}
              <h1 className={`${section === "my-drive" && currentPath ? "mt-3" : ""} text-2xl font-semibold tracking-tight text-slate-900`}>{search || advancedSearchActive ? "Search results" : section === "home" ? "Recent" : section === "shared" ? "Shared with others" : section === "starred" ? "Starred" : section === "trash" ? "Trash" : currentPath ? currentPath.split("/").at(-1) : "Files"}</h1>
              {section === "home" && <p className="mt-1 text-sm text-slate-500">Files you recently created, uploaded, or updated.</p>}
              {section === "shared" && <p className="mt-1 text-sm text-slate-500">Manage links you have shared outside your drive.</p>}
              {section === "trash" && <p className="mt-1 text-sm text-slate-500">Items are permanently deleted 30 days after being moved here.</p>}
            </div>
            {section === "trash" && trashItems.length > 0 ? <button className="rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50" onClick={() => void emptyTrash()}>Empty trash</button> : section !== "home" && <div className="flex rounded-lg border border-slate-200 bg-white p-1">
              <button aria-label="List view" className={`rounded-md p-2 ${viewMode === "list" ? "bg-slate-100 text-slate-900" : "text-slate-400"}`} onClick={() => setViewMode("list")}><List size={18} /></button>
              <button aria-label="Grid view" className={`rounded-md p-2 ${viewMode === "grid" ? "bg-slate-100 text-slate-900" : "text-slate-400"}`} onClick={() => setViewMode("grid")}><Grid2X2 size={18} /></button>
            </div>}
          </div>

          {section === "home" && <RecentFiltersBar filters={recentFilters} onChange={setRecentFilters} />}

          {isLoading ? (
            <div className="grid h-64 place-items-center text-sm text-slate-500"><LoaderCircle className="mr-2 animate-spin" size={20} /> Loading your drive…</div>
          ) : (section === "shared" ? sharesQuery.isError : section === "starred" ? starredQuery.isError : section === "trash" ? trashQuery.isError : filesQuery.isError) ? (
            <EmptyState
              title="We couldn't load your drive"
              description={loadError instanceof Error ? loadError.message : "Check that the Drive API is running, then try again."}
              action="Try again"
              onAction={() => void filesQuery.refetch()}
            />
          ) : section === "shared" ? (
            <SharedLinks shares={sharesQuery.data ?? []} onCopy={(share) => void copyShareLink(share.id)} onChangePasscode={setPasscodeShare} onPreview={(share) => void openPreview({ key: share.key, name: share.name, size: share.size, contentType: share.contentType, updatedAt: share.createdAt, starred: false })} onRevoke={(id) => client.revokeShare(id).then(() => sharesQuery.refetch())} />
          ) : section === "trash" ? trashItems.length === 0 ? (
            <EmptyState title="Trash is empty" description="Files you move here stay for 30 days before they are permanently deleted." action="Go to My Drive" onAction={() => setSection("my-drive")} />
          ) : (
            <TrashEntries items={trashItems} onRestore={(id) => void restoreTrashItem(id)} onPermanentlyDelete={(item) => void permanentlyDeleteTrashItem(item)} />
          ) : (section === "my-drive" ? folders.length === 0 && files.length === 0 : displayedFiles.length === 0) ? (
            <EmptyState title={search ? "No matching files" : section === "home" ? "No recent files" : section === "starred" ? "No starred files" : "Your drive is ready for its first file"} description={section === "home" ? "Recent uploads, changes, and Zo-native files will appear here." : section === "starred" && !search ? "Use the star next to any file to keep it here." : undefined} action={section === "starred" ? "Go to My Drive" : "Upload files"} onAction={() => section === "starred" ? setSection("my-drive") : fileInput.current?.click()} />
          ) : section === "home" ? (
            <RecentEntries files={recentFiles} onPreview={openPreview} onDelete={(key) => deleteMutation.mutate(key)} onToggleStar={(file) => starMutation.mutate({ key: file.key, starred: file.starred })} onShare={setShareFile} />
          ) : (
            <DriveEntries
              files={displayedFiles}
              folders={section === "my-drive" ? folders : []}
              viewMode={viewMode}
              onOpenFolder={(folder) => setCurrentPath(folder.key)}
              onPreview={openPreview}
              onDelete={(key) => deleteMutation.mutate(key)}
              onToggleStar={(file) => starMutation.mutate({ key: file.key, starred: file.starred })}
              onShare={setShareFile}
            />
          )}
        </section>
      </div>

      {preview && <PreviewDialog preview={preview} onClose={closePreview} />}
      {nativeEditor && <NativeEditor key={nativeEditor.object.key} content={nativeEditor.content} fileName={nativeEditor.object.name} onClose={() => setNativeEditor(null)} onSave={saveNativeFile} />}
      {advancedSearchOpen && <AdvancedSearchDialog filters={advancedFilters} itemName={search} onCancel={() => setAdvancedSearchOpen(false)} onFiltersChange={setAdvancedFilters} onItemNameChange={setSearch} onReset={resetAdvancedSearch} onSearch={applyAdvancedSearch} />}
      {folderDialogOpen && <FolderDialog folderName={folderName} onCancel={() => { setFolderDialogOpen(false); setFolderName(""); }} onCreate={() => void createFolder()} onNameChange={setFolderName} />}
      {nativeFileType && <NativeFileDialog type={nativeFileType} name={nativeFileName} onCancel={() => { setNativeFileType(null); setNativeFileName(""); }} onCreate={() => void createNativeFile()} onNameChange={setNativeFileName} />}
      {shareFile && <ShareDialog client={client} file={shareFile} onClose={() => setShareFile(null)} />}
      {passcodeShare && <ChangePasscodeDialog client={client} share={passcodeShare} onClose={() => setPasscodeShare(null)} onUpdated={() => void sharesQuery.refetch()} />}
      {uploads.length > 0 && <UploadProgress uploads={uploads} />}
    </main>
  );
}

function UploadProgress({ uploads }: { uploads: UploadTask[] }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(interval);
  }, []);
  const totalSize = uploads.reduce((total, upload) => total + upload.size, 0);
  const totalLoaded = uploads.reduce((total, upload) => total + upload.loaded, 0);
  const percentage = totalSize > 0 ? Math.min(100, Math.round((totalLoaded / totalSize) * 100)) : 100;
  const totalRate = uploads.reduce((total, upload) => total + uploadRate(upload, now), 0);
  const secondsRemaining = totalRate > 0 ? Math.ceil(Math.max(0, totalSize - totalLoaded) / totalRate) : null;
  return <div className="fixed bottom-5 right-5 z-50 w-[min(calc(100vw-2.5rem),30rem)] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/15" role="status" aria-live="polite"><div className="border-b border-slate-100 bg-gradient-to-r from-blue-600 to-sky-500 px-5 py-4 text-white"><div className="flex items-center justify-between gap-4"><span className="flex items-center gap-2 text-sm font-semibold"><LoaderCircle className="animate-spin" size={18} /> Uploading {uploads.length} file{uploads.length === 1 ? "" : "s"}</span><span className="text-sm font-bold tabular-nums">{percentage}%</span></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-white/25"><div className="h-full rounded-full bg-white transition-[width] duration-300" style={{ width: `${percentage}%` }} /></div><p className="mt-2 text-xs text-blue-50">{formatBytes(totalLoaded)} of {formatBytes(totalSize)}{secondsRemaining === null ? " · Preparing estimate…" : ` · About ${formatDuration(secondsRemaining)} left`}</p></div><div className="max-h-72 divide-y divide-slate-100 overflow-y-auto">{uploads.map((upload) => { const filePercentage = upload.size > 0 ? Math.min(100, Math.round((upload.loaded / upload.size) * 100)) : 100; const rate = uploadRate(upload, now); const remaining = rate > 0 ? Math.ceil(Math.max(0, upload.size - upload.loaded) / rate) : null; return <div className="px-5 py-4" key={upload.id}><div className="flex items-start gap-3"><span className="mt-0.5 rounded-lg bg-blue-50 p-2 text-blue-600"><File size={17} /></span><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-3"><p className="truncate text-sm font-semibold text-slate-800">{upload.name}</p><span className="shrink-0 text-xs font-semibold tabular-nums text-slate-500">{filePercentage}%</span></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-blue-600 transition-[width] duration-300" style={{ width: `${filePercentage}%` }} /></div><p className="mt-2 text-xs tabular-nums text-slate-500">{formatBytes(upload.loaded)} of {formatBytes(upload.size)}{rate > 0 ? ` · ${formatBytes(rate)}/s` : " · Starting…"}{remaining === null ? "" : ` · ${formatDuration(remaining)} left`}</p></div></div></div>; })}</div></div>;
}

function UsageCard({ usage }: { usage?: StorageUsage }) {
  const used = usage?.usedBytes ?? 0;
  const percentage = Math.min(100, (used / 107_374_182_400) * 100);
  return (
    <div className="mt-8 rounded-xl bg-slate-50 p-4">
      <div className="flex items-center justify-between text-sm font-medium text-slate-700"><span>Storage</span><span>{usage?.fileCount ?? 0} files</span></div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-blue-600" style={{ width: `${Math.max(percentage, used > 0 ? 1 : 0)}%` }} /></div>
      <p className="mt-2 text-xs text-slate-500">{formatBytes(used)} used of 100 GB</p>
    </div>
  );
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

function DriveEntries({ files, folders, viewMode, onOpenFolder, onPreview, onDelete, onToggleStar, onShare }: {
  files: DriveObject[];
  folders: DriveFolder[];
  viewMode: ViewMode;
  onOpenFolder: (folder: DriveFolder) => void;
  onPreview: (file: DriveObject) => void;
  onDelete: (key: string) => void;
  onToggleStar: (file: DriveObject) => void;
  onShare: (file: DriveObject) => void;
}) {
  const isGrid = viewMode === "grid";
  return (
    <div className={isGrid ? "grid gap-3 sm:grid-cols-2 xl:grid-cols-3" : "overflow-hidden rounded-xl border border-slate-200 bg-white"}>
      {folders.map((folder) => (
        <button key={folder.key} className={isGrid ? "flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 text-left hover:border-blue-300 hover:shadow-sm" : "flex w-full items-center gap-3 border-b border-slate-100 px-4 py-3 text-left hover:bg-slate-50"} onClick={() => onOpenFolder(folder)}>
          <span className="rounded-lg bg-blue-50 p-2 text-blue-600"><Folder size={20} fill="currentColor" /></span>
          <span className="min-w-0 flex-1 truncate text-sm font-medium">{folder.name}</span>
        </button>
      ))}
      {files.map((file) => (
        <article key={file.key} className={isGrid ? "group relative flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 hover:border-blue-300 hover:shadow-sm" : "group flex items-center gap-3 border-b border-slate-100 px-4 py-3 last:border-b-0 hover:bg-slate-50"}>
          <button className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={() => void onPreview(file)}>
            <span className="rounded-lg bg-slate-100 p-2 text-slate-500">{fileIcon(file.contentType)}</span>
            <span className="min-w-0"><span className="block truncate text-sm font-medium text-slate-800">{file.name}</span><span className="block text-xs text-slate-400">{formatBytes(file.size)} · {new Date(file.updatedAt).toLocaleDateString()}</span></span>
          </button>
          <button aria-label={`${file.starred ? "Remove" : "Add"} ${file.name} ${file.starred ? "from" : "to"} Starred`} className={`rounded-md p-2 transition hover:bg-amber-50 hover:text-amber-500 focus:opacity-100 ${file.starred ? "text-amber-400 opacity-100" : "text-slate-400 opacity-0 group-hover:opacity-100"}`} onClick={() => onToggleStar(file)}><Star size={17} fill={file.starred ? "currentColor" : "none"} /></button>
          <button aria-label={`Share ${file.name}`} className="rounded-md p-2 text-slate-400 opacity-0 transition hover:bg-blue-50 hover:text-blue-600 group-hover:opacity-100 focus:opacity-100" onClick={() => onShare(file)}><Share2 size={17} /></button>
          <button aria-label={`Move ${file.name} to Trash`} className="rounded-md p-2 text-slate-400 opacity-0 transition hover:bg-red-50 hover:text-red-600 group-hover:opacity-100 focus:opacity-100" onClick={() => onDelete(file.key)}><Trash2 size={17} /></button>
        </article>
      ))}
    </div>
  );
}

function RecentFiltersBar({ filters, onChange }: { filters: RecentFilters; onChange: (filters: RecentFilters) => void }) {
  return (
    <div className="mb-6 flex flex-wrap gap-2" aria-label="Recent filters">
      <label className="sr-only" htmlFor="recent-type">Type</label>
      <select id="recent-type" aria-label="Recent file type" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm outline-none hover:border-blue-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-100" value={filters.type} onChange={(event) => onChange({ ...filters, type: event.target.value as RecentFilters["type"] })}>
        <option value="any">All types</option><option value="document">Documents</option><option value="spreadsheet">Spreadsheets</option><option value="presentation">Presentations</option><option value="form">Forms</option><option value="image">Images</option><option value="video">Videos</option><option value="audio">Audio</option><option value="pdf">PDFs</option><option value="other">Other files</option>
      </select>
      <label className="sr-only" htmlFor="recent-modified">Modified</label>
      <select id="recent-modified" aria-label="Recent modified date" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm outline-none hover:border-blue-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-100" value={filters.modified} onChange={(event) => onChange({ ...filters, modified: event.target.value as RecentFilters["modified"] })}>
        <option value="any">Any time</option><option value="today">Modified today</option><option value="week">Past week</option><option value="month">Past month</option><option value="year">Past year</option>
      </select>
      <label className="sr-only" htmlFor="recent-source">Source</label>
      <select id="recent-source" aria-label="Recent source" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm outline-none hover:border-blue-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-100" value={filters.source} onChange={(event) => onChange({ ...filters, source: event.target.value as RecentFilters["source"] })}>
        <option value="any">All sources</option><option value="uploaded">Uploaded files</option><option value="zo-native">Zo-native files</option>
      </select>
      {(filters.type !== "any" || filters.modified !== "any" || filters.source !== "any") && <button className="rounded-lg px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50" onClick={() => onChange(defaultRecentFilters)}>Clear filters</button>}
    </div>
  );
}

function RecentEntries({ files, onPreview, onDelete, onToggleStar, onShare }: {
  files: DriveObject[];
  onPreview: (file: DriveObject) => void;
  onDelete: (key: string) => void;
  onToggleStar: (file: DriveObject) => void;
  onShare: (file: DriveObject) => void;
}) {
  const groups = groupRecentFiles(files);
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="hidden grid-cols-[minmax(15rem,1fr)_12rem_7rem_10rem_7rem] gap-4 border-b border-slate-100 bg-slate-50 px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-400 lg:grid"><span>Name</span><span>Last activity</span><span>File size</span><span>Location</span><span /></div>
      {groups.map(([label, items]) => (
        <section key={label}>
          <h2 className="border-b border-slate-100 bg-white px-5 py-3 text-sm font-semibold text-slate-600">{label}</h2>
          {items.map((file) => (
            <article key={file.key} className="group grid gap-3 border-b border-slate-100 px-5 py-3 last:border-b-0 hover:bg-slate-50 lg:grid-cols-[minmax(15rem,1fr)_12rem_7rem_10rem_7rem] lg:items-center lg:gap-4">
              <button className="flex min-w-0 items-center gap-3 text-left" onClick={() => void onPreview(file)}><span className="rounded-lg bg-slate-100 p-2 text-slate-500">{fileIcon(file.contentType)}</span><span className="min-w-0 truncate text-sm font-medium text-slate-800">{file.name}</span></button>
              <span className="text-xs text-slate-500">{formatRecentActivity(file.updatedAt)}</span>
              <span className="text-xs text-slate-500">{formatBytes(file.size)}</span>
              <span className="truncate text-xs text-slate-500" title={recentFileLocation(file.key)}>{recentFileLocation(file.key)}</span>
              <div className="flex items-center justify-end gap-1"><button aria-label={`${file.starred ? "Remove" : "Add"} ${file.name} ${file.starred ? "from" : "to"} Starred`} className={`rounded-md p-2 transition hover:bg-amber-50 hover:text-amber-500 ${file.starred ? "text-amber-400" : "text-slate-400 opacity-0 group-hover:opacity-100 focus:opacity-100"}`} onClick={() => onToggleStar(file)}><Star size={17} fill={file.starred ? "currentColor" : "none"} /></button><button aria-label={`Share ${file.name}`} className="rounded-md p-2 text-slate-400 opacity-0 transition hover:bg-blue-50 hover:text-blue-600 group-hover:opacity-100 focus:opacity-100" onClick={() => onShare(file)}><Share2 size={17} /></button><button aria-label={`Move ${file.name} to Trash`} className="rounded-md p-2 text-slate-400 opacity-0 transition hover:bg-red-50 hover:text-red-600 group-hover:opacity-100 focus:opacity-100" onClick={() => onDelete(file.key)}><Trash2 size={17} /></button></div>
            </article>
          ))}
        </section>
      ))}
    </div>
  );
}

function TrashEntries({ items, onRestore, onPermanentlyDelete }: { items: DriveTrashItem[]; onRestore: (id: string) => void; onPermanentlyDelete: (item: DriveTrashItem) => void }) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="hidden grid-cols-[minmax(0,1fr)_10rem_10rem] gap-4 border-b border-slate-100 bg-slate-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-400 md:grid"><span>Name</span><span>Date trashed</span><span>Original location</span></div>
      {items.map((item) => (
        <article key={item.id} className="group grid gap-3 border-b border-slate-100 px-4 py-3 last:border-b-0 md:grid-cols-[minmax(0,1fr)_10rem_10rem] md:items-center md:gap-4 hover:bg-slate-50">
          <div className="flex min-w-0 items-center gap-3"><span className="rounded-lg bg-slate-100 p-2 text-slate-500">{fileIcon(item.contentType)}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium text-slate-800">{item.name}</span><span className="block text-xs text-slate-400">{formatBytes(item.size)} · {formatTrashExpiry(item.expiresAt)}</span></span><div className="flex shrink-0 items-center gap-1"><button aria-label={`Restore ${item.name}`} title="Restore to original location" className="rounded-md p-2 text-slate-400 transition hover:bg-blue-50 hover:text-blue-600" onClick={() => onRestore(item.id)}><RotateCcw size={17} /></button><button aria-label={`Permanently delete ${item.name}`} title="Permanently delete" className="rounded-md p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-600" onClick={() => onPermanentlyDelete(item)}><Trash2 size={17} /></button></div></div>
          <span className="text-xs text-slate-500">{new Date(item.trashedAt).toLocaleDateString()}</span>
          <span className="truncate text-xs text-slate-500" title={item.originalKey}>{item.originalKey.includes("/") ? item.originalKey.slice(0, item.originalKey.lastIndexOf("/")) : "My Drive"}</span>
        </article>
      ))}
    </div>
  );
}

function EmptyState({ title, description, action, onAction }: { title: string; description?: string; action: string; onAction: () => void }) {
  return <div className="grid min-h-72 place-items-center rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center"><div><span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-blue-50 text-blue-600"><Cloud size={24} /></span><h2 className="mt-4 font-semibold text-slate-800">{title}</h2>{description && <p className="mt-2 max-w-sm text-sm text-slate-500">{description}</p>}<button className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700" onClick={onAction}>{action}</button></div></div>;
}

function FolderDialog({ folderName, onCancel, onCreate, onNameChange }: { folderName: string; onCancel: () => void; onCreate: () => void; onNameChange: (name: string) => void }) {
  return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/30 p-4" role="dialog" aria-modal="true" aria-label="Create folder"><form className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl" onSubmit={(event) => { event.preventDefault(); onCreate(); }}><h2 className="text-lg font-semibold text-slate-900">Create folder</h2><p className="mt-1 text-sm text-slate-500">Choose a name for the new folder.</p><input aria-label="Folder name" autoFocus className="mt-5 w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" maxLength={128} placeholder="e.g. Projects" value={folderName} onChange={(event) => onNameChange(event.target.value)} required /><div className="mt-5 flex justify-end gap-2"><button className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100" type="button" onClick={onCancel}>Cancel</button><button className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:bg-slate-300" type="submit" disabled={!folderName.trim()}>Create folder</button></div></form></div>;
}

function NativeFileDialog({ type, name, onCancel, onCreate, onNameChange }: { type: NativeFileType; name: string; onCancel: () => void; onCreate: () => void; onNameChange: (name: string) => void }) {
  const label = nativeFileLabel(type);
  return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/30 p-4" role="dialog" aria-modal="true" aria-label={`Create Zo ${label}`}><form className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl" onSubmit={(event) => { event.preventDefault(); onCreate(); }}><h2 className="text-lg font-semibold text-slate-900">Create Zo {label}</h2><p className="mt-1 text-sm text-slate-500">This is a private, structured Zo-native file in the current folder.</p><input aria-label={`${label} name`} autoFocus className="mt-5 w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" maxLength={128} value={name} onChange={(event) => onNameChange(event.target.value)} required /><div className="mt-5 flex justify-end gap-2"><button className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100" type="button" onClick={onCancel}>Cancel</button><button className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:bg-slate-300" disabled={!name.trim()} type="submit">Create</button></div></form></div>;
}

function AdvancedSearchDialog({ filters, itemName, onCancel, onFiltersChange, onItemNameChange, onReset, onSearch }: { filters: AdvancedFilters; itemName: string; onCancel: () => void; onFiltersChange: (filters: AdvancedFilters) => void; onItemNameChange: (value: string) => void; onReset: () => void; onSearch: () => void }) {
  const update = (change: Partial<AdvancedFilters>) => onFiltersChange({ ...filters, ...change });
  return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4" role="dialog" aria-modal="true" aria-label="Advanced search"><form className="w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl" onSubmit={(event) => { event.preventDefault(); onSearch(); }}><header className="flex items-center justify-between border-b border-slate-100 px-6 py-5"><div><h2 className="text-xl font-semibold text-slate-900">Advanced search</h2><p className="mt-1 text-sm text-slate-500">Search your private Drive with precise file filters.</p></div><button aria-label="Close advanced search" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" onClick={onCancel} type="button"><X size={20} /></button></header><div className="grid gap-5 p-6 sm:grid-cols-[10rem_minmax(0,1fr)]"><label className="text-sm font-semibold text-slate-700 sm:pt-2">Type</label><select aria-label="File type" className="rounded-lg border border-slate-300 bg-white px-3 py-2.5" value={filters.type} onChange={(event) => update({ type: event.target.value as AdvancedFilters["type"] })}><option value="any">Any</option><option value="document">Documents</option><option value="spreadsheet">Spreadsheets</option><option value="presentation">Presentations</option><option value="form">Forms</option><option value="image">Images</option><option value="video">Videos</option><option value="audio">Audio</option><option value="pdf">PDFs</option><option value="other">Other files</option></select><label className="text-sm font-semibold text-slate-700 sm:pt-2" htmlFor="advanced-content">Has the words</label><input id="advanced-content" className="rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" placeholder="Words within a text or Zo-native file" value={filters.contentQuery} onChange={(event) => update({ contentQuery: event.target.value })} /><label className="text-sm font-semibold text-slate-700 sm:pt-2" htmlFor="advanced-name">Item name</label><input id="advanced-name" className="rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" placeholder="Part of the file name" value={itemName} onChange={(event) => onItemNameChange(event.target.value)} /><label className="text-sm font-semibold text-slate-700 sm:pt-2">Location</label><div className="space-y-3"><select aria-label="Search location" className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5" value={filters.location} onChange={(event) => update({ location: event.target.value as AdvancedFilters["location"] })}><option value="anywhere">Anywhere in My Drive</option><option value="current">Current folder only</option></select><label className="flex items-center gap-2 text-sm font-medium text-slate-700"><input aria-label="Search in Trash" className="size-4 accent-blue-600" type="checkbox" checked={filters.inTrash} onChange={(event) => update({ inTrash: event.target.checked })} /> Search in Trash</label><label className="flex items-center gap-2 text-sm font-medium text-slate-700"><input aria-label="Only starred files" className="size-4 accent-blue-600" type="checkbox" checked={filters.starred} onChange={(event) => update({ starred: event.target.checked })} /> Only Starred</label></div><label className="text-sm font-semibold text-slate-700 sm:pt-2">Date modified</label><select aria-label="Date modified" className="rounded-lg border border-slate-300 bg-white px-3 py-2.5" value={filters.modified} onChange={(event) => update({ modified: event.target.value as AdvancedFilters["modified"] })}><option value="any">Any time</option><option value="today">Today</option><option value="week">Past week</option><option value="month">Past month</option><option value="year">Past year</option></select></div><footer className="flex items-center justify-between border-t border-slate-100 px-6 py-4"><button className="text-sm font-semibold text-blue-700 hover:text-blue-900" type="button" onClick={onReset}>Reset</button><div className="flex gap-2"><button className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100" type="button" onClick={onCancel}>Cancel</button><button className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700" type="submit">Search</button></div></footer></form></div>;
}

function ShareDialog({ client, file, onClose }: { client: DriveClient; file: DriveObject; onClose: () => void }) {
  const [access, setAccess] = useState<ShareAccess>("public");
  const [passcode, setPasscode] = useState("");
  const [showPasscode, setShowPasscode] = useState(false);
  const [ttl, setTtl] = useState("never");
  const [link, setLink] = useState<string | null>(null);
  const mutation = useMutation({
    mutationFn: async () => client.createShare({ key: file.key, access, passcode: access === "passcode" ? passcode : undefined, expiresAt: ttlToDate(ttl) }),
    onSuccess: (share) => {
      const nextLink = shareLink(share.id);
      setLink(nextLink);
      void copyText(nextLink, "Share link copied");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not create share link")
  });
  return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4" role="dialog" aria-modal="true" aria-label={`Share ${file.name}`}><div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"><div className="flex items-start justify-between gap-4"><div><h2 className="text-lg font-semibold text-slate-900">Share {file.name}</h2><p className="mt-1 text-sm text-slate-500">Create a view-only link you can manage later.</p></div><button className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" onClick={onClose} aria-label="Close share dialog"><X size={20} /></button></div>{link ? <div className="mt-5"><p className="text-sm font-medium text-slate-700">Link ready</p><div className="mt-2 flex gap-2"><input className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm" value={link} readOnly /><button className="rounded-lg border border-slate-300 px-3 text-slate-700 hover:border-blue-300 hover:text-blue-700" onClick={() => void copyText(link, "Share link copied")} aria-label="Copy share link"><Copy size={18} /></button></div><button className="mt-5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700" onClick={onClose}>Done</button></div> : <div className="mt-5 space-y-4"><fieldset><legend className="text-sm font-medium text-slate-700">Who can open this link?</legend><div className="mt-2 grid grid-cols-2 gap-2"><label className={`rounded-lg border p-3 text-sm ${access === "public" ? "border-blue-500 bg-blue-50 text-blue-700" : "border-slate-200"}`}><input className="sr-only" type="radio" checked={access === "public"} onChange={() => setAccess("public")} />Anyone with link</label><label className={`rounded-lg border p-3 text-sm ${access === "passcode" ? "border-blue-500 bg-blue-50 text-blue-700" : "border-slate-200"}`}><input className="sr-only" type="radio" checked={access === "passcode"} onChange={() => setAccess("passcode")} />Passcode required</label></div></fieldset>{access === "passcode" && <div className="relative"><input aria-label="Share passcode" className="w-full rounded-lg border border-slate-300 py-2.5 pl-3 pr-11 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" type={showPasscode ? "text" : "password"} placeholder="Choose a secret passcode" value={passcode} onChange={(event) => setPasscode(event.target.value)} required /><button aria-label={showPasscode ? "Hide share passcode" : "Show share passcode"} className="absolute right-1 top-1/2 -translate-y-1/2 rounded-md p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700" onClick={() => setShowPasscode((show) => !show)} type="button">{showPasscode ? <EyeOff size={18} /> : <Eye size={18} />}</button></div>}<label className="block text-sm font-medium text-slate-700">Link expiry<select aria-label="Link expiry" className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5" value={ttl} onChange={(event) => setTtl(event.target.value)}><option value="never">Never expires</option><option value="1d">Expires in 1 day</option><option value="7d">Expires in 7 days</option><option value="30d">Expires in 30 days</option></select></label><button className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:bg-slate-300" disabled={mutation.isPending || (access === "passcode" && !passcode)} onClick={() => mutation.mutate()}>{mutation.isPending ? "Creating link…" : "Create share link"}</button></div>}</div></div>;
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
  return <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">{shares.map((share) => <article key={share.id} className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-4 py-3 last:border-b-0"><span className="rounded-lg bg-blue-50 p-2 text-blue-600"><Share2 size={19} /></span><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-slate-800">{share.name}</p><p className="mt-0.5 text-xs text-slate-500">{share.access === "public" ? "Anyone with the link" : "Passcode protected"} · {share.expiresAt ? `Expires ${new Date(share.expiresAt).toLocaleString()}` : "No expiry"}</p></div><button className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-blue-700" onClick={() => onPreview(share)} aria-label={`View ${share.name}`}><Eye size={18} /></button><button className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-blue-700" onClick={() => onCopy(share)} aria-label={`Copy link for ${share.name}`}><Copy size={17} /></button>{share.access === "passcode" && <button className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-blue-700" onClick={() => onChangePasscode(share)}>Change passcode</button>}<button className="rounded-lg px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50" onClick={() => onRevoke(share.id)}>Revoke</button></article>)}</div>;
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
  return <main className="grid min-h-screen place-items-center bg-[#f8faff] p-5"><section className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-7 shadow-sm"><p className="text-sm font-medium text-blue-600">Zo Drive shared file</p><h1 className="mt-2 break-words text-2xl font-semibold text-slate-900">{share.name}</h1><p className="mt-2 text-sm text-slate-500">{formatBytes(share.size)} · {share.expiresAt ? `Available until ${new Date(share.expiresAt).toLocaleString()}` : "No expiry"}</p>{share.requiresPasscode && <label className="mt-6 block text-sm font-medium text-slate-700">Passcode<div className="relative mt-1.5"><input aria-label="Shared file passcode" className="w-full rounded-lg border border-slate-300 py-2.5 pl-3 pr-11 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" type={showPasscode ? "text" : "password"} value={passcode} onChange={(event) => setPasscode(event.target.value)} /><button aria-label={showPasscode ? "Hide shared file passcode" : "Show shared file passcode"} className="absolute right-1 top-1/2 -translate-y-1/2 rounded-md p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700" onClick={() => setShowPasscode((show) => !show)} type="button">{showPasscode ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></label>}<button className="mt-6 w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:bg-slate-300" disabled={downloadMutation.isPending || (share.requiresPasscode && !passcode)} onClick={() => downloadMutation.mutate()}>{downloadMutation.isPending ? "Opening…" : "Open shared file"}</button><button className="mt-3 w-full rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100" onClick={() => { window.location.href = driveHomeUrl(); }}>Open Zo Drive</button></section>{preview && <PreviewDialog preview={preview} onClose={() => { URL.revokeObjectURL(preview.url); setPreview(null); }} />}</main>;
}

function PreviewDialog({ preview, onClose }: { preview: { object: DriveObject; url: string }; onClose: () => void }) {
  const { object, url } = preview;
  const media = object.contentType.startsWith("image/") ? <img className="max-h-[72vh] max-w-full rounded-lg object-contain" src={url} alt={object.name} />
    : object.contentType === "application/pdf" ? <iframe className="h-[72vh] w-full rounded-lg bg-white" src={url} title={object.name} />
      : object.contentType.startsWith("audio/") ? <audio className="w-full" src={url} controls />
        : object.contentType.startsWith("video/") ? <video className="max-h-[72vh] max-w-full rounded-lg" src={url} controls />
          : <a className="rounded-lg bg-blue-600 px-4 py-2 font-medium text-white" href={url} download={object.name}>Download {object.name}</a>;
  return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4" role="dialog" aria-modal="true" aria-label={`Preview ${object.name}`}><div className="w-full max-w-5xl rounded-2xl bg-slate-900 p-4 shadow-2xl"><div className="mb-4 flex items-center justify-between gap-4 text-white"><span className="truncate text-sm font-medium">{object.name}</span><button className="rounded-lg p-2 hover:bg-white/10" onClick={onClose} aria-label="Close preview"><X size={20} /></button></div><div className="grid min-h-48 place-items-center">{media}</div></div></div>;
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

function NativeEditor({ content: initialContent, fileName, onClose, onSave }: { content: NativeFileContent; fileName: string; onClose: () => void; onSave: (content: NativeFileContent) => Promise<void> }) {
  const [content, setContent] = useState(initialContent);
  const [activeSlide, setActiveSlide] = useState(0);
  const [saving, setSaving] = useState(false);
  const type = content.type;

  async function save() {
    setSaving(true);
    try {
      await onSave(content);
    } finally {
      setSaving(false);
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
  } else {
    const questions = Array.isArray(content.questions) ? content.questions.filter((question): question is string => typeof question === "string") : [];
    editor = <div className="mx-auto max-w-3xl space-y-4 p-6 md:p-10"><div className="rounded-xl border border-blue-100 bg-blue-50 p-5"><input aria-label="Form title" className="w-full bg-transparent text-2xl font-semibold text-slate-900 outline-none placeholder:text-slate-400" placeholder="Untitled form" value={typeof content.title === "string" ? content.title : ""} onChange={(event) => setContent({ ...content, title: event.target.value })} /><p className="mt-2 text-sm text-slate-500">Add questions for this private Zo-native form.</p></div>{questions.map((question, index) => <div className="flex gap-2 rounded-xl border border-slate-200 bg-white p-4" key={index}><input aria-label={`Question ${index + 1}`} className="min-w-0 flex-1 border-0 text-sm font-medium text-slate-800 outline-none" value={question} onChange={(event) => setContent({ ...content, questions: questions.map((item, itemIndex) => itemIndex === index ? event.target.value : item) })} /><button aria-label={`Remove question ${index + 1}`} className="rounded-md p-2 text-slate-400 hover:bg-red-50 hover:text-red-600" onClick={() => setContent({ ...content, questions: questions.filter((_, itemIndex) => itemIndex !== index) })}><Trash2 size={17} /></button></div>)}<button className="rounded-lg border border-blue-200 bg-white px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50" onClick={() => setContent({ ...content, questions: [...questions, "New question"] })}>Add question</button></div>;
  }

  return <div className="fixed inset-0 z-50 flex flex-col bg-slate-100" role="dialog" aria-modal="true" aria-label={`Edit Zo ${nativeFileLabel(type)}`}><header className="flex min-h-16 items-center gap-3 border-b border-slate-200 bg-white px-4 md:px-6"><button aria-label="Close editor" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" onClick={onClose}><X size={20} /></button><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-slate-800">{fileName}</p><p className="text-xs text-slate-400">Zo {nativeFileLabel(type)} · private</p></div><button className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:bg-slate-300" disabled={saving} onClick={() => void save()}>{saving ? "Saving…" : "Save"}</button></header><main className="min-h-0 flex-1 overflow-auto">{editor}</main></div>;
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
  return { document: "Document", spreadsheet: "Spreadsheet", presentation: "Presentation", form: "Form" }[type];
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

export function formulaDisplay(value: string, cells: Record<string, string>): string {
  if (!value.startsWith("=")) return value;
  try {
    const result = evaluateFormula(value.slice(1), cells, new Set());
    return Number.isInteger(result) ? String(result) : String(Math.round(result * 1_000_000) / 1_000_000);
  } catch {
    return "#ERROR";
  }
}

function evaluateFormula(expression: string, cells: Record<string, string>, visited: Set<string>): number {
  const withSums = expression.replace(/SUM\(([A-Z]+\d+):([A-Z]+\d+)\)/gi, (_match, first: string, last: string) => String(sumRange(first.toUpperCase(), last.toUpperCase(), cells, visited)));
  const substituted = withSums.replace(/\b([A-Z]+\d+)\b/gi, (_match, reference: string) => String(cellNumber(reference.toUpperCase(), cells, visited)));
  if (!/^[0-9+\-*/().\s]+$/.test(substituted)) throw new Error("Unsupported formula");
  const result = Function(`"use strict"; return (${substituted});`)();
  if (typeof result !== "number" || !Number.isFinite(result)) throw new Error("Invalid result");
  return result;
}

function cellNumber(reference: string, cells: Record<string, string>, visited: Set<string>): number {
  if (visited.has(reference)) throw new Error("Circular reference");
  const value = cells[reference] ?? "0";
  if (!value.startsWith("=")) return Number(value) || 0;
  const nextVisited = new Set(visited);
  nextVisited.add(reference);
  return evaluateFormula(value.slice(1), cells, nextVisited);
}

function sumRange(first: string, last: string, cells: Record<string, string>, visited: Set<string>): number {
  const start = parseCellReference(first);
  const end = parseCellReference(last);
  if (!start || !end || start.column > end.column || start.row > end.row) throw new Error("Invalid range");
  let total = 0;
  for (let column = start.column; column <= end.column; column += 1) {
    for (let row = start.row; row <= end.row; row += 1) total += cellNumber(`${columnName(column)}${row}`, cells, visited);
  }
  return total;
}

function parseCellReference(value: string): { column: number; row: number } | null {
  const match = /^([A-Z]+)(\d+)$/.exec(value);
  if (!match) return null;
  const column = [...match[1]!].reduce((total, character) => total * 26 + character.charCodeAt(0) - 64, 0);
  return { column, row: Number(match[2]) };
}

function columnName(column: number): string {
  let result = "";
  for (let current = column; current > 0; current = Math.floor((current - 1) / 26)) result = String.fromCharCode(65 + ((current - 1) % 26)) + result;
  return result;
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
  if (type === "image") return contentType.startsWith("image/");
  if (type === "video") return contentType.startsWith("video/");
  if (type === "audio") return contentType.startsWith("audio/");
  if (type === "pdf") return contentType === "application/pdf";
  return !contentType.startsWith("text/") && !contentType.startsWith("image/") && !contentType.startsWith("video/") && !contentType.startsWith("audio/") && contentType !== "application/pdf" && !contentType.startsWith("application/vnd.zo.");
}

function isZoNativeFile(file: DriveObject): boolean {
  return Boolean(file.nativeType) || file.contentType.startsWith("application/vnd.zo.");
}

function recentFileLocation(key: string): string {
  const separator = key.lastIndexOf("/");
  return separator < 0 ? "My Drive" : key.slice(0, separator);
}

function formatRecentActivity(updatedAt: string): string {
  const date = new Date(updatedAt);
  const now = new Date();
  const today = date.toDateString() === now.toDateString();
  if (today) return `Modified today, ${date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
  return `Modified ${date.toLocaleDateString([], { month: "short", day: "numeric" })}`;
}

function groupRecentFiles(files: DriveObject[]): Array<[string, DriveObject[]]> {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = new Date(todayStart);
  weekStart.setDate(todayStart.getDate() - 7);
  const lastWeekStart = new Date(todayStart);
  lastWeekStart.setDate(todayStart.getDate() - 14);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const groups = new Map<string, DriveObject[]>();
  for (const file of files) {
    const updatedAt = new Date(file.updatedAt);
    const label = updatedAt >= todayStart ? "Today" : updatedAt >= weekStart ? "Earlier this week" : updatedAt >= lastWeekStart ? "Last week" : updatedAt >= monthStart ? "Earlier this month" : updatedAt.toLocaleDateString([], { month: "long", year: "numeric" });
    groups.set(label, [...(groups.get(label) ?? []), file]);
  }
  return [...groups.entries()];
}

function formatBytes(bytes: number): string {
  if (bytes < 1_024) return `${bytes} B`;
  if (bytes < 1_048_576) return `${(bytes / 1_024).toFixed(1)} KB`;
  if (bytes < 1_073_741_824) return `${(bytes / 1_048_576).toFixed(1)} MB`;
  return `${(bytes / 1_073_741_824).toFixed(1)} GB`;
}

function uploadRate(upload: UploadTask, now: number): number {
  if (upload.loaded === 0) return 0;
  return upload.loaded / Math.max((now - upload.startedAt) / 1_000, 0.25);
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return minutes < 60 ? `${minutes}m ${remainingSeconds}s` : `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

function formatTrashExpiry(expiresAt: string): string {
  const days = Math.max(0, Math.ceil((Date.parse(expiresAt) - Date.now()) / (24 * 60 * 60 * 1_000)));
  return days === 0 ? "Deletes today" : `Deletes in ${days} day${days === 1 ? "" : "s"}`;
}

function ttlToDate(ttl: string): string | null {
  const milliseconds = ttl === "1d" ? 24 * 60 * 60 * 1_000 : ttl === "7d" ? 7 * 24 * 60 * 60 * 1_000 : ttl === "30d" ? 30 * 24 * 60 * 60 * 1_000 : 0;
  return milliseconds ? new Date(Date.now() + milliseconds).toISOString() : null;
}

function normalizeAppBasePath(value: string): string {
  const trimmed = value.trim().replace(/^\/+|\/+$/g, "");
  return trimmed ? `/${trimmed}` : "";
}

function driveHomeUrl(): string {
  return `${window.location.origin}${appBasePath || "/"}`;
}

function shareLink(id: string): string {
  return `${driveHomeUrl()}?share=${encodeURIComponent(id)}`;
}

async function copyShareLink(id: string): Promise<void> {
  await copyText(shareLink(id), "Share link copied");
}

async function copyText(value: string, successMessage: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(value);
    toast.success(successMessage);
  } catch {
    toast.error("Could not copy automatically. Select and copy the link instead.");
  }
}
