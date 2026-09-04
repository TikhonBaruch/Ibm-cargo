const CACHE_NAME = "lbm-v2";
const PRECACHE = ["/manifest.json"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  let url;
  try {
    url = new URL(event.request.url);
  } catch {
    return;
  }
  if (url.origin !== self.location.origin) return;
  // Cache-first on HTML/_next/api pinned the old pack reader after deploys (OCR-A).
  if (
    event.request.mode === "navigate" ||
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/_next/") ||
    url.pathname.startsWith("/cabinet") ||
    url.pathname.startsWith("/client") ||
    url.pathname.startsWith("/broker") ||
    url.pathname.startsWith("/admin") ||
    url.pathname.startsWith("/login")
  ) {
    return;
  }
});
