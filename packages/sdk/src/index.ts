import {
  apiErrorSchema,
  authStatusSchema,
  driveUserSchema,
  driveShareSchema,
  listSharesResponseSchema,
  publicShareSchema,
  driveFolderSchema,
  driveObjectSchema,
  listFoldersResponseSchema,
  listObjectsResponseSchema,
  storageUsageSchema
} from "@zo-drive/types";
import type { AuthStatus, DriveFolder, DriveObject, DriveShare, DriveUser, PublicShare, ShareAccess, StorageUsage } from "@zo-drive/types";

type Fetcher = typeof fetch;

export type ZoDriveClientOptions = {
  baseUrl: string;
  fetcher?: Fetcher;
  headers?: HeadersInit | (() => HeadersInit);
};

export type ListOptions = {
  prefix?: string;
  query?: string;
};

export type UploadOptions = {
  file: Blob;
  fileName: string;
  path?: string;
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
    const suffix = params.size > 0 ? `?${params.toString()}` : "";
    const response = await this.request(`/objects${suffix}`, { method: "GET" });
    return listObjectsResponseSchema.parse(await response.json()).objects;
  }

  async upload({ file, fileName, path }: UploadOptions): Promise<DriveObject> {
    const form = new FormData();
    form.set("file", file, fileName);
    if (path) {
      form.set("path", path);
    }
    const response = await this.request("/objects", { body: form, method: "POST" });
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

  async download(key: string): Promise<Response> {
    return this.request(`/objects/${encodeDriveKey(key)}`, { method: "GET" });
  }

  async delete(key: string): Promise<void> {
    await this.request(`/objects/${encodeDriveKey(key)}`, { method: "DELETE" });
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
