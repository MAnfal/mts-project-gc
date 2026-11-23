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
    // Local-only folders that are never committed: git worktrees (chunk worktrees and the
    // poc-src checkout the eval-bundle scripts use) and an untracked POC copy at the root.
    ".worktrees/**",
    "poc/**",
  ]),
]);

export default eslintConfig;
