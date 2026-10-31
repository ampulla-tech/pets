import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    env: { TZ: "America/Sao_Paulo" },
  },
});
