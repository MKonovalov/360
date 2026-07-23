import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root explicitly: this repo is often checked out as a
  // git worktree alongside the main checkout, and both contain a
  // package-lock.json, so Next.js's root auto-detection can pick the wrong
  // one and pull in stale files (e.g. a sibling checkout's src/middleware.ts).
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
