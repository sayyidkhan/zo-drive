import type { DriveObject, StorageUsage } from "@zo-drive/types";

export function formatUsage(usage: StorageUsage): string {
  return `${usage.fileCount} file${usage.fileCount === 1 ? "" : "s"}, ${formatBytes(usage.usedBytes)} used\n`;
}

export function formatStatus(usage: StorageUsage): string {
  const usagePercent = Math.min(100, Math.round((usage.usedBytes / usage.quotaBytes) * 100));
  return `Zo Drive\n--------\nStatus: connected\nStorage: ${usage.fileCount} file${usage.fileCount === 1 ? "" : "s"}, ${formatBytes(usage.usedBytes)} / ${formatBytes(usage.quotaBytes)} (${usagePercent}%)\n`;
}

export function formatHealth({ api, latencyMs, storage, disk }: { api: "ok"; latencyMs: number; storage: StorageUsage; disk: { availableBytes: number; totalBytes: number } }): string {
  const usagePercent = Math.min(100, Math.round((storage.usedBytes / storage.quotaBytes) * 100));
  return `Zo Drive health\n---------------\nAPI: ${api} (${formatLatency(latencyMs)})\nAuthentication: ok\nStorage: ${storage.fileCount} file${storage.fileCount === 1 ? "" : "s"}, ${formatBytes(storage.usedBytes)} / ${formatBytes(storage.quotaBytes)} (${usagePercent}%)\nDisk: ${formatCapacity(disk.availableBytes)} available of ${formatCapacity(disk.totalBytes)}\n`;
}

export function formatObjectMetadata(object: DriveObject): string {
  return [
    `Key: ${object.key}`,
    `Name: ${object.name}`,
    `Size: ${formatBytes(object.size)}`,
    `Content type: ${object.contentType}`,
    `Updated: ${object.updatedAt}`,
    `Starred: ${object.starred ? "yes" : "no"}`,
    ...(object.nativeType ? [`Native type: ${object.nativeType}`] : [])
  ].join("\n").concat("\n");
}

export function formatBytes(bytes: number): string {
  if (bytes < 1_024) return `${bytes} B`;
  return formatCapacity(bytes);
}

export function createUploadProgress(write: (message: string) => void): { finish: () => void; update: (progress: { loaded: number; total: number }) => void } {
  let rendered = false;
  let previousPercent = -1;
  return {
    update: ({ loaded, total }) => {
      const percent = total === 0 ? 100 : Math.min(100, Math.round((loaded / total) * 100));
      if (percent === previousPercent) return;
      previousPercent = percent;
      const completed = Math.round((percent / 100) * 20);
      write(`\rUploading [${"#".repeat(completed)}${"-".repeat(20 - completed)}] ${percent}% (${formatBytes(loaded)} / ${formatBytes(total)})`);
      rendered = true;
    },
    finish: () => {
      if (rendered) write("\n");
    }
  };
}

export function formatLatency(milliseconds: number): string {
  return milliseconds < 1_000 ? `${milliseconds} ms` : `${(milliseconds / 1_000).toFixed(1)} s`;
}

function formatCapacity(bytes: number): string {
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1_024 && unitIndex < units.length - 1) {
    value /= 1_024;
    unitIndex += 1;
  }
  return `${value.toFixed(1)} ${units[unitIndex]}`;
}
