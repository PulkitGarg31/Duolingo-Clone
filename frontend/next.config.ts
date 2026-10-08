import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Lets several local dev servers run side by side, each with its own output folder.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // `next dev` must not write extra files into the project tree.
  agentRules: false,
};

export default nextConfig;
