import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** @type {import('next').NextConfig} */
const webApi = process.env.WEB_API_ORIGIN || process.env.WEB_ORIGIN || "http://localhost:3000";
const rootDir = path.dirname(fileURLToPath(import.meta.url));
const monorepoSrc = path.resolve(rootDir, "../../src");
const localVed = path.resolve(rootDir, "src/components/ved");
const monorepoVed = path.resolve(rootDir, "../../src/components/ved");
const vedRoot = fs.existsSync(localVed) ? localVed : monorepoVed;

function applyAliases(config) {
  config.resolve = config.resolve || {};
  config.resolve.alias = {
    ...(config.resolve.alias || {}),
    "@/components/ved": vedRoot,
    "@": monorepoSrc,
  };
  return config;
}

const nextConfig = {
  output: "standalone",
  experimental: { externalDir: true },
  // Extract pulls monorepo `src/` via `@`; local @types/react can diverge from root — CI types at repo root.
  typescript: { ignoreBuildErrors: true },
  // Next 16: webpack alias still used with `next build --webpack`; turbopack needs explicit map.
  turbopack: {
    root: path.resolve(rootDir, "../.."),
    resolveAlias: {
      "@/components/ved": vedRoot,
      "@": monorepoSrc,
    },
  },
  webpack: (config) => applyAliases(config),
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${webApi}/api/:path*` },
      { source: "/uploads/:path*", destination: `${webApi}/uploads/:path*` },
    ];
  },
  async redirects() {
    return [
      { source: "/login", destination: `${webApi}/login?callbackUrl=/admin`, permanent: false },
    ];
  },
};

export default nextConfig;
