const CACHE_NAME = 'orario-lavoro-pro-v0.1';

const ASSETS = [
  './',
  './index.html',
  './script.js',
  './manifest.json',
  './icon.png',
  './style.css'
];

// 1. FASE DI INSTALLAZIONE: Salva i file nella memoria offline del telefono
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('Service Worker: Caching dei file in corso...');
      return cache.addAll(ASSETS);
    })
  );
  // Forza il Service Worker ad attivarsi subito
  self.skipWaiting();
});

// 2. FASE DI ATTIVAZIONE: Elimina le vecchie versioni dell'app
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Service Worker: Eliminazione vecchia cache', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// 3. FASE DI INTERCETTAZIONE (FETCH): Risponde usando la cache se offline
self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((response) => {
      // Se il file è in cache, lo restituisce, altrimenti lo scarica da internet
      return response || fetch(e.request);
    })
  );
});