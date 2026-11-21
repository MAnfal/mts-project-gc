import { defineConfig } from "vitest/config";
import path from "node:path";

// Separate from unit tests: evals spend money and take minutes.
export default defineConfig({
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
  test: { include: ["evals/**/*.eval.ts"], testTimeout: 600_000, hookTimeout: 600_000, fileParallelism: false },
});
