// --- Config ---
const CACHE_NAME = "huiswerkcoach-noukie-v2";
const PRECACHE = [
  "/",                     // hoofdroute (SPA shell)
  "/index.html",          // voor zekerheid
  "/manifest.webmanifest",
  "/favicon.ico",
  // voeg hier evt. je app-shell CSS/JS in productie aan toe, bv:
  // "/assets/index-ABC123.js",
  // "/assets/index-XYZ789.css",
];

// --- Lifecycle ---
self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.all(
        PRECACHE.map((url) =>
          cache.add(url).catch((err) => {
            console.warn("[SW] Precache skip:", url, err);
          })
        )
      )
    )
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names.map((n) => (n !== CACHE_NAME ? caches.delete(n) : undefined))
      );
      await self.clients.claim();
    })()
  );
});

// --- Helpers ---
const isSameOrigin = (url) => url.origin === self.location.origin;
const isAPI = (url) => url.pathname.startsWith("/api/");

// --- Fetch strategy ---
self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Alleen GET cachen
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Cross-origin: laat door naar netwerk (niet cachen)
  if (!isSameOrigin(url)) return;

  // API calls: altijd netwerk (niet cachen)
  if (isAPI(url)) {
    event.respondWith(fetch(request));
    return;
  }

  // Navigaties/HTML: network-first met fallback op cache
  if (request.mode === "navigate" || url.pathname === "/") {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(request);
          const cache = await caches.open(CACHE_NAME);
          cache.put("/", fresh.clone()); // shell updaten
          return fresh;
        } catch {
          const cached = await caches.match("/");
          return cached || new Response("Offline", { status: 503 });
        }
      })()
    );
    return;
  }

  // Overige same-origin statische assets: cache-first + background update
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(request, { ignoreSearch: true });
      if (cached) {
        // update op achtergrond
        fetch(request)
          .then((res) => {
            if (res && res.ok) cache.put(request, res.clone());
          })
          .catch(() => {});
        return cached;
      }
      // niet in cache → probeer netwerk en sla op
      const res = await fetch(request);
      if (res && res.ok) cache.put(request, res.clone());
      return res;
    })()
  );
});
