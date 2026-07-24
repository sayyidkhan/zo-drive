export function recentFileLocation(key: string): string {
  const separator = key.lastIndexOf("/");
  return separator < 0 ? "My Drive" : key.slice(0, separator);
}

export function formatRecentActivity(updatedAt: string): string {
  const date = new Date(updatedAt);
  const now = new Date();
  if (date.toDateString() === now.toDateString()) {
    return `Modified today, ${date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
  }
  return `Modified ${date.toLocaleDateString([], { month: "short", day: "numeric" })}`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1_024) return `${bytes} B`;
  if (bytes < 1_048_576) return `${(bytes / 1_024).toFixed(1)} KB`;
  if (bytes < 1_073_741_824) return `${(bytes / 1_048_576).toFixed(1)} MB`;
  return `${(bytes / 1_073_741_824).toFixed(1)} GB`;
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return minutes < 60 ? `${minutes}m ${remainingSeconds}s` : `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

export function formatTrashExpiry(expiresAt: string): string {
  const days = Math.max(0, Math.ceil((Date.parse(expiresAt) - Date.now()) / (24 * 60 * 60 * 1_000)));
  return days === 0 ? "Deletes today" : `Deletes in ${days} day${days === 1 ? "" : "s"}`;
}

export function ttlToDate(ttl: string): string | null {
  const milliseconds = ttl === "1d" ? 24 * 60 * 60 * 1_000 : ttl === "7d" ? 7 * 24 * 60 * 60 * 1_000 : ttl === "30d" ? 30 * 24 * 60 * 60 * 1_000 : 0;
  return milliseconds ? new Date(Date.now() + milliseconds).toISOString() : null;
}
