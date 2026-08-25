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
      { source: "/login", destination: `${webApi}/login?callbackUrl=/broker`, permanent: false },
    ];
  },
};

export default nextConfig;
