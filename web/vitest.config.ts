import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

export default defineConfig({
  plugins: [react()],
  resolve: {
    // One React for the app and the libraries: the workspace also holds a
    // nested copy under @tanstack/react-query (resolved for @pets/core's
    // devDependency), and two Reacts break every hook.
    dedupe: ["react", "react-dom", "@tanstack/react-query"],
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "happy-dom",
    env: { TZ: "America/Sao_Paulo" },
    setupFiles: ["./src/__tests__/setup.ts"],
    // Run react-query through Vite, so `dedupe` gives it the app's React
    // rather than the nested copy beside it.
    server: { deps: { inline: [/@tanstack\/react-query/] } },
  },
});
