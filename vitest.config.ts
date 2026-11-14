import path from "node:path";

import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [tsconfigPaths()],
  resolve: {
    alias: { "server-only": path.resolve(import.meta.dirname, "src/test/empty.ts") },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}"],
    // Database tests migrate a fresh PGlite per test, which is slow when every file runs at once.
    hookTimeout: 30_000,
  },
});
