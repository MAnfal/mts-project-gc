import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // `next dev` otherwise writes an untracked AGENTS.md at the repo root when it detects a coding agent.
  agentRules: false,
  // Routes read config/*.yaml from disk at request time (src/lib/config/load.ts). The files are not
  // imported, so the tracer can't see them; ship them inside every server function's bundle explicitly.
  outputFileTracingIncludes: {
    "/*": ["./config/**/*"],
  },
  // Tailwind 4 through Turbopack's CSS loader, as in the POC (no PostCSS config).
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
