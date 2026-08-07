import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    // Mirrors the "@/*" path alias from tsconfig.json. Declared explicitly
    // rather than via vite-tsconfig-paths, which is ESM-only and cannot be
    // loaded by Vite's CJS config loader.
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // `server-only` is a marker package with no runtime behaviour: under the
      // "react-server" condition it resolves to an empty module, and that is the
      // condition server code runs under. Vite does not apply that condition, so
      // point it at the same empty file Next.js uses. Without this, any test
      // touching a server module dies on an unresolved import.
      "server-only": fileURLToPath(
        new URL("./node_modules/next/dist/compiled/server-only/empty.js", import.meta.url)
      ),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/lib/**", "src/validations/**", "src/server/**"],
    },
  },
});
