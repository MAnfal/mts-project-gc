import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // POC: pages read local JSON at request time; skip Cache Components friction.
  cacheComponents: false,
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
