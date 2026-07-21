import {
  apiErrorSchema,
  authStatusSchema,
  createdDatabaseApiKeySchema,
  databaseImportSettingsSchema,
  databaseEngineSchema,
  databaseExecuteResultSchema,
  databaseQueryResultSchema,
  databaseRowsSchema,
  databaseTableSchema,
  createdDriveApiKeySchema,
  driveDatabaseSchema,
  driveFunctionSchema,
  driveUserSchema,
  driveShareSchema,
  formResponseSchema,
  listFormResponsesSchema,
  listDriveApiKeysResponseSchema,
  listDriveDatabasesResponseSchema,
  listDriveFunctionsResponseSchema,
  listDatabaseEnginesResponseSchema,
  listDatabaseApiKeysResponseSchema,
  listDatabaseTablesResponseSchema,
  listSharesResponseSchema,
  publishedFormSchema,
  publicShareSchema,
  sharedPasteSchema,
  driveFolderSchema,
  driveObjectSchema,
  healthSchema,
  driveTrashItemSchema,
  listFoldersResponseSchema,
  listObjectsResponseSchema,
  listTrashResponseSchema,
  listFunctionRunsResponseSchema,
  clusterInvitationSchema,
  clusterMountSchema,
  listClusterMountsResponseSchema,
  functionRunSchema,
  storageUsageSchema
} from "@zo-drive/types";
import type { ApiKeyScope, AuthStatus, ClusterInvitation, ClusterMount, CreatedDatabaseApiKey, CreatedDriveApiKey, DatabaseApiKey, DatabaseApiKeyScope, DatabaseEngine, DatabaseEngineId, DatabaseExecuteRequest, DatabaseExecuteResult, DatabaseImportSettings, DatabaseQueryResult, DatabaseRows, DatabaseTable, DriveApiKey, DriveDatabase, DriveFolder, DriveFunction, DriveFunctionRun, DriveObject, DriveShare, DriveTrashItem, DriveUser, FormResponse, FunctionRuntime, FunctionVisibility, Health, NativeFileType, PublicShare, PublishedForm, ShareAccess, ShareKind, SharedPaste, StorageUsage } from "@zo-drive/types";

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
  type?: "document" | "spreadsheet" | "presentation" | "form" | "paste" | "image" | "video" | "audio" | "pdf" | "other";
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

  async createClusterInvitation(folder: string): Promise<ClusterInvitation> {
    const response = await this.request("/clusters/invitations", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ folder }) });
    return clusterInvitationSchema.parse(await response.json());
  }

  async createClusterMount({ remoteUrl, inviteToken }: { remoteUrl: string; inviteToken: string }): Promise<ClusterMount> {
    const response = await this.request("/clusters/mounts", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ remoteUrl, inviteToken }) });
    return clusterMountSchema.parse(await response.json());
  }

  async listClusterMounts(): Promise<ClusterMount[]> {
    const response = await this.request("/clusters/mounts", { method: "GET" });
    return listClusterMountsResponseSchema.parse(await response.json()).mounts;
  }

  async listClusterObjects(id: string): Promise<DriveObject[]> {
    const response = await this.request(`/clusters/mounts/${encodeURIComponent(id)}/objects`, { method: "GET" });
    return listObjectsResponseSchema.parse(await response.json()).objects;
  }

  async uploadClusterObject({ id, file, fileName, path }: { id: string; file: Blob; fileName: string; path?: string }): Promise<DriveObject> {
    const headers = this.uploadHeaders(file, fileName, path);
    const response = await this.request(`/clusters/mounts/${encodeURIComponent(id)}/objects`, { body: file, headers, method: "POST" });
    return driveObjectSchema.parse(await response.json());
  }

  async createClusterFolder({ id, path }: { id: string; path: string }): Promise<DriveFolder> {
    const response = await this.request(`/clusters/mounts/${encodeURIComponent(id)}/folders`, { body: JSON.stringify({ path }), headers: { "content-type": "application/json" }, method: "POST" });
    return driveFolderSchema.parse(await response.json());
  }

  async renameClusterObject({ id, key, name }: { id: string; key: string; name: string }): Promise<DriveObject> {
    const response = await this.request(`/clusters/mounts/${encodeURIComponent(id)}/objects/${encodeDriveKey(key)}`, { body: JSON.stringify({ name }), headers: { "content-type": "application/json" }, method: "PATCH" });
    return driveObjectSchema.parse(await response.json());
  }

  async downloadClusterObject({ id, key }: { id: string; key: string }): Promise<Response> {
    return this.request(`/clusters/mounts/${encodeURIComponent(id)}/objects/${encodeDriveKey(key)}`, { method: "GET" });
  }

  async deleteClusterObject({ id, key }: { id: string; key: string }): Promise<void> {
    await this.request(`/clusters/mounts/${encodeURIComponent(id)}/objects/${encodeDriveKey(key)}`, { method: "DELETE" });
  }

  async deleteClusterMount(id: string): Promise<void> {
    await this.request(`/clusters/mounts/${encodeURIComponent(id)}`, { method: "DELETE" });
  }

  async getHealth(): Promise<Health> {
    const response = await this.request("/health", { method: "GET" });
    return healthSchema.parse(await response.json());
  }

  async upload({ file, fileName, path, onProgress }: UploadOptions): Promise<DriveObject> {
    const headers = this.uploadHeaders(file, fileName, path);
    if (onProgress && typeof XMLHttpRequest !== "undefined") {
      return this.uploadWithProgress(file, headers, onProgress);
    }
    if (onProgress) return this.uploadWithStreamProgress(file, headers, onProgress);
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

  async rename(key: string, name: string): Promise<DriveObject> {
    const response = await this.request(`/objects/${encodeDriveKey(key)}`, {
      body: JSON.stringify({ name }),
      headers: { "content-type": "application/json" },
      method: "PATCH"
    });
    return driveObjectSchema.parse(await response.json());
  }

  async move(key: string, destination: string): Promise<DriveObject> {
    const response = await this.request(`/objects/${encodeDriveKey(key)}`, {
      body: JSON.stringify({ destination }),
      headers: { "content-type": "application/json" },
      method: "PATCH"
    });
    return driveObjectSchema.parse(await response.json());
  }

  async copy(key: string, destination: string, { overwrite = false }: { overwrite?: boolean } = {}): Promise<DriveObject> {
    const response = await this.request(`/objects/${encodeDriveKey(key)}`, {
      body: JSON.stringify({ copyTo: destination, overwrite }),
      headers: { "content-type": "application/json" },
      method: "PATCH"
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

  async setQuota(quotaBytes: number): Promise<StorageUsage> {
    const response = await this.request("/usage/quota", {
      body: JSON.stringify({ quotaBytes }),
      headers: { "content-type": "application/json" },
      method: "PUT"
    });
    return storageUsageSchema.parse(await response.json());
  }

  async listDatabases(): Promise<DriveDatabase[]> {
    const response = await this.request("/databases", { method: "GET" });
    return listDriveDatabasesResponseSchema.parse(await response.json()).databases;
  }

  async listDatabaseEngines(): Promise<DatabaseEngine[]> {
    const response = await this.request("/databases/engines", { method: "GET" });
    return listDatabaseEnginesResponseSchema.parse(await response.json()).engines;
  }

  async installDatabaseEngine(engine: DatabaseEngineId): Promise<DatabaseEngine> {
    const response = await this.request(`/databases/engines/${engine}/install`, { method: "POST" });
    return databaseEngineSchema.parse(await response.json());
  }

  async updateDatabaseEngine(engine: DatabaseEngineId): Promise<DatabaseEngine> {
    const response = await this.request(`/databases/engines/${engine}/update`, { method: "POST" });
    return databaseEngineSchema.parse(await response.json());
  }

  async createDatabase(name: string, engine: DatabaseEngineId = "sqlite"): Promise<DriveDatabase> {
    const response = await this.request("/databases", { body: JSON.stringify({ name, engine }), headers: { "content-type": "application/json" }, method: "POST" });
    return driveDatabaseSchema.parse(await response.json());
  }

  async deleteDatabase(id: string): Promise<void> {
    await this.request(`/databases/${encodeURIComponent(id)}`, { method: "DELETE" });
  }

  async importDatabase({ file, name }: { file: Blob; name: string }): Promise<DriveDatabase> {
    const form = new FormData();
    form.append("file", file, "database.sqlite");
    form.append("name", name);
    const response = await this.request("/databases/import", { body: form, method: "POST" });
    return driveDatabaseSchema.parse(await response.json());
  }

  async exportDatabase(id: string): Promise<Blob> {
    const response = await this.request(`/databases/${encodeURIComponent(id)}/export`, { method: "GET" });
    return response.blob();
  }

  async getDatabaseImportSettings(): Promise<DatabaseImportSettings> {
    const response = await this.request("/databases/settings", { method: "GET" });
    return databaseImportSettingsSchema.parse(await response.json());
  }

  async setDatabaseImportLimit(importLimitBytes: number): Promise<DatabaseImportSettings> {
    const response = await this.request("/databases/settings", { body: JSON.stringify({ importLimitBytes }), headers: { "content-type": "application/json" }, method: "PUT" });
    return databaseImportSettingsSchema.parse(await response.json());
  }

  async listDatabaseTables(id: string): Promise<DatabaseTable[]> {
    const response = await this.request(`/databases/${encodeURIComponent(id)}/tables`, { method: "GET" });
    return listDatabaseTablesResponseSchema.parse(await response.json()).tables;
  }

  async listDatabaseRows({ id, table, limit = 100, offset = 0 }: { id: string; table: string; limit?: number; offset?: number }): Promise<DatabaseRows> {
    const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
    const response = await this.request(`/databases/${encodeURIComponent(id)}/tables/${encodeURIComponent(table)}/rows?${params.toString()}`, { method: "GET" });
    return databaseRowsSchema.parse(await response.json());
  }

  async queryDatabase({ id, sql, params = [] }: { id: string; sql: string; params?: Array<string | number | boolean | null> }): Promise<DatabaseQueryResult> {
    const response = await this.request(`/databases/${encodeURIComponent(id)}/query`, { body: JSON.stringify({ sql, params }), headers: { "content-type": "application/json" }, method: "POST" });
    return databaseQueryResultSchema.parse(await response.json());
  }

  async executeDatabase({ id, request }: { id: string; request: DatabaseExecuteRequest }): Promise<DatabaseExecuteResult> {
    const response = await this.request(`/databases/${encodeURIComponent(id)}/execute`, { body: JSON.stringify(request), headers: { "content-type": "application/json" }, method: "POST" });
    return databaseExecuteResultSchema.parse(await response.json());
  }

  async listDatabaseApiKeys(databaseId: string): Promise<DatabaseApiKey[]> {
    const response = await this.request(`/databases/${encodeURIComponent(databaseId)}/api-keys`, { method: "GET" });
    return listDatabaseApiKeysResponseSchema.parse(await response.json()).keys;
  }

  async createDatabaseApiKey({ databaseId, name, scopes, expiresAt }: { databaseId: string; name: string; scopes: DatabaseApiKeyScope[]; expiresAt: string | null }): Promise<CreatedDatabaseApiKey> {
    const response = await this.request(`/databases/${encodeURIComponent(databaseId)}/api-keys`, { body: JSON.stringify({ name, scopes, expiresAt }), headers: { "content-type": "application/json" }, method: "POST" });
    return createdDatabaseApiKeySchema.parse(await response.json());
  }

  async revokeDatabaseApiKey({ databaseId, keyId }: { databaseId: string; keyId: string }): Promise<void> {
    await this.request(`/databases/${encodeURIComponent(databaseId)}/api-keys/${encodeURIComponent(keyId)}`, { method: "DELETE" });
  }

  async listFunctions(): Promise<DriveFunction[]> {
    const response = await this.request("/functions", { method: "GET" });
    return listDriveFunctionsResponseSchema.parse(await response.json()).functions;
  }

  async createFunction({ name, runtime, source, visibility = "private", cron = null, enabled = true }: { name: string; runtime: FunctionRuntime; source: string; visibility?: FunctionVisibility; cron?: string | null; enabled?: boolean }): Promise<DriveFunction> {
    const response = await this.request("/functions", { body: JSON.stringify({ name, runtime, source, visibility, cron, enabled }), headers: { "content-type": "application/json" }, method: "POST" });
    return driveFunctionSchema.parse(await response.json());
  }

  async updateFunction({ id, name, runtime, source, visibility, cron, enabled }: { id: string; name?: string; runtime?: FunctionRuntime; source?: string; visibility?: FunctionVisibility; cron?: string | null; enabled?: boolean }): Promise<DriveFunction> {
    const response = await this.request(`/functions/${encodeURIComponent(id)}`, { body: JSON.stringify({ name, runtime, source, visibility, cron, enabled }), headers: { "content-type": "application/json" }, method: "PATCH" });
    return driveFunctionSchema.parse(await response.json());
  }

  async deleteFunction(id: string): Promise<void> {
    await this.request(`/functions/${encodeURIComponent(id)}`, { method: "DELETE" });
  }

  async runFunction(id: string, input: unknown = {}): Promise<DriveFunctionRun> {
    const response = await this.request(`/functions/${encodeURIComponent(id)}/run`, { body: JSON.stringify({ input }), headers: { "content-type": "application/json" }, method: "POST" });
    return functionRunSchema.parse(await response.json());
  }

  async listFunctionRuns(id: string): Promise<DriveFunctionRun[]> {
    const response = await this.request(`/functions/${encodeURIComponent(id)}/runs`, { method: "GET" });
    return listFunctionRunsResponseSchema.parse(await response.json()).runs;
  }

  async getAuthStatus(): Promise<AuthStatus> {
    const response = await this.request("/auth/status", { method: "GET" });
    return authStatusSchema.parse(await response.json());
  }

  async listApiKeys(): Promise<DriveApiKey[]> {
    const response = await this.request("/api-keys", { method: "GET" });
    return listDriveApiKeysResponseSchema.parse(await response.json()).keys;
  }

  async createApiKey({ name, scopes, expiresAt }: { name: string; scopes: ApiKeyScope[]; expiresAt: string | null }): Promise<CreatedDriveApiKey> {
    const response = await this.request("/api-keys", { body: JSON.stringify({ name, scopes, expiresAt }), headers: { "content-type": "application/json" }, method: "POST" });
    return createdDriveApiKeySchema.parse(await response.json());
  }

  async revokeApiKey(id: string): Promise<void> {
    await this.request(`/api-keys/${encodeURIComponent(id)}`, { method: "DELETE" });
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

  async createShare({ key, access, editable = false, kind, passcode, expiresAt }: { key: string; access: ShareAccess; editable?: boolean; kind?: ShareKind; passcode?: string; expiresAt?: string | null }): Promise<DriveShare> {
    const response = await this.request("/shares", {
      body: JSON.stringify({ key, access, editable, kind, passcode, expiresAt }),
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

  async publishForm(key: string): Promise<PublishedForm> {
    const response = await this.request("/forms", {
      body: JSON.stringify({ key }),
      headers: { "content-type": "application/json" },
      method: "POST"
    });
    return publishedFormSchema.parse(await response.json());
  }

  async getPublicForm(id: string): Promise<PublishedForm> {
    const response = await this.request(`/public/forms/${encodeURIComponent(id)}`, { method: "GET" });
    return publishedFormSchema.parse(await response.json());
  }

  async submitFormResponse(id: string, answers: Record<string, string | string[]>): Promise<FormResponse> {
    const response = await this.request(`/public/forms/${encodeURIComponent(id)}/responses`, {
      body: JSON.stringify({ answers }),
      headers: { "content-type": "application/json" },
      method: "POST"
    });
    return formResponseSchema.parse(await response.json());
  }

  async listFormResponses(id: string): Promise<FormResponse[]> {
    const response = await this.request(`/forms/${encodeURIComponent(id)}/responses`, { method: "GET" });
    return listFormResponsesSchema.parse(await response.json()).responses;
  }

  async getPublicShare(id: string): Promise<PublicShare> {
    const response = await this.request(`/shared/${encodeURIComponent(id)}`, { method: "GET" });
    return publicShareSchema.parse(await response.json());
  }

  async downloadShared(id: string, passcode?: string): Promise<Response> {
    return this.request(`/shared/${encodeURIComponent(id)}/content`, { headers: passcode ? { "x-zo-drive-share-passcode": passcode } : undefined, method: "GET" });
  }

  async openSharedPaste(id: string, passcode?: string): Promise<SharedPaste> {
    const response = await this.request(`/shared/${encodeURIComponent(id)}/paste`, { headers: passcode ? { "x-zo-drive-share-passcode": passcode } : undefined, method: "GET" });
    return sharedPasteSchema.parse(await response.json());
  }

  async saveSharedPaste({ id, content, expectedRevision, passcode }: { id: string; content: SharedPaste["content"]; expectedRevision: string; passcode?: string }): Promise<SharedPaste> {
    const response = await this.request(`/shared/${encodeURIComponent(id)}/paste`, {
      body: JSON.stringify({ content, expectedRevision }),
      headers: { "content-type": "application/json", ...(passcode ? { "x-zo-drive-share-passcode": passcode } : {}) },
      method: "PUT"
    });
    return sharedPasteSchema.parse(await response.json());
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

  private async uploadWithStreamProgress(file: Blob, headers: Headers, onProgress: (progress: UploadProgress) => void): Promise<DriveObject> {
    let loaded = 0;
    onProgress({ loaded, total: file.size });
    const body = file.stream().pipeThrough(new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        loaded += chunk.byteLength;
        onProgress({ loaded, total: file.size });
        controller.enqueue(chunk);
      }
    }));
    const response = await this.request("/objects", { body, duplex: "half", headers, method: "POST" } as RequestInit);
    return driveObjectSchema.parse(await response.json());
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
