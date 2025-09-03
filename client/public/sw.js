// Een unieke naam voor de cache. Verhoog dit nummer (v2, v3, etc.) als u grote wijzigingen aan de app maakt.
const CACHE_NAME = 'huiswerkcoach-noukie-v1';

// De essentiële "shell" van de app die we altijd willen cachen.
const FILES_TO_CACHE = [
  '/', // De hoofdpagina
  '/manifest.webmanifest', // Het manifest-bestand
  '/favicon.ico' // Het icoon
];

// Event listener voor de 'install' fase
self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    try {
      const cache = await caches.open(CACHE_NAME);
      console.log('[Service Worker] Bestanden worden gecached...');

      // Deze aanpak is robuuster dan cache.addAll().
      // Het probeert elk bestand apart te cachen en stopt niet als één bestand mislukt.
      const promises = FILES_TO_CACHE.map((url) => {
        return cache.add(url).catch((reason) => {
          console.warn(`[Service Worker] Kon bestand niet cachen: ${url}`, reason);
        });
      });
      await Promise.all(promises);

    } catch (error) {
      console.error('[Service Worker] Installatie mislukt:', error);
    }
  })());
});

// Event listener voor de 'fetch' fase (wanneer de app data of bestanden opvraagt)
self.addEventListener('fetch', (event) => {
  // We reageren alleen op GET-verzoeken.
  if (event.request.method !== 'GET') {
    return;
  }
  
  event.respondWith((async () => {
    try {
      // Probeer eerst het netwerk om de nieuwste versie te krijgen.
      const networkResponse = await fetch(event.request);

      // Als dat lukt, slaan we een kopie op in de cache voor offline gebruik.
      const cache = await caches.open(CACHE_NAME);
      cache.put(event.request, networkResponse.clone());

      return networkResponse;
    } catch (error) {
      // Als het netwerk mislukt (bijv. offline), probeer het dan uit de cache te halen.
      console.log('[Service Worker] Netwerkfout, probeer cache:', event.request.url);
      const cachedResponse = await caches.match(event.request);
      return cachedResponse;
    }
  })());
});

// Event listener voor de 'activate' fase (ruimt oude caches op)
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const cacheNames = await caches.keys();
    await Promise.all(
      cacheNames.map((cacheName) => {
        if (cacheName !== CACHE_NAME) {
          console.log('[Service Worker] Oude cache wordt verwijderd:', cacheName);
          return caches.delete(cacheName);
        }
      })
    );
  })());
});

