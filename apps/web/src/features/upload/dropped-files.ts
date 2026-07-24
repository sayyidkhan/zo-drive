import type { DroppedFile } from "./upload-types.js";

export async function collectDroppedFiles(dataTransfer: DataTransfer): Promise<DroppedFile[]> {
  const entries = Array.from(dataTransfer.items ?? []).map((item) => item.webkitGetAsEntry?.()).filter((entry): entry is FileSystemEntry => Boolean(entry));
  if (entries.length === 0) return Array.from(dataTransfer.files).map((file) => ({ file, relativeFolder: "" }));
  return (await Promise.all(entries.map((entry) => collectDroppedEntry(entry)))).flat();
}
async function collectDroppedEntry(entry: FileSystemEntry, parentPath = ""): Promise<DroppedFile[]> {
  if (entry.isFile) {
    const file = await new Promise<File>((resolve, reject) => (entry as FileSystemFileEntry).file(resolve, reject));
    return [{ file, relativeFolder: parentPath }];
  }
  const directoryPath = [parentPath, entry.name].filter(Boolean).join("/");
  const reader = (entry as FileSystemDirectoryEntry).createReader();
  const entries: FileSystemEntry[] = [];
  for (;;) {
    const batch = await new Promise<FileSystemEntry[]>((resolve, reject) => reader.readEntries(resolve, reject));
    if (batch.length === 0) break;
    entries.push(...batch);
  }
  return (await Promise.all(entries.map((child) => collectDroppedEntry(child, directoryPath)))).flat();
}
