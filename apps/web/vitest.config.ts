import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // twilio.ts (and other server-only helpers) guard their server-only use
      // with the `server-only` package, whose real index throws when imported
      // outside a server runtime. Stub it out for unit tests.
      "server-only": fileURLToPath(new URL("./src/test-utils/server-only-stub.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});