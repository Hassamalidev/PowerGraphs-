import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // The cache tests re-import modules; allow for a slow first import on a busy machine.
    testTimeout: 20000,
  },
  resolve: {
    alias: { "@": path.resolve(__dirname) },
  },
});
