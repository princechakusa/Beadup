import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    // Only pure-logic helpers are unit tested; React Native / Expo modules
    // cannot run in Node, so those are excluded.
    include: ["src/**/*.test.ts"],
  },
});