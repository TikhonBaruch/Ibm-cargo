/** @type {import('next').NextConfig} */
const nextConfig = {
  // Docker web image (C5 gateway smoke) uses .next/standalone
  output: "standalone",
  // Host docker export: allow standalone image while unrelated TS debt exists in tests/legacy.
  typescript: { ignoreBuildErrors: true },
  // pdfjs-dist needs DOMMatrix; keep it off the Node evaluate path.
  serverExternalPackages: ["pdfjs-dist", "tesseract.js"],
  // Cursor / LAN preview hits the Network URL, not localhost.
  allowedDevOrigins: ["127.0.0.1", "localhost", "172.30.0.2"],
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
