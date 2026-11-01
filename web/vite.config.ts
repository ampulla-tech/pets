import { defineConfig, searchForWorkspaceRoot } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    // One React for the app and the libraries: the workspace also holds a
    // nested copy under @tanstack/react-query (resolved for @pets/core's
    // devDependency), and two Reacts break every hook.
    dedupe: ["react", "react-dom", "@tanstack/react-query"],
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    // The port the API's CORS allows and its e-mails link to (WEB_APP_URL).
    port: 5180,
    strictPort: true,
    fs: {
      allow: [searchForWorkspaceRoot(process.cwd())],
    },
  },
  preview: { port: 5180, strictPort: true },
});
