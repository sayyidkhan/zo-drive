import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DriveApp, formulaDisplay } from "./drive-app.js";

describe("DriveApp", () => {
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
        { key: "photo.jpg", name: "photo.jpg", size: 10, contentType: "image/jpeg", updatedAt: "2026-01-01T00:00:00.000Z" }
      ]),
      getUsage: vi.fn().mockResolvedValue({ fileCount: 2, usedBytes: 15 }),
      listFolders: vi.fn().mockResolvedValue([{ key: "Notes", name: "Notes", updatedAt: "2026-01-01T00:00:00.000Z" }]),
      listStarred: vi.fn().mockResolvedValue([{ key: "photo.jpg", name: "photo.jpg", size: 10, contentType: "image/jpeg", updatedAt: "2026-01-01T00:00:00.000Z", starred: true }]),
      listTrash: vi.fn().mockResolvedValue([]),
      createFolder: vi.fn(),
      createNativeFile: vi.fn().mockResolvedValue({ key: "Strategy", name: "Strategy", size: 1, contentType: "application/vnd.zo.document+json", nativeType: "document", updatedAt: "2026-01-01T00:00:00.000Z", starred: false }),
      saveNativeFile: vi.fn().mockResolvedValue({ key: "Strategy", name: "Strategy", size: 1, contentType: "application/vnd.zo.document+json", nativeType: "document", updatedAt: "2026-01-01T00:00:00.000Z", starred: false }),
      createShare: vi.fn(),
      upload: vi.fn(),
      delete: vi.fn(),
      restoreTrash: vi.fn(),
      permanentlyDeleteTrash: vi.fn(),
      emptyTrash: vi.fn(),
      download: vi.fn((key: string) => Promise.resolve(key === "Strategy" ? new Response(JSON.stringify({ format: "zo-native", type: "document", version: 1, blocks: [] }), { headers: { "content-type": "application/vnd.zo.document+json" } }) : new Response(new Blob(["image bytes"], { type: "image/jpeg" })))),
      star: vi.fn(),
      unstar: vi.fn(),
      updateSharePasscode: vi.fn(),
      listShares: vi.fn().mockResolvedValue([{ id: "share-123", key: "photo.jpg", name: "photo.jpg", size: 10, contentType: "image/jpeg", access: "passcode", expiresAt: null, createdAt: "2026-01-01T00:00:00.000Z" }]),
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

    const notes = await screen.findByText("Notes");
    expect(notes).toBeInTheDocument();
    expect(screen.getByText("photo.jpg")).toBeInTheDocument();
    expect(screen.getByText("15 B used of 100 GB")).toBeInTheDocument();

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
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(client.saveNativeFile).toHaveBeenCalledWith("Strategy", expect.objectContaining({ blocks: ["Build a focused strategy."] })));

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
      getUsage: vi.fn().mockResolvedValue({ fileCount: 0, usedBytes: 0 }),
      listFolders: vi.fn().mockResolvedValue([]),
      listStarred: vi.fn().mockResolvedValue([]),
      listTrash: vi.fn().mockResolvedValue([]),
      createFolder: vi.fn(),
      createNativeFile: vi.fn(),
      saveNativeFile: vi.fn(),
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
