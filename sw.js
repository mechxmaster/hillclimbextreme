// Hill Climb Extreme — Service Worker
// Caches all game assets for offline play (PWA)

const CACHE_NAME = 'hce-v1';
const ASSETS_TO_CACHE = [
    '/',
    '/index.html',
    '/css/main.css',
    '/js/audio.js',
    '/js/physics.js',
    '/js/terrain.js',
    '/js/cards.js',
    '/js/game.js',
    '/js/app.js',
    '/icons/icon-192.png',
    '/icons/icon-512.png',
    '/manifest.json'
];

// Install: cache all assets
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            console.log('[SW] Caching game assets...');
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
    self.skipWaiting();
});

// Activate: clear old caches
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(
                keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
            )
        )
    );
    self.clients.claim();
});

// Fetch: serve from cache, fallback to network
self.addEventListener('fetch', event => {
    // Skip Firebase / Google API requests (always from network)
    if (event.request.url.includes('firebase') ||
        event.request.url.includes('googleapis') ||
        event.request.url.includes('gstatic')) {
        return;
    }

    event.respondWith(
        caches.match(event.request).then(cached => {
            return cached || fetch(event.request).then(response => {
                // Cache newly fetched resources
                if (response && response.status === 200) {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                }
                return response;
            });
        }).catch(() => caches.match('/index.html'))
    );
});
