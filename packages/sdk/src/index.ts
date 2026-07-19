import {
  apiErrorSchema,
  authStatusSchema,
  driveUserSchema,
  driveShareSchema,
  listSharesResponseSchema,
  publicShareSchema,
  driveFolderSchema,
  driveObjectSchema,
  driveTrashItemSchema,
  listFoldersResponseSchema,
  listObjectsResponseSchema,
  listTrashResponseSchema,
  storageUsageSchema
} from "@zo-drive/types";
import type { AuthStatus, DriveFolder, DriveObject, DriveShare, DriveTrashItem, DriveUser, NativeFileType, PublicShare, ShareAccess, StorageUsage } from "@zo-drive/types";

type Fetcher = typeof fetch;

export type ZoDriveClientOptions = {
  baseUrl: string;
  fetcher?: Fetcher;
  headers?: HeadersInit | (() => HeadersInit);
};

export type ListOptions = {
  prefix?: string;
  query?: string;
  contentQuery?: string;
  type?: "document" | "spreadsheet" | "presentation" | "form" | "image" | "video" | "audio" | "pdf" | "other";
  starred?: boolean;
  modifiedAfter?: string;
  modifiedBefore?: string;
};

export type UploadOptions = {
  file: Blob;
  fileName: string;
  path?: string;
  onProgress?: (progress: UploadProgress) => void;
};

export type UploadProgress = {
  loaded: number;
  total: number;
};

export class DriveApiError extends Error {
  readonly code: string;
  readonly status: number;

  constructor({ code, message, status }: { code: string; message: string; status: number }) {
    super(message);
    this.name = "DriveApiError";
    this.code = code;
    this.status = status;
  }
}

export class ZoDriveClient {
  private readonly baseUrl: string;
  private readonly fetcher: Fetcher;
  private readonly headers: ZoDriveClientOptions["headers"];

  constructor({ baseUrl, fetcher = fetch, headers }: ZoDriveClientOptions) {
    this.baseUrl = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
    this.fetcher = fetcher;
    this.headers = headers;
  }

  async list(options: ListOptions = {}): Promise<DriveObject[]> {
    const params = new URLSearchParams();
    if (options.prefix) {
      params.set("prefix", options.prefix);
    }
    if (options.query) {
      params.set("query", options.query);
    }
    if (options.contentQuery) params.set("contentQuery", options.contentQuery);
    if (options.type) params.set("type", options.type);
    if (options.starred) params.set("starred", "true");
    if (options.modifiedAfter) params.set("modifiedAfter", options.modifiedAfter);
    if (options.modifiedBefore) params.set("modifiedBefore", options.modifiedBefore);
    const suffix = params.size > 0 ? `?${params.toString()}` : "";
    const response = await this.request(`/objects${suffix}`, { method: "GET" });
    return listObjectsResponseSchema.parse(await response.json()).objects;
  }

  async upload({ file, fileName, path, onProgress }: UploadOptions): Promise<DriveObject> {
    const headers = this.uploadHeaders(file, fileName, path);
    if (onProgress && this.fetcher === fetch && typeof XMLHttpRequest !== "undefined") {
      return this.uploadWithProgress(file, headers, onProgress);
    }
    const response = await this.request("/objects", { body: file, headers, method: "POST" });
    return driveObjectSchema.parse(await response.json());
  }

  async listFolders(prefix?: string): Promise<DriveFolder[]> {
    const suffix = prefix ? `?${new URLSearchParams({ prefix }).toString()}` : "";
    const response = await this.request(`/folders${suffix}`, { method: "GET" });
    return listFoldersResponseSchema.parse(await response.json()).folders;
  }

  async createFolder(path: string): Promise<DriveFolder> {
    const response = await this.request("/folders", {
      body: JSON.stringify({ path }),
      headers: { "content-type": "application/json" },
      method: "POST"
    });
    return driveFolderSchema.parse(await response.json());
  }

  async createNativeFile({ name, path, type }: { name: string; path?: string; type: NativeFileType }): Promise<DriveObject> {
    const response = await this.request("/native-files", {
      body: JSON.stringify({ name, path, type }),
      headers: { "content-type": "application/json" },
      method: "POST"
    });
    return driveObjectSchema.parse(await response.json());
  }

  async saveNativeFile(key: string, content: Record<string, unknown> & { format: "zo-native"; type: NativeFileType; version: 1 }): Promise<DriveObject> {
    const response = await this.request(`/native-files/${encodeDriveKey(key)}`, {
      body: JSON.stringify({ content }),
      headers: { "content-type": "application/json" },
      method: "PUT"
    });
    return driveObjectSchema.parse(await response.json());
  }

  async download(key: string): Promise<Response> {
    return this.request(`/objects/${encodeDriveKey(key)}`, { method: "GET" });
  }

  async delete(key: string): Promise<void> {
    await this.request(`/objects/${encodeDriveKey(key)}`, { method: "DELETE" });
  }

  async listStarred(): Promise<DriveObject[]> {
    const response = await this.request("/stars", { method: "GET" });
    return listObjectsResponseSchema.parse(await response.json()).objects;
  }

  async listTrash(): Promise<DriveTrashItem[]> {
    const response = await this.request("/trash", { method: "GET" });
    return listTrashResponseSchema.parse(await response.json()).items;
  }

  async restoreTrash(id: string): Promise<DriveObject> {
    const response = await this.request(`/trash/${encodeURIComponent(id)}/restore`, { method: "PUT" });
    return driveObjectSchema.parse(await response.json());
  }

  async permanentlyDeleteTrash(id: string): Promise<void> {
    await this.request(`/trash/${encodeURIComponent(id)}`, { method: "DELETE" });
  }

  async emptyTrash(): Promise<void> {
    await this.request("/trash", { method: "DELETE" });
  }

  async star(key: string): Promise<DriveObject> {
    const response = await this.request(`/stars/${encodeDriveKey(key)}`, { method: "PUT" });
    return driveObjectSchema.parse(await response.json());
  }

  async unstar(key: string): Promise<void> {
    await this.request(`/stars/${encodeDriveKey(key)}`, { method: "DELETE" });
  }

  async getUsage(): Promise<StorageUsage> {
    const response = await this.request("/usage", { method: "GET" });
    return storageUsageSchema.parse(await response.json());
  }

  async getAuthStatus(): Promise<AuthStatus> {
    const response = await this.request("/auth/status", { method: "GET" });
    return authStatusSchema.parse(await response.json());
  }

  async registerInitialUser(credentials: { username: string; password: string }): Promise<DriveUser> {
    const response = await this.request("/auth/register", {
      body: JSON.stringify(credentials),
      headers: { "content-type": "application/json" },
      method: "POST"
    });
    return driveUserSchema.parse((await response.json()).user);
  }

  async login(credentials: { username: string; password: string }): Promise<DriveUser> {
    const response = await this.request("/auth/login", {
      body: JSON.stringify(credentials),
      headers: { "content-type": "application/json" },
      method: "POST"
    });
    return driveUserSchema.parse((await response.json()).user);
  }

  async loginForCli(credentials: { username: string; password: string }): Promise<{ user: DriveUser; sessionToken: string }> {
    const response = await this.request("/auth/login", {
      body: JSON.stringify(credentials),
      headers: { "content-type": "application/json", "x-zo-drive-cli": "1" },
      method: "POST"
    });
    const body = await response.json() as { user: unknown; sessionToken: unknown };
    if (typeof body.sessionToken !== "string") throw new Error("The server did not return a CLI session token");
    return { user: driveUserSchema.parse(body.user), sessionToken: body.sessionToken };
  }

  async logout(): Promise<void> {
    await this.request("/auth/logout", { method: "POST" });
  }

  async updateProfile({ username }: { username: string }): Promise<DriveUser> {
    const response = await this.request("/auth/profile", {
      body: JSON.stringify({ username }),
      headers: { "content-type": "application/json" },
      method: "PATCH"
    });
    return driveUserSchema.parse((await response.json()).user);
  }

  async changePassword({ currentPassword, newPassword }: { currentPassword: string; newPassword: string }): Promise<void> {
    await this.request("/auth/password", {
      body: JSON.stringify({ currentPassword, newPassword }),
      headers: { "content-type": "application/json" },
      method: "POST"
    });
  }

  async deleteAccount({ password, confirmation }: { password: string; confirmation: "DELETE MY DRIVE" }): Promise<void> {
    await this.request("/auth/account", {
      body: JSON.stringify({ password, confirmation }),
      headers: { "content-type": "application/json" },
      method: "DELETE"
    });
  }

  async listShares(): Promise<DriveShare[]> {
    const response = await this.request("/shares", { method: "GET" });
    return listSharesResponseSchema.parse(await response.json()).shares;
  }

  async createShare({ key, access, passcode, expiresAt }: { key: string; access: ShareAccess; passcode?: string; expiresAt?: string | null }): Promise<DriveShare> {
    const response = await this.request("/shares", {
      body: JSON.stringify({ key, access, passcode, expiresAt }),
      headers: { "content-type": "application/json" },
      method: "POST"
    });
    return driveShareSchema.parse(await response.json());
  }

  async revokeShare(id: string): Promise<void> {
    await this.request(`/shares/${encodeURIComponent(id)}`, { method: "DELETE" });
  }

  async updateSharePasscode({ id, passcode }: { id: string; passcode: string }): Promise<DriveShare> {
    const response = await this.request(`/shares/${encodeURIComponent(id)}/passcode`, {
      body: JSON.stringify({ passcode }),
      headers: { "content-type": "application/json" },
      method: "PATCH"
    });
    return driveShareSchema.parse(await response.json());
  }

  async getPublicShare(id: string): Promise<PublicShare> {
    const response = await this.request(`/shared/${encodeURIComponent(id)}`, { method: "GET" });
    return publicShareSchema.parse(await response.json());
  }

  async downloadShared(id: string, passcode?: string): Promise<Response> {
    return this.request(`/shared/${encodeURIComponent(id)}/content`, { headers: passcode ? { "x-zo-drive-share-passcode": passcode } : undefined, method: "GET" });
  }

  private async request(path: string, init: RequestInit): Promise<Response> {
    const configuredHeaders = typeof this.headers === "function" ? this.headers() : this.headers;
    const headers = new Headers(configuredHeaders);
    new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    // Native browser fetch requires the window/global receiver. Calling it as
    // `this.fetcher(...)` binds it to ZoDriveClient and throws an illegal
    // invocation error in browsers.
    const response = await this.fetcher.call(globalThis, `${this.baseUrl}${path}`, {
      ...init,
      credentials: "include",
      headers
    });
    if (response.ok) {
      return response;
    }

    const body = await safeJson(response);
    const parsedError = apiErrorSchema.safeParse(body);
    throw new DriveApiError({
      code: parsedError.success ? parsedError.data.error.code : "HTTP_ERROR",
      message: parsedError.success ? parsedError.data.error.message : `Request failed with status ${response.status}`,
      status: response.status
    });
  }

  private uploadHeaders(file: Blob, fileName: string, path?: string): Headers {
    const configuredHeaders = typeof this.headers === "function" ? this.headers() : this.headers;
    const headers = new Headers(configuredHeaders);
    headers.set("content-type", file.type || "application/octet-stream");
    headers.set("x-zo-drive-file-name", encodeURIComponent(fileName));
    if (path) headers.set("x-zo-drive-path", encodeURIComponent(path));
    return headers;
  }

  private uploadWithProgress(file: Blob, headers: Headers, onProgress: (progress: UploadProgress) => void): Promise<DriveObject> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `${this.baseUrl}/objects`);
      xhr.withCredentials = true;
      headers.forEach((value, key) => xhr.setRequestHeader(key, value));
      xhr.upload.onprogress = (event) => onProgress({ loaded: event.loaded, total: event.lengthComputable ? event.total : file.size });
      xhr.onerror = () => reject(new DriveApiError({ code: "NETWORK_ERROR", message: "Upload interrupted. Please try again.", status: 0 }));
      xhr.onload = () => {
        let body: unknown = null;
        try {
          body = xhr.responseText ? JSON.parse(xhr.responseText) : null;
        } catch {
          body = null;
        }
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            resolve(driveObjectSchema.parse(body));
          } catch (error) {
            reject(error);
          }
          return;
        }
        const parsedError = apiErrorSchema.safeParse(body);
        reject(new DriveApiError({
          code: parsedError.success ? parsedError.data.error.code : "HTTP_ERROR",
          message: parsedError.success ? parsedError.data.error.message : `Request failed with status ${xhr.status}`,
          status: xhr.status
        }));
      };
      onProgress({ loaded: 0, total: file.size });
      xhr.send(file);
    });
  }
}

function encodeDriveKey(key: string): string {
  return key.split("/").map(encodeURIComponent).join("/");
}

async function safeJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}
