import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** @type {import('next').NextConfig} */
const webApi = process.env.WEB_API_ORIGIN || process.env.WEB_ORIGIN || "http://localhost:3000";
const rootDir = path.dirname(fileURLToPath(import.meta.url));
const localVed = path.resolve(rootDir, "src/components/ved");
const monorepoVed = path.resolve(rootDir, "../../src/components/ved");
const vedRoot = fs.existsSync(localVed) ? localVed : monorepoVed;

const nextConfig = {
  output: "standalone",
  experimental: { externalDir: true },
  webpack: (config) => {
    const monorepoSrc = path.resolve(rootDir, "../../src");
    config.resolve.alias["@/components/ved"] = vedRoot;
    config.resolve.alias["@"] = monorepoSrc;
    return config;
  },
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${webApi}/api/:path*` },
      { source: "/uploads/:path*", destination: `${webApi}/uploads/:path*` },
    ];
  },
  async redirects() {
    return [
      {
        source: "/login",
        destination: `${webApi}/login?callbackUrl=/manufacturer`,
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
