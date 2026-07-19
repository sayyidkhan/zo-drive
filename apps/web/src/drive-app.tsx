import { QueryClient, QueryClientProvider, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Cloud,
  Copy,
  File,
  FileAudio,
  FileImage,
  FileText,
  Folder,
  FolderPlus,
  Grid2X2,
  HardDrive,
  House,
  KeyRound,
  List,
  LoaderCircle,
  LockKeyhole,
  LogOut,
  MoreHorizontal,
  Search,
  Share2,
  ShieldAlert,
  Trash2,
  Upload,
  UserRound,
  UsersRound,
  X
} from "lucide-react";
import { useMemo, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { toast, Toaster } from "sonner";
import { create } from "zustand";

import { ZoDriveClient } from "@zo-drive/sdk";
import type { AuthStatus, DriveFolder, DriveObject, DriveShare, DriveUser, PublicShare, ShareAccess, StorageUsage } from "@zo-drive/types";

type DriveClient = Pick<ZoDriveClient, "createFolder" | "createShare" | "delete" | "download" | "getUsage" | "list" | "listFolders" | "listShares" | "revokeShare" | "upload">;
type AuthClient = Pick<ZoDriveClient, "changePassword" | "deleteAccount" | "getAuthStatus" | "login" | "logout" | "registerInitialUser" | "updateProfile">;
type SharedClient = Pick<ZoDriveClient, "downloadShared" | "getPublicShare">;
type ViewMode = "grid" | "list";

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

// Local development uses Vite's same-origin proxy so browsers never need to
// make a cross-port request. Deployed builds use the configured service URL.
const apiBaseUrl = import.meta.env.DEV
  ? window.location.origin
  : import.meta.env.VITE_ZO_DRIVE_API_URL ?? window.location.origin;

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
          <span className="relative block h-11 w-11 shrink-0" role="img" aria-label="Zo Drive Pegasus on a cloud"><img className="absolute inset-0 h-full w-full" src="/zo-drive-pegasus-cloud.svg" alt="" /><img className="absolute left-[5.94%] top-0 h-[88.44%] w-[88.44%]" src="/zo-pegasus.svg" alt="" /></span>
          Zo Drive
        </div>
        <div className="mt-8"><LockKeyhole className="mb-3 text-blue-600" size={24} /><h1 className="text-2xl font-semibold tracking-tight text-slate-900">{isBootstrap ? "Create your owner account" : "Sign in to Zo Drive"}</h1><p className="mt-2 text-sm leading-6 text-slate-500">{isBootstrap ? "No owner account exists yet. Create one to initialise this private drive. Registration closes immediately after this." : "Use the owner account for this private drive."}</p></div>
        <form className="mt-6 space-y-4" onSubmit={submit}>
          <label className="block text-sm font-medium text-slate-700">Username<input aria-label="Username" autoComplete="username" className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" type="text" minLength={3} maxLength={32} pattern="[A-Za-z0-9_-]+" value={username} onChange={(event) => setUsername(event.target.value)} required /></label>
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
            <form className="flex flex-col gap-3 sm:flex-row" onSubmit={(event) => { event.preventDefault(); profileMutation.mutate(); }}><input aria-label="Account username" className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" minLength={3} maxLength={32} pattern="[A-Za-z0-9_-]+" value={username} onChange={(event) => setUsername(event.target.value)} required /><button className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:bg-slate-300" disabled={profileMutation.isPending || username === user.username} type="submit">Save username</button></form>
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
  const [section, setSection] = useState<"home" | "my-drive" | "shared">("my-drive");
  const [search, setSearch] = useState("");
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [folderDialogOpen, setFolderDialogOpen] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [shareFile, setShareFile] = useState<DriveObject | null>(null);
  const [preview, setPreview] = useState<{ object: DriveObject; url: string } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const filesQuery = useQuery({
    queryKey: ["objects", section === "my-drive" ? currentPath : "all", search],
    queryFn: () => client.list({ prefix: section === "my-drive" ? currentPath || undefined : undefined, query: search || undefined })
  });
  const foldersQuery = useQuery({
    queryKey: ["folders", currentPath],
    queryFn: () => client.listFolders(currentPath || undefined),
    enabled: section === "my-drive"
  });
  const sharesQuery = useQuery({ queryKey: ["shares"], queryFn: () => client.listShares(), enabled: section === "shared" });
  const usageQuery = useQuery({ queryKey: ["usage"], queryFn: () => client.getUsage() });

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["objects"] }),
      queryClient.invalidateQueries({ queryKey: ["folders"] }),
      queryClient.invalidateQueries({ queryKey: ["usage"] })
    ]);
  };
  const deleteMutation = useMutation({
    mutationFn: (key: string) => client.delete(key),
    onSuccess: async () => {
      await refresh();
      toast.success("File deleted");
    },
    onError: () => toast.error("Could not delete the file")
  });

  const objects = filesQuery.data ?? [];
  const files = visibleFiles(objects, currentPath);
  const recentFiles = [...objects].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  const folders = search ? [] : foldersQuery.data ?? [];
  const isLoading = section === "shared" ? sharesQuery.isPending || usageQuery.isPending : filesQuery.isPending || (section === "my-drive" && foldersQuery.isPending) || usageQuery.isPending;
  const loadError = filesQuery.error ?? foldersQuery.error ?? sharesQuery.error ?? usageQuery.error;

  async function uploadFiles(selectedFiles: FileList | File[]) {
    const filesToUpload = Array.from(selectedFiles);
    if (filesToUpload.length === 0) {
      return;
    }
    try {
      await Promise.all(
        filesToUpload.map((file) => client.upload({ file, fileName: file.name, path: currentPath || undefined }))
      );
      await refresh();
      toast.success(`${filesToUpload.length} file${filesToUpload.length === 1 ? "" : "s"} uploaded`);
    } catch {
      toast.error("Upload failed. Please try again.");
    }
  }

  async function openPreview(object: DriveObject) {
    try {
      const response = await client.download(object.key);
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

  function closePreview() {
    if (preview) URL.revokeObjectURL(preview.url);
    setPreview(null);
  }

  function handleFileInput(event: ChangeEvent<HTMLInputElement>) {
    if (event.target.files) void uploadFiles(event.target.files);
    event.target.value = "";
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
            <img className="absolute inset-0 h-full w-full" src="/zo-drive-pegasus-cloud.svg" alt="" />
            <img className="absolute left-[5.94%] top-0 h-[88.44%] w-[88.44%]" src="/zo-pegasus.svg" alt="" />
          </span>
          Zo Drive
        </div>
        <label className="relative max-w-2xl flex-1">
          <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={19} />
          <input
            aria-label="Search files"
            className="w-full rounded-xl border border-transparent bg-slate-100 py-2.5 pl-11 pr-4 outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-100"
            placeholder="Search in Drive"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <div className="ml-auto flex items-center gap-3 text-sm font-medium text-slate-500">
          <span className="hidden items-center gap-2 sm:flex"><HardDrive size={18} /> Private drive</span>
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
          <div className="grid grid-cols-2 gap-2">
            <button className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-3 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700" onClick={() => fileInput.current?.click()}>
              <Upload size={17} /> Upload
            </button>
            <button className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-semibold text-slate-700 transition hover:border-blue-300 hover:text-blue-700" onClick={() => setFolderDialogOpen(true)}>
              <FolderPlus size={17} /> Folder
            </button>
          </div>
          <input ref={fileInput} aria-label="Upload files" className="hidden" type="file" multiple onChange={handleFileInput} />

          <nav className="mt-6 space-y-1">
            <button className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-semibold ${section === "home" ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-50"}`} onClick={() => { setSection("home"); setCurrentPath(""); }}><House size={18} /> Home</button>
            <button className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-semibold ${section === "my-drive" ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-50"}`} onClick={() => { setSection("my-drive"); setCurrentPath(""); }}><HardDrive size={18} /> My Drive</button>
            <button className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-semibold ${section === "shared" ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-50"}`} onClick={() => setSection("shared")}><UsersRound size={18} /> Shared with others</button>
          </nav>

          <UsageCard usage={usageQuery.data} />
          <p className="mt-6 px-2 text-xs leading-5 text-slate-400">Files are stored in your private Zo Drive data root.</p>
        </aside>

        <section className="min-w-0 flex-1 p-6 md:p-9">
          <div className="mb-7 flex flex-wrap items-center justify-between gap-4">
            <div>
              {section === "my-drive" && currentPath && <Breadcrumbs currentPath={currentPath} onNavigate={setCurrentPath} />}
              <h1 className={`${section === "my-drive" && currentPath ? "mt-2" : ""} text-2xl font-semibold tracking-tight text-slate-900`}>{search ? "Search results" : section === "home" ? "Home" : section === "shared" ? "Shared with others" : currentPath ? currentPath.split("/").at(-1) : "Files"}</h1>
              {section === "home" && <p className="mt-1 text-sm text-slate-500">Your most recently updated files.</p>}
              {section === "shared" && <p className="mt-1 text-sm text-slate-500">Manage links you have shared outside your drive.</p>}
            </div>
            <div className="flex rounded-lg border border-slate-200 bg-white p-1">
              <button aria-label="List view" className={`rounded-md p-2 ${viewMode === "list" ? "bg-slate-100 text-slate-900" : "text-slate-400"}`} onClick={() => setViewMode("list")}><List size={18} /></button>
              <button aria-label="Grid view" className={`rounded-md p-2 ${viewMode === "grid" ? "bg-slate-100 text-slate-900" : "text-slate-400"}`} onClick={() => setViewMode("grid")}><Grid2X2 size={18} /></button>
            </div>
          </div>

          {isLoading ? (
            <div className="grid h-64 place-items-center text-sm text-slate-500"><LoaderCircle className="mr-2 animate-spin" size={20} /> Loading your drive…</div>
          ) : (section === "shared" ? sharesQuery.isError : filesQuery.isError) ? (
            <EmptyState
              title="We couldn't load your drive"
              description={loadError instanceof Error ? loadError.message : "Check that the Drive API is running, then try again."}
              action="Try again"
              onAction={() => void filesQuery.refetch()}
            />
          ) : section === "shared" ? (
            <SharedLinks shares={sharesQuery.data ?? []} onCopy={(share) => void copyShareLink(share.id)} onRevoke={(id) => client.revokeShare(id).then(() => sharesQuery.refetch())} />
          ) : (section === "home" ? recentFiles.length === 0 : folders.length === 0 && files.length === 0) ? (
            <EmptyState title={search ? "No matching files" : "Your drive is ready for its first file"} action="Upload files" onAction={() => fileInput.current?.click()} />
          ) : (
            <DriveEntries
              files={section === "home" ? recentFiles : files}
              folders={section === "my-drive" ? folders : []}
              viewMode={viewMode}
              onOpenFolder={(folder) => setCurrentPath(folder.key)}
              onPreview={openPreview}
              onDelete={(key) => deleteMutation.mutate(key)}
              onShare={setShareFile}
            />
          )}
        </section>
      </div>

      {preview && <PreviewDialog preview={preview} onClose={closePreview} />}
      {folderDialogOpen && <FolderDialog folderName={folderName} onCancel={() => { setFolderDialogOpen(false); setFolderName(""); }} onCreate={() => void createFolder()} onNameChange={setFolderName} />}
      {shareFile && <ShareDialog client={client} file={shareFile} onClose={() => setShareFile(null)} />}
    </main>
  );
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

function Breadcrumbs({ currentPath, onNavigate }: { currentPath: string; onNavigate: (path: string) => void }) {
  const segments = currentPath ? currentPath.split("/") : [];
  return (
    <div className="flex flex-wrap items-center gap-1 text-sm text-slate-500">
      <button className="hover:text-blue-600" onClick={() => onNavigate("")}>My Drive</button>
      {segments.map((segment, index) => {
        const target = segments.slice(0, index + 1).join("/");
        return <span key={target}><span className="mx-1 text-slate-300">/</span><button className="hover:text-blue-600" onClick={() => onNavigate(target)}>{segment}</button></span>;
      })}
    </div>
  );
}

function DriveEntries({ files, folders, viewMode, onOpenFolder, onPreview, onDelete, onShare }: {
  files: DriveObject[];
  folders: DriveFolder[];
  viewMode: ViewMode;
  onOpenFolder: (folder: DriveFolder) => void;
  onPreview: (file: DriveObject) => void;
  onDelete: (key: string) => void;
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
          <button aria-label={`Share ${file.name}`} className="rounded-md p-2 text-slate-400 opacity-0 transition hover:bg-blue-50 hover:text-blue-600 group-hover:opacity-100 focus:opacity-100" onClick={() => onShare(file)}><Share2 size={17} /></button>
          <button aria-label={`Delete ${file.name}`} className="rounded-md p-2 text-slate-400 opacity-0 transition hover:bg-red-50 hover:text-red-600 group-hover:opacity-100 focus:opacity-100" onClick={() => onDelete(file.key)}><Trash2 size={17} /></button>
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

function ShareDialog({ client, file, onClose }: { client: DriveClient; file: DriveObject; onClose: () => void }) {
  const [access, setAccess] = useState<ShareAccess>("public");
  const [passcode, setPasscode] = useState("");
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
  return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4" role="dialog" aria-modal="true" aria-label={`Share ${file.name}`}><div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"><div className="flex items-start justify-between gap-4"><div><h2 className="text-lg font-semibold text-slate-900">Share {file.name}</h2><p className="mt-1 text-sm text-slate-500">Create a view-only link you can manage later.</p></div><button className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" onClick={onClose} aria-label="Close share dialog"><X size={20} /></button></div>{link ? <div className="mt-5"><p className="text-sm font-medium text-slate-700">Link ready</p><div className="mt-2 flex gap-2"><input className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm" value={link} readOnly /><button className="rounded-lg border border-slate-300 px-3 text-slate-700 hover:border-blue-300 hover:text-blue-700" onClick={() => void copyText(link, "Share link copied")} aria-label="Copy share link"><Copy size={18} /></button></div><button className="mt-5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700" onClick={onClose}>Done</button></div> : <div className="mt-5 space-y-4"><fieldset><legend className="text-sm font-medium text-slate-700">Who can open this link?</legend><div className="mt-2 grid grid-cols-2 gap-2"><label className={`rounded-lg border p-3 text-sm ${access === "public" ? "border-blue-500 bg-blue-50 text-blue-700" : "border-slate-200"}`}><input className="sr-only" type="radio" checked={access === "public"} onChange={() => setAccess("public")} />Anyone with link</label><label className={`rounded-lg border p-3 text-sm ${access === "passcode" ? "border-blue-500 bg-blue-50 text-blue-700" : "border-slate-200"}`}><input className="sr-only" type="radio" checked={access === "passcode"} onChange={() => setAccess("passcode")} />Passcode required</label></div></fieldset>{access === "passcode" && <input aria-label="Share passcode" className="w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" type="password" placeholder="Choose a secret passcode" value={passcode} onChange={(event) => setPasscode(event.target.value)} required />}<label className="block text-sm font-medium text-slate-700">Link expiry<select aria-label="Link expiry" className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5" value={ttl} onChange={(event) => setTtl(event.target.value)}><option value="never">Never expires</option><option value="1d">Expires in 1 day</option><option value="7d">Expires in 7 days</option><option value="30d">Expires in 30 days</option></select></label><button className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:bg-slate-300" disabled={mutation.isPending || (access === "passcode" && !passcode)} onClick={() => mutation.mutate()}>{mutation.isPending ? "Creating link…" : "Create share link"}</button></div>}</div></div>;
}

function SharedLinks({ shares, onCopy, onRevoke }: { shares: DriveShare[]; onCopy: (share: DriveShare) => void; onRevoke: (id: string) => void }) {
  if (shares.length === 0) return <EmptyState title="No active share links" description="Use the share button on a file to create a public or passcode-protected link." action="Go to My Drive" onAction={() => window.location.reload()} />;
  return <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">{shares.map((share) => <article key={share.id} className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-4 py-3 last:border-b-0"><span className="rounded-lg bg-blue-50 p-2 text-blue-600"><Share2 size={19} /></span><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-slate-800">{share.name}</p><p className="mt-0.5 text-xs text-slate-500">{share.access === "public" ? "Anyone with the link" : "Passcode protected"} · {share.expiresAt ? `Expires ${new Date(share.expiresAt).toLocaleString()}` : "No expiry"}</p></div><button className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-blue-700" onClick={() => onCopy(share)} aria-label={`Copy link for ${share.name}`}><Copy size={17} /></button><button className="rounded-lg px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50" onClick={() => onRevoke(share.id)}>Revoke</button></article>)}</div>;
}

function SharedFilePage({ client, shareId }: { client: SharedClient; shareId: string }) {
  const shareQuery = useQuery({ queryKey: ["public-share", shareId], queryFn: () => client.getPublicShare(shareId), retry: false });
  const [passcode, setPasscode] = useState("");
  const [preview, setPreview] = useState<{ object: DriveObject; url: string } | null>(null);
  const downloadMutation = useMutation({
    mutationFn: () => client.downloadShared(shareId, passcode || undefined),
    onSuccess: async (response) => {
      const share = shareQuery.data;
      if (!share) return;
      const url = URL.createObjectURL(await response.blob());
      setPreview({ object: { key: share.id, name: share.name, size: share.size, contentType: share.contentType, updatedAt: new Date().toISOString() }, url });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not open this shared file")
  });
  if (shareQuery.isPending) return <AuthLoading />;
  if (shareQuery.isError || !shareQuery.data) return <main className="grid min-h-screen place-items-center bg-[#f8faff] p-5 text-center"><div><h1 className="text-2xl font-semibold text-slate-900">This link is unavailable</h1><p className="mt-2 text-sm text-slate-500">It may have expired or been revoked.</p></div></main>;
  const share: PublicShare = shareQuery.data;
  return <main className="grid min-h-screen place-items-center bg-[#f8faff] p-5"><section className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-7 shadow-sm"><p className="text-sm font-medium text-blue-600">Zo Drive shared file</p><h1 className="mt-2 break-words text-2xl font-semibold text-slate-900">{share.name}</h1><p className="mt-2 text-sm text-slate-500">{formatBytes(share.size)} · {share.expiresAt ? `Available until ${new Date(share.expiresAt).toLocaleString()}` : "No expiry"}</p>{share.requiresPasscode && <label className="mt-6 block text-sm font-medium text-slate-700">Passcode<input aria-label="Shared file passcode" className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" type="password" value={passcode} onChange={(event) => setPasscode(event.target.value)} /></label>}<button className="mt-6 w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:bg-slate-300" disabled={downloadMutation.isPending || (share.requiresPasscode && !passcode)} onClick={() => downloadMutation.mutate()}>{downloadMutation.isPending ? "Opening…" : "Open shared file"}</button><button className="mt-3 w-full rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100" onClick={() => { window.location.href = "/"; }}>Open Zo Drive</button></section>{preview && <PreviewDialog preview={preview} onClose={() => { URL.revokeObjectURL(preview.url); setPreview(null); }} />}</main>;
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

function formatBytes(bytes: number): string {
  if (bytes < 1_024) return `${bytes} B`;
  if (bytes < 1_048_576) return `${(bytes / 1_024).toFixed(1)} KB`;
  return `${(bytes / 1_048_576).toFixed(1)} MB`;
}

function ttlToDate(ttl: string): string | null {
  const milliseconds = ttl === "1d" ? 24 * 60 * 60 * 1_000 : ttl === "7d" ? 7 * 24 * 60 * 60 * 1_000 : ttl === "30d" ? 30 * 24 * 60 * 60 * 1_000 : 0;
  return milliseconds ? new Date(Date.now() + milliseconds).toISOString() : null;
}

function shareLink(id: string): string {
  return `${window.location.origin}/?share=${encodeURIComponent(id)}`;
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
