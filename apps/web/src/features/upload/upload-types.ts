export type UploadTask = {
  id: string;
  loaded: number;
  name: string;
  size: number;
  startedAt: number;
};
export type DroppedFile = {
  file: File;
  relativeFolder: string;
};
