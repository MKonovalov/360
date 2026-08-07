import path from "node:path";
import type { NextConfig } from "next";
import { withWorkflow } from 'workflow/next';

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '5mb',
    },
  },
  // Pin the workspace root explicitly ONLY for local dev: this repo is
  // sometimes checked out as a git worktree alongside the main checkout,
  // and both contain a package-lock.json, so Next.js's root auto-detection
  // can pick the wrong one and pull in stale files (e.g. a sibling
  // checkout's src/middleware.ts). Vercel's build container has no sibling
  // checkouts, and pinning there broke output tracing (root returned 404
  // in production despite a successful build) — so this only applies
  // outside Vercel's build environment.
  ...(process.env.VERCEL
    ? {}
    : {
        turbopack: {
          root: path.join(__dirname),
        },
      }),
};

export default withWorkflow(nextConfig);
