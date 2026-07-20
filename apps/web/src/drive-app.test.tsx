import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DriveApp, formulaDisplay } from "./drive-app.js";

Object.defineProperty(URL, "createObjectURL", { configurable: true, value: vi.fn(() => "blob:preview") });
Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() });

afterEach(() => {
  cleanup();
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
    expect(screen.getByRole("link", { name: "Open Zo Drive" })).toHaveAttribute("href", expect.stringContaining("?app=1"));
    expect(screen.getByRole("link", { name: "Read the docs" })).toHaveAttribute("href", expect.stringContaining("?docs=1"));
  });

  it("documents separate GUI and CLI workflows", () => {
    const originalPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    try {
      window.history.pushState({}, "", "?docs=1&mode=gui");
      render(<DriveApp />);

      expect(screen.getByRole("heading", { name: "Manage files in your private Drive." })).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "Share files on your terms" })).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "GUI version 0.2.1" })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Changelog" })).toHaveAttribute("href", "#changelog");
      expect(screen.getByRole("heading", { name: "GUI changelog" })).toBeInTheDocument();
      expect(screen.getByText("GUI v0.2.1")).toBeInTheDocument();
      expect(screen.getAllByRole("link", { name: "GUI" })[0]).toHaveAttribute("aria-current", "page");

      cleanup();
      window.history.pushState({}, "", "?docs=1&mode=cli");
      render(<DriveApp />);

      expect(screen.getByRole("heading", { name: "Upload from your machine." })).toBeInTheDocument();
      expect(screen.getAllByRole("link", { name: "CLI" })[0]).toHaveAttribute("aria-current", "page");
      expect(screen.getByRole("heading", { name: "Install zo-drive on your machine" })).toBeInTheDocument();
      expect(screen.getByText(/npm link inside apps\/cli/)).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "Connect your local computer to Zo" })).toBeInTheDocument();
      expect(screen.getByText(/export ZO_DRIVE_API_URL=/)).toBeInTheDocument();
      expect(screen.getByText(/You do not need SSH, Tailscale/)).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "CLI version 0.1.3" })).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "CLI changelog" })).toBeInTheDocument();
      expect(screen.getByText("CLI v0.1.3")).toBeInTheDocument();
      expect(screen.getByText(/cli-v Git release tag/)).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "Automate uploads in code" })).toBeInTheDocument();
      expect(screen.getAllByText(/@zo-drive\/sdk/).length).toBeGreaterThanOrEqual(1);
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

  it("shows storage usage, folders, and files supplied by the shared SDK", async () => {
    const client = {
      list: vi.fn().mockResolvedValue([
        { key: "Notes/hello.txt", name: "hello.txt", size: 5, contentType: "text/plain", updatedAt: "2026-01-01T00:00:00.000Z" },
        { key: "photo.jpg", name: "photo.jpg", size: 10, contentType: "image/jpeg", updatedAt: "2026-01-01T00:00:00.000Z" },
        { key: "guide.pdf", name: "guide.pdf", size: 20, contentType: "application/pdf", updatedAt: "2026-01-01T00:00:00.000Z" }
      ]),
      getUsage: vi.fn().mockResolvedValue({ fileCount: 2, usedBytes: 15, quotaBytes: 100 * 1024 * 1024 * 1024, quotaAvailableBytes: 100 * 1024 * 1024 * 1024 - 15, minQuotaBytes: 1024 * 1024 * 1024, maxQuotaBytes: Math.floor(512 * 1024 * 1024 * 1024 * 0.8), totalBytes: 512 * 1024 * 1024 * 1024, availableBytes: 512 * 1024 * 1024 * 1024 - 200, systemUsedBytes: 200, categories: [{ id: "photos", bytes: 10, fileCount: 1 }, { id: "documents", bytes: 5, fileCount: 1 }, { id: "videos", bytes: 0, fileCount: 0 }, { id: "audio", bytes: 0, fileCount: 0 }, { id: "archives", bytes: 0, fileCount: 0 }, { id: "other", bytes: 0, fileCount: 0 }, { id: "trash", bytes: 0, fileCount: 0 }] }),
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
      revokeShare: vi.fn()
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
    fireEvent.click(screen.getByRole("button", { name: "Account menu" }));
    expect(screen.getByRole("link", { name: "Landing page" })).toHaveAttribute("href", "/");
    fireEvent.click(screen.getByRole("button", { name: "Account menu" }));
    const notes = await screen.findByText("Notes");
    expect(notes).toBeInTheDocument();
    expect(screen.getByText("photo.jpg")).toBeInTheDocument();
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
    fireEvent.click(await screen.findByRole("button", { name: "View photo.jpg" }));
    await waitFor(() => expect(client.download).toHaveBeenCalledWith("photo.jpg"));

    fireEvent.click(screen.getByRole("button", { name: "Trash" }));
    expect(await screen.findByRole("heading", { name: "Trash" })).toBeInTheDocument();
    expect(await screen.findByText("Trash is empty")).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Account menu"));
    fireEvent.click(screen.getByText("Profile & controls"));
    expect(await screen.findByText("Profile & controls")).toBeInTheDocument();
    expect(screen.getByText("Danger zone")).toBeInTheDocument();
  });

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
      revokeShare: vi.fn()
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
