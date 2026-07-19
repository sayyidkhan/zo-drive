import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig(({ command }) => {
  const configuredBasePath = process.env.VITE_ZO_DRIVE_APP_BASE_PATH;
  const base = command === "serve"
    ? configuredBasePath ?? "/"
    : configuredBasePath ?? "/drive/";

  return {
    base,
    plugins: [react(), tailwindcss()],
    server: {
      host: "127.0.0.1",
      port: 43072,
      proxy: {
        "/auth": "http://127.0.0.1:43071",
        "/folders": "http://127.0.0.1:43071",
        "/objects": "http://127.0.0.1:43071",
        "/shared": "http://127.0.0.1:43071",
        "/shares": "http://127.0.0.1:43071",
        "/usage": "http://127.0.0.1:43071"
      },
      strictPort: true
    },
    test: {
      environment: "jsdom",
      setupFiles: ["./src/test-setup.ts"]
    }
  };
});
