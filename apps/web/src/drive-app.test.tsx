import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { DatabaseEngine, DatabaseEngineId, DriveDatabase } from "@zo-drive/types";

import { DriveApp, formulaDisplay } from "./drive-app.js";

Object.defineProperty(URL, "createObjectURL", { configurable: true, value: vi.fn(() => "blob:preview") });
Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() });

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  window.history.pushState({}, "", "/");
});

describe("DriveApp", () => {
  it("shows a public landing page with Drive and documentation entry points", () => {
    render(<DriveApp />);

    expect(screen.getByRole("heading", { name: "Your cloud should live with you." })).toBeInTheDocument();
    expect(screen.getByText("Decentralised cloud, on your Zo")).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Choose Zo Drive mode" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "GUI" })).toHaveAttribute("href", expect.stringContaining("?app=1"));
    expect(screen.getByRole("link", { name: "CLI" })).toHaveAttribute("href", expect.stringContaining("?docs=1&mode=cli"));
    expect(screen.getByRole("link", { name: "Sign in to Zo Drive" })).toHaveAttribute("href", expect.stringContaining("?login=1"));
    expect(screen.getByRole("link", { name: "Read the docs" })).toHaveAttribute("href", expect.stringContaining("?docs=1"));
    expect(screen.getByText("Zo Drive SaaS Killer Features")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open Zo Functions" })).toHaveAttribute("href", expect.stringContaining("section=functions"));
    expect(screen.getByRole("link", { name: "Open Zo Databases" })).toHaveAttribute("href", expect.stringContaining("section=databases"));
    expect(screen.getByRole("link", { name: "Open Zo Shared Drives" })).toHaveAttribute("href", expect.stringContaining("section=cluster-databases"));
    expect(screen.getByRole("link", { name: "Open ZominAI" })).toHaveAttribute("href", expect.stringContaining("section=zominai"));
    expect(screen.getByRole("link", { name: "Open Zo Functions" })).not.toHaveClass("col-span-2");
    expect(screen.getByRole("link", { name: "Open Zo Databases" })).not.toHaveClass("col-span-2");
    expect(screen.getByRole("heading", { name: "Automations that live beside your data." })).toBeInTheDocument();
  });

  it("documents separate GUI and CLI workflows", () => {
    const originalPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    try {
      window.history.pushState({}, "", "?docs=1&mode=gui");
      render(<DriveApp />);

      expect(screen.getByRole("heading", { name: "Manage files in your private Drive." })).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "Share files on your terms" })).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "GUI version 1.23.7" })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Landing page" })).toHaveAttribute("href", "/");
      expect(screen.getByRole("link", { name: "GUI changelog version 1.23.7" })).toHaveAttribute("href", expect.stringContaining("?docs=1&mode=gui&page=changelog"));
      expect(screen.getByRole("heading", { name: "GUI changelog" })).toBeInTheDocument();
      expect(screen.getByText((_, element) => element?.tagName === "H3" && element.textContent === "GUI v1.17.0")).toBeInTheDocument();
      expect(screen.getAllByRole("link", { name: "GUI" })[0]).toHaveAttribute("aria-current", "page");

      cleanup();
      window.history.pushState({}, "", "?docs=1&mode=cli");
      render(<DriveApp />);

      expect(screen.getByRole("heading", { name: "Upload from your machine." })).toBeInTheDocument();
      expect(screen.getAllByRole("link", { name: "CLI" })[0]).toHaveAttribute("aria-current", "page");
      expect(screen.getByRole("heading", { name: "Install zo-drive on your machine" })).toBeInTheDocument();
      expect(screen.getByText(/npm link inside apps\/cli/)).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "Connect your local computer to Zo" })).toBeInTheDocument();
      expect(screen.getByText(/Zo Drive API key: \[input hidden\]/)).toBeInTheDocument();
      expect(screen.getAllByText(/zo-drive configure/).length).toBeGreaterThanOrEqual(3);
      expect(screen.getByText(/without exposing either in shell history/)).toBeInTheDocument();
      expect(screen.getByText(/You do not need SSH, Tailscale/)).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "CLI version 1.2.1" })).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "CLI changelog" })).toBeInTheDocument();
      expect(screen.getByText("CLI v1.2.0")).toBeInTheDocument();
      expect(screen.getAllByText(/zo-drive exists/).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(/zo-drive health/).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(/zo-drive stat/).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(/zo-drive mv/).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(/zo-drive rm/).length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText(/cli-v Git release tag/)).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "Automate uploads in code" })).toBeInTheDocument();
      expect(screen.getAllByText(/@zo-drive\/sdk/).length).toBeGreaterThanOrEqual(1);

      cleanup();
      window.history.pushState({}, "", "?docs=1&mode=gui&page=changelog");
      render(<DriveApp />);

      expect(screen.getByRole("heading", { name: "GUI changelog" })).toBeInTheDocument();
      expect(screen.getByText("Latest: v1.23.7")).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Documentation" })).toHaveAttribute("href", expect.stringContaining("?docs=1&mode=gui"));

      cleanup();
      window.history.pushState({}, "", "?docs=1&mode=cli&page=changelog");
      render(<DriveApp />);

      expect(screen.getByRole("heading", { name: "CLI changelog" })).toBeInTheDocument();
      expect(screen.getAllByText("CLI v1.2.0").length).toBeGreaterThanOrEqual(1);
    } finally {
      window.history.pushState({}, "", originalPath);
    }
  });

  it("calculates safe spreadsheet formulas", () => {
    expect(formulaDisplay("=SUM(A1:A3)+B1", { A1: "2", A2: "=A1*3", A3: "4", B1: "1" })).toBe("13");
    expect(formulaDisplay("=A1/A2", { A1: "8", A2: "2" })).toBe("4");
    expect(formulaDisplay("=NOT_A_FORMULA()", {})).toBe("#ERROR");
  });

  it("shows owner registration instead of the drive when no account exists", async () => {
    const authClient = {
      getAuthStatus: vi.fn().mockResolvedValue({ authenticated: false, registrationAllowed: true, user: null }),
      login: vi.fn(),
      logout: vi.fn(),
      registerInitialUser: vi.fn(),
      updateProfile: vi.fn(),
      changePassword: vi.fn(),
      deleteAccount: vi.fn()
    };

    render(<DriveApp authClient={authClient} />);

    expect(await screen.findByText("Create your owner account")).toBeInTheDocument();
    expect(screen.queryByText("My Drive")).not.toBeInTheDocument();
  });

  it("keeps the landing page public when an unauthenticated visitor opens the workspace URL", async () => {
    const authClient = {
      getAuthStatus: vi.fn().mockResolvedValue({ authenticated: false, registrationAllowed: false, user: null }),
      login: vi.fn(),
      logout: vi.fn(),
      registerInitialUser: vi.fn(),
      updateProfile: vi.fn(),
      changePassword: vi.fn(),
      deleteAccount: vi.fn()
    };

    window.history.pushState({}, "", "?app=1");
    render(<DriveApp authClient={authClient} />);

    expect(await screen.findByRole("heading", { name: "Your cloud should live with you." })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Sign in to Zo Drive" })).not.toBeInTheDocument();
    expect(authClient.getAuthStatus).toHaveBeenCalledTimes(1);
  });

  it("opens the sign-in form only from the dedicated login route", async () => {
    const authClient = {
      getAuthStatus: vi.fn().mockResolvedValue({ authenticated: false, registrationAllowed: false, user: null }),
      login: vi.fn(),
      logout: vi.fn(),
      registerInitialUser: vi.fn(),
      updateProfile: vi.fn(),
      changePassword: vi.fn(),
      deleteAccount: vi.fn()
    };

    window.history.pushState({}, "", "?login=1");
    render(<DriveApp authClient={authClient} />);

    expect(await screen.findByRole("heading", { name: "Sign in to Zo Drive" })).toBeInTheDocument();
  });

  it("renders documentation without checking the visitor's sign-in session", () => {
    const authClient = {
      getAuthStatus: vi.fn(),
      login: vi.fn(),
      logout: vi.fn(),
      registerInitialUser: vi.fn(),
      updateProfile: vi.fn(),
      changePassword: vi.fn(),
      deleteAccount: vi.fn()
    };

    window.history.pushState({}, "", "?docs=1&mode=gui");
    render(<DriveApp authClient={authClient} />);

    expect(screen.getByRole("heading", { name: "Manage files in your private Drive." })).toBeInTheDocument();
    expect(authClient.getAuthStatus).not.toHaveBeenCalled();
  });

  it("shows storage usage, folders, and files supplied by the shared SDK", async () => {
    let sqliteInstalled = false;
    const client = {
      list: vi.fn().mockResolvedValue([
        { key: "Notes/hello.txt", name: "hello.txt", size: 5, contentType: "text/plain", updatedAt: "2026-01-01T00:00:00.000Z" },
        { key: "photo.jpg", name: "photo.jpg", size: 10, contentType: "image/jpeg", updatedAt: "2026-01-01T00:00:00.000Z" },
        { key: "guide.pdf", name: "guide.pdf", size: 20, contentType: "application/pdf", updatedAt: "2026-01-01T00:00:00.000Z" }
      ]),
      getUsage: vi.fn().mockResolvedValue({ fileCount: 28, usedBytes: 15, quotaBytes: 100 * 1024 * 1024 * 1024, quotaAvailableBytes: 100 * 1024 * 1024 * 1024 - 15, minQuotaBytes: 1024 * 1024 * 1024, maxQuotaBytes: Math.floor(512 * 1024 * 1024 * 1024 * 0.8), totalBytes: 512 * 1024 * 1024 * 1024, availableBytes: 512 * 1024 * 1024 * 1024 - 200, systemUsedBytes: 200, categories: [{ id: "photos", bytes: 10, fileCount: 1 }, { id: "documents", bytes: 5, fileCount: 1 }, { id: "videos", bytes: 0, fileCount: 0 }, { id: "audio", bytes: 0, fileCount: 0 }, { id: "archives", bytes: 0, fileCount: 0 }, { id: "other", bytes: 0, fileCount: 0 }, { id: "trash", bytes: 0, fileCount: 4 }, { id: "databases", bytes: 0, fileCount: 8 }, { id: "functions", bytes: 0, fileCount: 3 }, { id: "zo-originals", bytes: 0, fileCount: 11 }] }),
      listFolders: vi.fn().mockResolvedValue([{ key: "Notes", name: "Notes", updatedAt: "2026-01-01T00:00:00.000Z" }]),
      listStarred: vi.fn().mockResolvedValue([{ key: "photo.jpg", name: "photo.jpg", size: 10, contentType: "image/jpeg", updatedAt: "2026-01-01T00:00:00.000Z", starred: true }]),
      listTrash: vi.fn().mockResolvedValue([]),
      createFolder: vi.fn(),
      createNativeFile: vi.fn().mockResolvedValue({ key: "Strategy", name: "Strategy", size: 1, contentType: "application/vnd.zo.document+json", nativeType: "document", updatedAt: "2026-01-01T00:00:00.000Z", starred: false }),
      saveNativeFile: vi.fn().mockResolvedValue({ key: "Strategy", name: "Strategy", size: 1, contentType: "application/vnd.zo.document+json", nativeType: "document", updatedAt: "2026-01-01T00:00:00.000Z", starred: false }),
      setQuota: vi.fn().mockResolvedValue({ fileCount: 2, usedBytes: 15, quotaBytes: 200 * 1024 * 1024 * 1024, quotaAvailableBytes: 200 * 1024 * 1024 * 1024 - 15, minQuotaBytes: 1024 * 1024 * 1024, maxQuotaBytes: Math.floor(512 * 1024 * 1024 * 1024 * 0.8), totalBytes: 512 * 1024 * 1024 * 1024, availableBytes: 512 * 1024 * 1024 * 1024 - 200, systemUsedBytes: 200, categories: [{ id: "photos", bytes: 10, fileCount: 1 }, { id: "documents", bytes: 5, fileCount: 1 }, { id: "videos", bytes: 0, fileCount: 0 }, { id: "audio", bytes: 0, fileCount: 0 }, { id: "archives", bytes: 0, fileCount: 0 }, { id: "other", bytes: 0, fileCount: 0 }, { id: "trash", bytes: 0, fileCount: 0 }] }),
      publishForm: vi.fn(),
      listFormResponses: vi.fn().mockResolvedValue([]),
      rename: vi.fn().mockResolvedValue({ key: "Strategy 2026", name: "Strategy 2026", size: 1, contentType: "application/vnd.zo.document+json", nativeType: "document", updatedAt: "2026-01-01T00:00:00.000Z", starred: false }),
      createShare: vi.fn().mockResolvedValue({ id: "transfer-123", key: "photo.jpg", name: "photo.jpg", size: 10, contentType: "image/jpeg", access: "public", kind: "transfer", expiresAt: null, createdAt: "2026-01-01T00:00:00.000Z" }),
      upload: vi.fn(),
      delete: vi.fn(),
      restoreTrash: vi.fn(),
      permanentlyDeleteTrash: vi.fn(),
      emptyTrash: vi.fn(),
      download: vi.fn((key: string) => Promise.resolve(key === "Strategy" ? new Response(JSON.stringify({ format: "zo-native", type: "document", version: 1, blocks: [] }), { headers: { "content-type": "application/vnd.zo.document+json" } }) : new Response(new Blob(["image bytes"], { type: "image/jpeg" })))),
      star: vi.fn(),
      unstar: vi.fn(),
      updateSharePasscode: vi.fn(),
      listShares: vi.fn().mockResolvedValue([{ id: "share-123", key: "photo.jpg", name: "photo.jpg", size: 10, contentType: "image/jpeg", access: "passcode", kind: "share", expiresAt: null, createdAt: "2026-01-01T00:00:00.000Z" }]),
      revokeShare: vi.fn(),
      createApiKey: vi.fn(),
      listApiKeys: vi.fn().mockResolvedValue([]),
      revokeApiKey: vi.fn(),
      createClusterInvitation: vi.fn().mockResolvedValue({ id: "11111111-1111-4111-8111-111111111111", folder: "Projects/Shared", role: "editor", recipient: null, createdAt: "2026-07-21T00:00:00.000Z", expiresAt: "2026-07-21T00:15:00.000Z", token: "zci_11111111111141118111111111111111_example" }),
      createClusterMount: vi.fn(),
      createClusterFolder: vi.fn(),
      deleteClusterInvitation: vi.fn(),
      deleteClusterMount: vi.fn(),
      deleteClusterObject: vi.fn(),
      deleteClusterPeer: vi.fn(),
      downloadClusterObject: vi.fn(),
      getClusterMountAccess: vi.fn().mockResolvedValue({ role: "editor" }),
      listClusterInvitations: vi.fn().mockResolvedValue([{ id: "22222222-2222-4222-8222-222222222222", folder: "Notes", role: "viewer", recipient: "Maya", createdAt: "2026-07-21T00:00:00.000Z", expiresAt: "2026-07-21T00:15:00.000Z" }]),
      listClusterMounts: vi.fn().mockResolvedValue([{ id: "33333333-3333-4333-8333-333333333333", remoteUrl: "https://alice.example/drive", remotePeerId: "44444444-4444-4444-8444-444444444444", folder: "Team plans", role: "viewer", recipient: null, author: "alice", createdAt: "2026-07-21T00:00:00.000Z" }]),
      listClusterObjects: vi.fn().mockResolvedValue([{ key: "remote-plan.pdf", name: "remote-plan.pdf", size: 42, contentType: "application/pdf", updatedAt: "2026-07-21T01:00:00.000Z", starred: false }]),
      listClusterPeers: vi.fn().mockResolvedValue([]),
      renameClusterObject: vi.fn(),
      updateClusterPeerRole: vi.fn(),
      uploadClusterObject: vi.fn(),
      listDatabases: vi.fn<() => Promise<DriveDatabase[]>>().mockResolvedValue([{ id: "db-11111111-1111-4111-8111-111111111111", name: "app-data", engine: "sqlite", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z", sizeBytes: 4096 }]),
      listDatabaseEngines: vi.fn<() => Promise<DatabaseEngine[]>>(() => Promise.resolve([{ engine: "sqlite", name: "SQLite", packageName: "sqlite", availableVersion: "3.0.0", installedVersion: sqliteInstalled ? "3.0.0" : null, protocol: "sql", installed: sqliteInstalled, installedAt: sqliteInstalled ? "2026-07-20T00:00:00.000Z" : null, updatedAt: null, updateAvailable: false, workspaceAvailable: true }])),
      installDatabaseEngine: vi.fn((engine: DatabaseEngineId) => { if (engine === "sqlite") sqliteInstalled = true; return Promise.resolve({ engine, name: engine === "sqlite" ? "SQLite" : "Redis", packageName: engine, availableVersion: "3.0.0", installedVersion: "3.0.0", protocol: "sql" as const, installed: true, installedAt: "2026-07-20T00:00:00.000Z", updatedAt: null, updateAvailable: false, workspaceAvailable: engine === "sqlite" }); }),
      updateDatabaseEngine: vi.fn((engine: DatabaseEngineId) => Promise.resolve({ engine, name: engine === "sqlite" ? "SQLite" : "Redis", packageName: engine, availableVersion: "3.0.0", installedVersion: "3.0.0", protocol: "sql" as const, installed: true, installedAt: "2026-07-20T00:00:00.000Z", updatedAt: "2026-07-21T00:00:00.000Z", updateAvailable: false, workspaceAvailable: engine === "sqlite" })),
      createDatabase: vi.fn(),
      deleteDatabase: vi.fn(),
      importDatabase: vi.fn(),
      exportDatabase: vi.fn().mockResolvedValue(new Blob(["sqlite database"])),
      getDatabaseImportSettings: vi.fn().mockResolvedValue({ importLimitBytes: 100 * 1024 * 1024, minImportLimitBytes: 1024 * 1024, maxImportLimitBytes: 100 * 1024 * 1024 * 1024 }),
      setDatabaseImportLimit: vi.fn(),
      listDatabaseApiKeys: vi.fn().mockResolvedValue([]),
      createDatabaseApiKey: vi.fn().mockResolvedValue({ id: "key-11111111-1111-4111-8111-111111111111", databaseId: "db-11111111-1111-4111-8111-111111111111", name: "Production backend", prefix: "zdb_test", scopes: ["read", "write"], createdAt: "2026-01-01T00:00:00.000Z", expiresAt: null, lastUsedAt: null, apiKey: "zdb_test_value" }),
      revokeDatabaseApiKey: vi.fn(),
      listDatabaseTables: vi.fn().mockResolvedValue([{ name: "tasks", schema: "CREATE TABLE tasks (id INTEGER PRIMARY KEY, title TEXT)" }]),
      listDatabaseRows: vi.fn().mockResolvedValue({ columns: ["id", "title"], rows: [{ id: 1, title: "Ship Database Engines" }], total: 1 }),
      queryDatabase: vi.fn().mockResolvedValue({ columns: ["title"], rows: [{ title: "Ship Database Engines" }], changes: 0, lastInsertRowid: null }),
      executeDatabase: vi.fn().mockResolvedValue({ engine: "redis", result: "PONG" }),
      listFunctions: vi.fn().mockResolvedValue([{ id: "fn-11111111-1111-4111-8111-111111111111", name: "greet", runtime: "javascript", source: "export default async function handler(input) { return input; }", visibility: "private", cron: null, enabled: true, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z", lastRunAt: null, lastRunStatus: null }]),
      createFunction: vi.fn(),
      updateFunction: vi.fn(),
      deleteFunction: vi.fn(),
      runFunction: vi.fn(),
      listFunctionRuns: vi.fn().mockResolvedValue([{ id: "run-11111111-1111-4111-8111-111111111111", functionId: "fn-11111111-1111-4111-8111-111111111111", startedAt: "2026-07-21T00:00:00.000Z", finishedAt: "2026-07-21T00:00:00.143Z", status: "success", output: { greeting: "Hello, Zo" }, logs: "", trigger: "manual" }])
    };

    const authClient = {
      getAuthStatus: vi.fn().mockResolvedValue({ authenticated: true, registrationAllowed: false, user: { id: "owner", username: "sayyid" } }),
      login: vi.fn(),
      logout: vi.fn(),
      registerInitialUser: vi.fn(),
      updateProfile: vi.fn(),
      changePassword: vi.fn(),
      deleteAccount: vi.fn()
    };

    render(<DriveApp client={client} authClient={authClient} />);

    expect(await screen.findByRole("link", { name: "Back to Zo Drive landing page" })).toHaveAttribute("href", "/");
    expect(screen.getByText("2 files")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign out" })).toHaveAttribute("title", "Sign out");
    expect(screen.getByRole("button", { name: "ZominAI" })).toHaveAttribute("title", "Open ZominAI chat");
    expect(screen.getByTestId("search-controls")).toHaveClass("order-3", "basis-full");
    expect(screen.getByTestId("search-controls")).toContainElement(screen.getByRole("textbox", { name: "Search files" }));
    expect(screen.getByTestId("search-controls")).toContainElement(screen.getByRole("button", { name: "Advanced search" }));
    expect(screen.getByTestId("header-actions")).toHaveClass("order-2", "ml-auto");
    expect(screen.getByTestId("header-actions")).toContainElement(screen.getByRole("button", { name: "ZominAI" }));
    expect(screen.getByTestId("header-actions")).toContainElement(screen.getByRole("button", { name: "Account menu" }));
    expect(screen.getByTestId("header-actions")).toContainElement(screen.getByRole("button", { name: "Sign out" }));
    expect(screen.getByTestId("drive-workspace")).toHaveClass("h-dvh", "overflow-hidden");
    expect(document.getElementById("drive-navigation")).toHaveClass("md:overflow-hidden");
    expect(screen.getByTestId("storage-card")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Collapse navigation" }));
    expect(screen.getByRole("button", { name: "New" })).toHaveAttribute("title", "New");
    expect(screen.getByRole("button", { name: "My Drive" })).toHaveAttribute("title", "My Drive");
    expect(screen.getByRole("button", { name: "Zo Databases" })).toHaveAttribute("title", "Zo Databases");
    expect(screen.getByRole("button", { name: "Zo Shared Drives" })).toHaveAttribute("title", "Zo Shared Drives");
    expect(screen.getByRole("button", { name: "New" })).toHaveAttribute("data-tooltip", "New");
    expect(screen.getByRole("button", { name: "Recent" })).toHaveAttribute("data-tooltip", "Recent");
    expect(screen.getByRole("button", { name: "Zo Databases" })).toHaveAttribute("data-tooltip", "Zo Databases");
    expect(screen.getByRole("button", { name: "Zo Shared Drives" })).toHaveAttribute("data-tooltip", "Zo Shared Drives");
    expect(screen.getByRole("button", { name: "Zo Databases" })).toHaveClass("after:content-[attr(data-tooltip)]");
    expect(screen.getByRole("button", { name: "Zo Shared Drives" })).toHaveClass("after:content-[attr(data-tooltip)]");
    fireEvent.click(screen.getByRole("button", { name: "Expand navigation" }));
    expect(screen.getByRole("button", { name: "New" })).toBeInTheDocument();
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      if (String(input).includes("/zominai/status")) {
        return new Response(JSON.stringify({ state: "ready", downloadedBytes: 1, expectedBytes: 1, progress: 1, detail: "Ready", updatedAt: "2026-07-21T00:00:00.000Z" }), { status: 200 });
      }
      if (String(input).includes("/v1/chat/completions")) {
        return new Response(JSON.stringify({ choices: [{ message: { content: "Hello from your local Bonsai runtime." } }] }), { status: 200 });
      }
      throw new Error("Unavailable local service");
    });
    fireEvent.click(screen.getByRole("button", { name: "ZominAI" }));
    const zominAiDrawer = await screen.findByRole("complementary", { name: "ZominAI chat" });
    expect(zominAiDrawer).toHaveClass("md:relative", "md:w-[var(--zominai-drawer-width)]", "md:border-l", "md:border-slate-200", "duration-500");
    expect(screen.getByRole("button", { name: "Resize ZominAI chat" })).toHaveClass("w-5", "cursor-col-resize", "group");
    expect(screen.getAllByAltText("ZominAI Pegasus")).toHaveLength(2);
    expect(screen.getByRole("button", { name: "New ZominAI chat" })).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "ZominAI chat history" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Toggle ZominAI chat history" })).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByRole("button", { name: "Open upload menu" })).toHaveClass("md:inline-flex");
    expect(screen.getByTestId("dashboard-actions")).toContainElement(screen.getByRole("button", { name: "Open upload menu" }));
    expect(screen.getByTestId("dashboard-actions")).toContainElement(screen.getByRole("button", { name: "List view" }));
    fireEvent.click(screen.getByRole("button", { name: "Toggle ZominAI chat history" }));
    expect(screen.getByRole("navigation", { name: "ZominAI chat history" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Toggle ZominAI chat history" })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("textbox", { name: "Message ZominAI" })).toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox", { name: "Message ZominAI" }), { target: { value: "Hello ZominAI" } });
    fireEvent.click(screen.getByRole("button", { name: "Send message to ZominAI" }));
    expect(await screen.findByText("Hello from your local Bonsai runtime.")).toBeInTheDocument();
    expect(fetchSpy).toHaveBeenCalledWith("http://127.0.0.1:57183/v1/chat/completions", expect.objectContaining({ method: "POST" }));
    expect(window.localStorage.getItem("zo-drive:zominai:chats:v1")).toContain("Hello ZominAI");
    fireEvent.click(screen.getByRole("button", { name: "New ZominAI chat" }));
    expect(screen.getByText("Ask about your Drive")).toBeInTheDocument();
    fetchSpy.mockReset();
    fetchSpy
      .mockResolvedValueOnce(new Response(JSON.stringify({ choices: [{ message: { content: "", tool_calls: [{ id: "drive-list", function: { name: "list_drive", arguments: "{}" } }] } }] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ choices: [{ message: { content: "Your Drive has the files I found." } }] }), { status: 200 }));
    fireEvent.change(screen.getByRole("textbox", { name: "Message ZominAI" }), { target: { value: "What is in my Drive?" } });
    fireEvent.click(screen.getByRole("button", { name: "Send message to ZominAI" }));
    expect(await screen.findByText("Your Drive has the files I found.")).toBeInTheDocument();
    expect(client.list).toHaveBeenCalledWith({ prefix: undefined });
    const toolFollowUp = JSON.parse(String(fetchSpy.mock.calls[1]?.[1]?.body)) as { messages: Array<{ role: string; tool_call_id?: string }> };
    expect(toolFollowUp.messages).toEqual(expect.arrayContaining([expect.objectContaining({ role: "tool", tool_call_id: "drive-list" })]));
    fireEvent.click(screen.getByRole("button", { name: "ZominAI" }));
    expect(screen.queryByRole("complementary", { name: "ZominAI chat" })).not.toBeInTheDocument();
    fetchSpy.mockResolvedValue(new Response(JSON.stringify({ state: "downloading", downloadedBytes: 1, expectedBytes: 2, progress: 0.5, detail: "Downloading", updatedAt: "2026-07-21T00:00:00.000Z" }), { status: 200 }));
    fireEvent.click(screen.getByRole("button", { name: "ZominAI" }));
    expect(await screen.findByRole("heading", { name: "Install Bonsai where you use it." })).toBeInTheDocument();
    fetchSpy.mockRestore();
    fireEvent.click(screen.getByRole("button", { name: "Account menu" }));
    expect(screen.getByRole("link", { name: "Landing page" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "Documentation" })).toHaveAttribute("href", expect.stringContaining("?docs=1&mode=gui"));
    expect(screen.getByRole("button", { name: "ZominAI settings" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "ZominAI settings" }));
    expect((await screen.findAllByRole("heading", { name: "ZominAI settings" })).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole("heading", { name: /ZominAI Pronounced ZOH-min A\.I\./ })).toBeInTheDocument();
    expect(screen.getByText("Inspired by Google Gemini.")).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "ZominAI resources" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /PrismML overview/ })).toHaveAttribute("href", "https://prismml.com/");
    expect(screen.getByRole("link", { name: /Bonsai model & licence/ })).toHaveAttribute("href", "https://huggingface.co/prism-ml/Bonsai-27B-gguf");
    expect(screen.getByRole("link", { name: /Runtime installation docs/ })).toHaveAttribute("href", "https://github.com/ggml-org/llama.cpp/blob/master/docs/install.md");
    expect(screen.getByRole("button", { name: "ZominAI menu: Verify install" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "ZominAI menu: Talk to ZominAI" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "ZominAI menu: Install ZominAI" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "ZominAI menu: ZominAI settings" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "ZominAI menu: Uninstall ZominAI" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "ZominAI menu: Install ZominAI" }));
    expect(screen.getByRole("group", { name: "ZominAI platform" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "macOS" }));
    expect(screen.getByRole("button", { name: "macOS" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText(/The model is cached locally at/)).toHaveTextContent("models--prism-ml--Bonsai-27B-gguf");
    fireEvent.click(screen.getByRole("button", { name: "Windows" }));
    expect(screen.getByText("Windows setup")).toBeInTheDocument();
    expect(screen.getByText((_, element) => element?.tagName === "CODE" && element.textContent?.includes("winget install llama.cpp") === true)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Linux" }));
    expect(screen.getByText("Linux setup")).toBeInTheDocument();
    expect(screen.getByText(/CPU-only Linux is not a supported experience/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open Bonsai download" })).toHaveAttribute("href", "https://huggingface.co/prism-ml/Bonsai-27B-gguf");
    expect(screen.getByRole("link", { name: /PrismML overview/ })).toHaveAttribute("href", "https://prismml.com/");
    expect(screen.getByRole("link", { name: /Bonsai model & licence/ })).toHaveAttribute("href", "https://huggingface.co/prism-ml/Bonsai-27B-gguf");
    expect(screen.getByRole("link", { name: /Runtime installation docs/ })).toHaveAttribute("href", "https://github.com/ggml-org/llama.cpp/blob/master/docs/install.md");
    fireEvent.click(screen.getByRole("button", { name: "ZominAI menu: ZominAI settings" }));
    fireEvent.change(screen.getByRole("textbox", { name: "ZominAI runtime address" }), { target: { value: "http://127.0.0.1:9000" } });
    await waitFor(() => expect(window.localStorage.getItem("zo-drive:zominai:v1")).toContain("9000"));
    fireEvent.click(screen.getByRole("button", { name: "ZominAI menu: Uninstall ZominAI" }));
    fireEvent.click(screen.getByRole("button", { name: "Uninstall ZominAI browser settings" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm uninstall ZominAI" }));
    await waitFor(() => expect(window.localStorage.getItem("zo-drive:zominai:v1")).toBeNull());
    fireEvent.click(screen.getByRole("button", { name: "Account menu" }));
    fireEvent.click(screen.getByRole("button", { name: "API Keys" }));
    expect(await screen.findByRole("heading", { name: "API Keys" })).toBeInTheDocument();
    expect(screen.getByText("Zo Drive URL")).toBeInTheDocument();
    expect(screen.getByText("http://localhost:3000/")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy Zo Drive URL" })).toBeInTheDocument();
    for (const expiry of ["10 minutes", "1 hour", "12 hours", "1 day", "7 days", "10 days", "14 days"]) {
      expect(screen.getByRole("option", { name: expiry })).toBeInTheDocument();
    }
    expect(screen.queryByRole("button", { name: "API Keys" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "List view" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Grid view" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Zo Databases" }));
    expect(await screen.findByRole("heading", { name: "Zo Databases" })).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "Build with Zo Databases" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /View your databases/ })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Zo Shared Drives" }));
    expect(await screen.findByRole("heading", { name: "Zo Shared Drives" })).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "Create shared drives with people you trust." })).toBeInTheDocument();
    expect(screen.getByText("Inspired by Synology NAS Drive.")).toBeInTheDocument();
    expect(screen.getByText("Recursive scope")).toBeInTheDocument();
    expect(screen.getByText("Shared with me")).toBeInTheDocument();
    expect(await screen.findByText("Shared by alice")).toBeInTheDocument();
    expect(screen.getByText("Read only")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Exposed folders" })).toBeInTheDocument();
    expect(screen.getByText("Pending pairing keys")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel key" })).toBeInTheDocument();
    fireEvent.click(await screen.findByLabelText("Share folder Notes"));
    fireEvent.click(screen.getByRole("button", { name: "Create 1 pairing key" }));
    await waitFor(() => expect(client.createClusterInvitation).toHaveBeenCalledWith({ folder: "Notes", role: "editor", recipient: null }));
    fireEvent.click(screen.getByRole("tab", { name: "Join a shared Drive" }));
    expect(screen.getByText(/this does not expose any of your folders/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Zo Functions" }));
    expect(await screen.findByRole("heading", { name: "Zo Functions" })).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "Run small jobs without another service." })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Editor" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("group", { name: "Function editor actions" })).toHaveClass("justify-end");
    expect(screen.getByRole("button", { name: "Save changes" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Invocation timeline" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "Function runs" }));
    expect(await screen.findByRole("heading", { name: "Test run" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Recent runs" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "Logs" }));
    expect(await screen.findByRole("heading", { name: "Invocation timeline" })).toBeInTheDocument();
    const invocation = await screen.findByRole("button", { name: /Run now from Zo Drive/ });
    expect(invocation).toHaveTextContent("Took 143 ms");
    expect(invocation).toHaveTextContent('Result: {"greeting":"Hello, Zo"}');
    fireEvent.click(invocation);
    expect(screen.getByText("Function output")).toBeInTheDocument();
    expect(screen.getAllByText((_, element) => element?.tagName === "CODE" && element.textContent?.includes('"greeting": "Hello, Zo"') === true).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("tab", { name: "Editor" }));
    fireEvent.click(screen.getByRole("button", { name: /Public endpoint/ }));
    expect(screen.getByText("/public/functions/fn-11111111-1111-4111-8111-111111111111/invoke", { exact: false })).toBeInTheDocument();
    expect(screen.getByText("Save changes to activate this endpoint publicly.")).toBeInTheDocument();
    expect(screen.getByLabelText("Public function request body")).toHaveTextContent('"input": {');
    expect(screen.getByText(/Send parameters inside/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open crontab.guru cron helper" })).toHaveAttribute("href", "https://crontab.guru/");

    fireEvent.click(screen.getByRole("button", { name: "Zo Databases" }));
    expect(await screen.findByRole("heading", { name: "Zo Databases" })).toBeInTheDocument();
    expect(screen.getByText("Open-source database catalog")).toBeInTheDocument();
    expect(screen.getByText("DuckDB")).toBeInTheDocument();
    expect(screen.getByText("Redis")).toBeInTheDocument();
    expect(screen.getByText("Kuzu")).toBeInTheDocument();
    expect(screen.getByText("LanceDB")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Install Redis" }));
    await waitFor(() => expect(client.installDatabaseEngine).toHaveBeenCalledWith("redis"));
    expect(await screen.findByRole("button", { name: "Create Redis database" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Update Redis" })).toBeInTheDocument();
    expect(screen.getByTestId("database-engine-actions-redis")).toHaveClass("grid", "grid-cols-[minmax(0,1fr)_2.75rem]");
    expect(screen.getByTestId("database-engine-actions-duckdb").querySelector("button")).toHaveClass("w-full");
    fireEvent.click(screen.getByRole("button", { name: "Install SQLite" }));
    await waitFor(() => expect(client.installDatabaseEngine).toHaveBeenCalledWith("sqlite"));
    fireEvent.click(await screen.findByRole("button", { name: "Create SQLite database" }));
    expect(screen.getByRole("heading", { name: "Your instances" }).closest("aside")?.parentElement).toHaveClass("mt-8");
    expect(screen.getByRole("button", { name: "Import SQLite file" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Import limit: 100.0 MB" })).toBeInTheDocument();
    fireEvent.click(await screen.findByRole("button", { name: /app-data sqlite/i }));
    expect(await screen.findByRole("button", { name: "Back to your databases" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Your instances" })).not.toBeInTheDocument();
    expect(await screen.findByText("tasks")).toBeInTheDocument();
    expect(await screen.findByText("Ship Database Engines")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Export" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "SQL editor" }));
    fireEvent.click(screen.getByRole("button", { name: "Run query" }));
    await waitFor(() => expect(client.queryDatabase).toHaveBeenCalledWith(expect.objectContaining({ id: "db-11111111-1111-4111-8111-111111111111" })));
    fireEvent.click(screen.getByRole("button", { name: "Backend access" }));
    expect(await screen.findByRole("heading", { name: "Connect from your backend" })).toBeInTheDocument();
    expect(screen.getByText("Query endpoint")).toBeInTheDocument();
    expect(screen.getByText("Node.js example")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "My Drive" }));
    const notes = await screen.findByText("Notes");
    expect(notes).toBeInTheDocument();
    expect(screen.getByText("photo.jpg")).toBeInTheDocument();
    expect(screen.getByTestId("drive-entries")).toHaveClass("w-full", "min-w-0", "max-w-full");
    expect(screen.getByText("15 B used of 100.0 GB")).toBeInTheDocument();
    fireEvent.click(screen.getByText("guide.pdf"));
    expect(await screen.findByRole("dialog", { name: "Preview guide.pdf" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "View PDF full screen" }));
    expect(await screen.findByRole("dialog", { name: "Full screen PDF guide.pdf" })).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(await screen.findByRole("dialog", { name: "Preview guide.pdf" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Close preview" }));
    fireEvent.click(screen.getByRole("button", { name: "View storage breakdown" }));
    expect(await screen.findByRole("dialog", { name: "Storage breakdown" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Storage breakdown content" })).toHaveClass("overflow-y-auto");
    expect(screen.getByText("Photos")).toBeInTheDocument();
    expect(screen.getByText(/Zo system files & other machine data/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Set storage limit to 200 GB" }));
    await waitFor(() => expect(client.setQuota).toHaveBeenCalledWith(200 * 1024 * 1024 * 1024));
    fireEvent.click(screen.getByRole("button", { name: "Close storage breakdown" }));

    fireEvent.click(screen.getByRole("button", { name: /Zo Transfer/ }));
    expect(await screen.findByRole("heading", { name: "Zo Transfer" })).toBeInTheDocument();
    expect(screen.getByText("Send a file with Zo Transfer")).toBeInTheDocument();
    expect(screen.getByText("Payment-gated downloads are not enabled yet.")).toBeInTheDocument();
    await waitFor(() => expect(client.list).toHaveBeenCalledWith({}));
    fireEvent.click(screen.getByText("photo.jpg"));
    fireEvent.click(screen.getByRole("button", { name: "Create public link" }));
    await waitFor(() => expect(client.createShare).toHaveBeenCalledWith(expect.objectContaining({ access: "public", key: "photo.jpg", kind: "transfer" })));
    fireEvent.click(screen.getByText("Passcode"));
    fireEvent.change(screen.getByLabelText("Transfer passcode"), { target: { value: "transfer-secret" } });
    fireEvent.click(screen.getByRole("button", { name: "Create protected link" }));
    await waitFor(() => expect(client.createShare).toHaveBeenLastCalledWith(expect.objectContaining({ access: "passcode", key: "photo.jpg", kind: "transfer", passcode: "transfer-secret" })));
    fireEvent.click(screen.getByRole("button", { name: "My Drive" }));

    fireEvent.click(screen.getByRole("button", { name: "Zo Paste" }));
    expect(await screen.findByRole("heading", { name: "Zo Paste" })).toBeInTheDocument();
    expect(screen.getByText("Inspired by Pastebin.")).toBeInTheDocument();
    await waitFor(() => expect(client.list).toHaveBeenLastCalledWith(expect.objectContaining({ type: "paste" })));
    fireEvent.click(screen.getByRole("button", { name: "My Drive" }));

    fireEvent.click(screen.getByRole("button", { name: "Recent" }));
    expect(await screen.findByRole("heading", { name: "Recent" })).toBeInTheDocument();
    expect(await screen.findByText("Last activity")).toBeInTheDocument();
    expect(screen.getByText("Notes")).toBeInTheDocument();
    expect(await screen.findByText("remote-plan.pdf")).toBeInTheDocument();
    expect(screen.getByText("Shared by alice")).toBeInTheDocument();
    expect(screen.getByText("Read only")).toBeInTheDocument();
    expect(screen.getByTestId("recent-filters")).toHaveClass("grid", "grid-cols-2");
    expect(screen.getByRole("combobox", { name: "Recent file type" })).toHaveClass("w-full");
    expect(screen.getByRole("combobox", { name: "Recent modified date" })).toHaveClass("w-full");
    expect(screen.getByRole("combobox", { name: "Recent source" })).toHaveClass("w-full");
    fireEvent.click(screen.getByRole("button", { name: "Shared with others" }));
    expect(await screen.findByText("remote-plan.pdf")).toBeInTheDocument();
    expect(screen.getByText("Shared by alice · Read only")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Recent" }));
    fireEvent.change(screen.getByLabelText("Recent file type"), { target: { value: "image" } });
    await waitFor(() => expect(client.list).toHaveBeenLastCalledWith(expect.objectContaining({ type: "image" })));
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    fireEvent.click(screen.getByRole("button", { name: "My Drive" }));

    fireEvent.click(screen.getByRole("button", { name: "Advanced search" }));
    expect(await screen.findByRole("dialog", { name: "Advanced search" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("File type"), { target: { value: "document" } });
    fireEvent.change(screen.getByLabelText("Has the words"), { target: { value: "strategy" } });
    fireEvent.click(screen.getByLabelText("Only starred files"));
    fireEvent.click(screen.getByRole("button", { name: "Search" }));
    await waitFor(() => expect(client.list).toHaveBeenLastCalledWith(expect.objectContaining({ contentQuery: "strategy", starred: true, type: "document" })));

    fireEvent.click(screen.getByRole("button", { name: "Advanced search" }));
    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    await waitFor(() => expect(screen.getByText("photo.jpg")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Add photo.jpg to Starred" }));
    await waitFor(() => expect(client.star).toHaveBeenCalledWith("photo.jpg"));
    fireEvent.click(screen.getByRole("button", { name: "Starred" }));
    expect(await screen.findByRole("heading", { name: "Starred" })).toBeInTheDocument();
    expect(await screen.findByText("photo.jpg")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "My Drive" }));

    fireEvent.click(screen.getByRole("button", { name: "New" }));
    fireEvent.click(screen.getByRole("button", { name: "New folder" }));
    fireEvent.change(screen.getByLabelText("Folder name"), { target: { value: "Ideas" } });
    fireEvent.click(screen.getByRole("button", { name: "Create folder" }));
    await waitFor(() => expect(client.createFolder).toHaveBeenCalledWith("Ideas"));

    fireEvent.click(screen.getByRole("button", { name: "New" }));
    expect(screen.getByAltText("Document illustration")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "New Zo Video" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "New Zo Document" }));
    expect(await screen.findByRole("dialog", { name: "Create Zo Document" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Document name"), { target: { value: "Strategy" } });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));
    await waitFor(() => expect(client.createNativeFile).toHaveBeenCalledWith({ name: "Strategy", path: undefined, type: "document" }));
    expect(await screen.findByRole("dialog", { name: "Edit Zo Document" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Format bold" })).toBeInTheDocument();
    const documentContent = screen.getByLabelText("Document content");
    documentContent.innerHTML = "<p>Build a focused strategy.</p>";
    fireEvent.input(documentContent);
    await waitFor(() => expect(client.saveNativeFile).toHaveBeenCalledWith("Strategy", expect.objectContaining({ blocks: ["Build a focused strategy."] })), { timeout: 2_000 });
    fireEvent.change(screen.getByLabelText("File name"), { target: { value: "Strategy 2026" } });
    await waitFor(() => expect(client.rename).toHaveBeenCalledWith("Strategy", "Strategy 2026"), { timeout: 2_000 });
    fireEvent.click(screen.getByRole("button", { name: "Close editor" }));

    fireEvent.click(await screen.findByText("Notes"));
    expect(await screen.findByText("hello.txt")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Back to My Drive" }));
    expect(await screen.findByRole("heading", { name: "Files" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Shared with others" }));
    expect(await screen.findByRole("heading", { name: "Links shared by you" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Links shared by you" })).toHaveClass("rounded-2xl");
    expect(screen.getByRole("button", { name: "Change passcode" })).toHaveClass("col-span-3");
    fireEvent.click(await screen.findByRole("button", { name: "View photo.jpg" }));
    await waitFor(() => expect(client.download).toHaveBeenCalledWith("photo.jpg"));

    fireEvent.click(screen.getByRole("button", { name: "Trash" }));
    expect(await screen.findByRole("heading", { name: "Trash" })).toBeInTheDocument();
    expect(await screen.findByText("Trash is empty")).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Account menu"));
    fireEvent.click(screen.getByRole("button", { name: "Profile & controls" }));
    expect(await screen.findByRole("heading", { name: "Profile & controls" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Your private Drive, under your control." })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Danger zone" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "List view" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Grid view" })).not.toBeInTheDocument();

    window.history.pushState({}, "", "?section=databases&database=db-11111111-1111-4111-8111-111111111111&databasePanel=access");
    cleanup();
    render(<DriveApp client={client} authClient={authClient} />);
    expect(await screen.findByRole("heading", { name: "Zo Databases" })).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "Connect from your backend" })).toBeInTheDocument();
    const restoredRoute = new URLSearchParams(window.location.search);
    expect(restoredRoute.get("section")).toBe("databases");
    expect(restoredRoute.get("database")).toBe("db-11111111-1111-4111-8111-111111111111");
    expect(restoredRoute.get("databasePanel")).toBe("access");

    client.listDatabases.mockResolvedValue([{ id: "db-22222222-2222-4222-8222-222222222222", name: "cache", engine: "redis", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z", sizeBytes: 1024 }]);
    client.listDatabaseEngines.mockResolvedValue([{ engine: "redis", name: "Redis", packageName: "redis", availableVersion: "7.0.15", installedVersion: "7.0.15", protocol: "redis", installed: true, installedAt: "2026-01-01T00:00:00.000Z", updatedAt: null, updateAvailable: false, workspaceAvailable: true }]);
    client.executeDatabase.mockImplementation(({ request }: { request: Record<string, unknown> }) => Promise.resolve({ engine: "redis", result: request.command === "SCAN" ? ["0", ["customer:1"]] : request.command === "TYPE" ? "string" : request.command === "GET" ? "Ada" : "PONG" }));
    window.history.pushState({}, "", "?section=databases&database=db-22222222-2222-4222-8222-222222222222&databasePanel=run");
    cleanup();
    render(<DriveApp client={client} authClient={authClient} />);
    fireEvent.click(await screen.findByRole("button", { name: "Zo Databases" }));
    expect(await screen.findByRole("button", { name: "Native workspace" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByText("Native request JSON")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Run request" }));
    await waitFor(() => expect(client.executeDatabase).toHaveBeenCalledWith({ id: "db-22222222-2222-4222-8222-222222222222", request: { command: "PING", args: [] } }));
    expect(await screen.findByLabelText("Database request result")).toHaveTextContent('"PONG"');
    fireEvent.click(screen.getByRole("button", { name: "View records" }));
    await waitFor(() => expect(client.executeDatabase).toHaveBeenCalledWith({ id: "db-22222222-2222-4222-8222-222222222222", request: { command: "SCAN", args: ["0", "COUNT", "100"] } }));
    expect(await screen.findByText("customer:1")).toBeInTheDocument();
    expect(screen.getByText("Ada")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Backend access" }));
    expect(await screen.findByRole("heading", { name: "Connect from your backend" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Native workspace" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete database" }));
    expect(screen.getByText("Permanently delete cache?")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Delete permanently" }));
    await waitFor(() => expect(client.deleteDatabase).toHaveBeenCalledWith("db-22222222-2222-4222-8222-222222222222"));
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    await waitFor(() => expect(authClient.logout).toHaveBeenCalledTimes(1));
  }, 15_000);

  it("keeps an upload progress bar visible until the upload finishes", async () => {
    let completeUpload!: (value: { key: string; name: string; size: number; contentType: string; updatedAt: string; starred: boolean }) => void;
    let reportProgress!: (progress: { loaded: number; total: number }) => void;
    const upload = vi.fn(({ onProgress }: { onProgress?: (progress: { loaded: number; total: number }) => void }) => new Promise<{ key: string; name: string; size: number; contentType: string; updatedAt: string; starred: boolean }>((resolve) => { completeUpload = resolve; reportProgress = onProgress ?? (() => undefined); }));
    const client = {
      list: vi.fn().mockResolvedValue([]),
      getUsage: vi.fn().mockResolvedValue({ fileCount: 0, usedBytes: 0, quotaBytes: 100 * 1024 * 1024 * 1024, quotaAvailableBytes: 100 * 1024 * 1024 * 1024, minQuotaBytes: 1024 * 1024 * 1024, maxQuotaBytes: Math.floor(512 * 1024 * 1024 * 1024 * 0.8), totalBytes: 512 * 1024 * 1024 * 1024, availableBytes: 512 * 1024 * 1024 * 1024, systemUsedBytes: 0, categories: [{ id: "photos", bytes: 0, fileCount: 0 }, { id: "videos", bytes: 0, fileCount: 0 }, { id: "documents", bytes: 0, fileCount: 0 }, { id: "audio", bytes: 0, fileCount: 0 }, { id: "archives", bytes: 0, fileCount: 0 }, { id: "other", bytes: 0, fileCount: 0 }, { id: "trash", bytes: 0, fileCount: 0 }] }),
      listFolders: vi.fn().mockResolvedValue([]),
      listStarred: vi.fn().mockResolvedValue([]),
      listTrash: vi.fn().mockResolvedValue([]),
      createFolder: vi.fn(),
      createNativeFile: vi.fn(),
      saveNativeFile: vi.fn(),
      setQuota: vi.fn(),
      publishForm: vi.fn(),
      listFormResponses: vi.fn().mockResolvedValue([]),
      rename: vi.fn(),
      createShare: vi.fn(),
      upload,
      delete: vi.fn(),
      restoreTrash: vi.fn(),
      permanentlyDeleteTrash: vi.fn(),
      emptyTrash: vi.fn(),
      download: vi.fn(),
      star: vi.fn(),
      unstar: vi.fn(),
      updateSharePasscode: vi.fn(),
      listShares: vi.fn().mockResolvedValue([]),
      revokeShare: vi.fn(),
      createApiKey: vi.fn(),
      listApiKeys: vi.fn().mockResolvedValue([]),
      revokeApiKey: vi.fn()
    };
    const authClient = {
      getAuthStatus: vi.fn().mockResolvedValue({ authenticated: true, registrationAllowed: false, user: { id: "owner", username: "sayyid" } }),
      login: vi.fn(),
      logout: vi.fn(),
      registerInitialUser: vi.fn(),
      updateProfile: vi.fn(),
      changePassword: vi.fn(),
      deleteAccount: vi.fn()
    };

    render(<DriveApp client={client} authClient={authClient} />);
    await screen.findByText("Your drive is ready for its first file");

    fireEvent.change(screen.getByLabelText("Upload files"), {
      target: { files: [new File(["contents"], "draft.txt", { type: "text/plain" })] }
    });

    await waitFor(() => expect(upload).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("status")).toHaveTextContent("Uploading 1 file");
    expect(screen.getByRole("status")).toHaveTextContent("draft.txt");
    reportProgress({ loaded: 4, total: 8 });
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("4 B of 8 B"));
    expect(screen.getByRole("status")).toHaveTextContent("50%");

    completeUpload({ key: "draft.txt", name: "draft.txt", size: 8, contentType: "text/plain", updatedAt: "2026-01-01T00:00:00.000Z", starred: false });
    await waitFor(() => expect(screen.queryByRole("status")).not.toBeInTheDocument());
  });
});
