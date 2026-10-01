// Versioned image-only cache. No game state, cloud requests or app JS are cached.
const CACHE = 'freedoom-halloween-assets-v3';
const PREFIX = 'freedoom-halloween-assets-';
const MAX_IMAGES = 24;
const seasonalImage = /\/(?:outfits\/drowned-reliquary\/[^/]+|hero_background\/cripta_halloween(?:_wide)?|relics\/relic_halloween_mascara_diezmo_carmesi|scenes\/(?:temple|shops)-halloween|potions\/(?:candy_(?:blood|energy|experience)|pack_calabaza_arpillera))\.webp$/;
self.addEventListener('install', event => event.waitUntil(self.skipWaiting()));
self.addEventListener('activate', event => event.waitUntil((async () => {
  for (const key of await caches.keys()) if (key.startsWith(PREFIX) && key !== CACHE) await caches.delete(key);
  await self.clients.claim();
})()));
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || !seasonalImage.test(url.pathname)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(request);
    if (cached) return cached;
    const response = await fetch(request);
    if (response.ok) {
      await cache.put(request, response.clone());
      const keys = await cache.keys();
      for (const key of keys.slice(0, Math.max(0,keys.length-MAX_IMAGES))) await cache.delete(key);
    }
    return response;
  })());
});
