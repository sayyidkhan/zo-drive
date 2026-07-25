import { extname } from "node:path";

/** Content types for the compiled browser assets served by the hosted API. */
export function staticContentType(file: string): string {
  switch (extname(file).toLowerCase()) {
    case ".css": return "text/css; charset=utf-8";
    case ".js": return "text/javascript; charset=utf-8";
    case ".json": return "application/json; charset=utf-8";
    case ".txt": return "text/plain; charset=utf-8";
    case ".svg": return "image/svg+xml";
    case ".png": return "image/png";
    case ".jpg":
    case ".jpeg": return "image/jpeg";
    case ".ico": return "image/x-icon";
    case ".woff2": return "font/woff2";
    case ".mp4": return "video/mp4";
    default: return "text/html; charset=utf-8";
  }
}
