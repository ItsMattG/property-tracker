import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Mobile app has its own build/lint pipeline
    "mobile/**",
    // Git worktrees contain their own .next/build artifacts
    ".worktrees/**",
    // Test coverage output
    "coverage/**",
  ]),
  // Custom rule overrides - downgrade some rules to warnings for incremental fixing
  {
    rules: {
      // Allow any types for now - will fix incrementally
      "@typescript-eslint/no-explicit-any": "warn",
      // Allow unescaped entities in JSX
      "react/no-unescaped-entities": "warn",
      // Downgrade strict React hooks checks to warnings (v7 is stricter)
      "react-hooks/rules-of-hooks": "warn",
      "react-hooks/incompatible-library": "warn",
      "react-hooks/set-state-in-effect": "warn",
      // React Compiler memoization preservation - warn only
      "react-hooks/preserve-manual-memoization": "warn",
    },
  },
  // Disable React rules in E2E test files (Playwright uses `use` which conflicts)
  {
    files: ["e2e/**/*.ts"],
    rules: {
      "react-hooks/rules-of-hooks": "off",
    },
  },
]);

export default eslintConfig;
