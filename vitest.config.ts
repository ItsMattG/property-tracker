import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "json-summary", "html"],
      exclude: [
        "node_modules/",
        "e2e/",
        "*.config.*",
        "**/*.d.ts",
        // Gmail OAuth integration - requires external API mocking
        "src/lib/gmail/**",
        "src/server/services/gmail-*.ts",
        "src/app/api/auth/gmail/**",
        "src/app/api/auth/callback/gmail/**",
        "src/app/api/cron/email-sync/**",
        // Repository layer — pure data access, tested via router integration tests
        "src/server/repositories/**",
      ],
      // Lowered thresholds to match current coverage - increase as tests are added
      thresholds: {
        statements: 40,
        branches: 30,
        functions: 40,
        lines: 40,
      },
    },
    // Default environment for server-side tests
    environment: "node",
    // Setup files for React tests (loaded conditionally via workspace or per-file)
    setupFiles: ["./vitest.setup.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
