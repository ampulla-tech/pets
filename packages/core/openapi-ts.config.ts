import { defineConfig } from "@hey-api/openapi-ts";

/**
 * The API client, generated from the OpenAPI document django-ninja exports
 * (scripts/openapi.sh writes openapi.json): the types, the zod schemas, the SDK
 * and the TanStack Query options, over a fetch client each app configures at
 * start-up (src/api/client.ts).
 */
export default defineConfig({
  input: "./openapi.json",
  output: {
    path: "./src/generated/api",
    postProcess: ["prettier"],
  },
  plugins: [
    "@hey-api/client-fetch",
    "@hey-api/typescript",
    "@hey-api/sdk",
    "zod",
    "@tanstack/react-query",
  ],
});
