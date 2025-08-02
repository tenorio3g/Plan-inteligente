const CACHE_NAME = 'form-cache-v2'; // ⚠️ Cambia el número en cada actualización

const FILES_TO_CACHE = [
  './',
  './index.html',
  './style.css',
  './manifest.json',
  './icon.png'
];

// Instalación del SW
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(FILES_TO_CACHE);
    })
  );
  self.skipWaiting(); // Forzar que se active al instalar
});

// Activación: limpia caches viejas
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch: sirve desde cache si está disponible
self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(response => {
      return response || fetch(e.request);
    })
  );
});
