/** @type {import('next').NextConfig} */
const nextConfig = {
  // Docker web image (C5 gateway smoke) uses .next/standalone
  output: "standalone",
  // Host docker export: allow standalone image while unrelated TS debt exists in tests/legacy.
  typescript: { ignoreBuildErrors: true },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "picsum.photos",
      },
      {
        protocol: "https",
        hostname: "api.telegram.org",
      },
      {
        protocol: "https",
        hostname: "storage.yandexcloud.net",
      },
    ],
  },
};

export default nextConfig;
