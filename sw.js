/* ==========================================================================
   J.A.R.V.I.S. SERVICE WORKER - PWA CACHE V2 (100% TACTILE)
   ========================================================================== */

const CACHE_NAME = 'jarvis-pwa-v2'; // Incrémenté pour vider l'ancien cache vocal
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './style.css',
    './app.js',
    './manifest.json',
    './status.json',
    './jarvis2.jpeg'
];

// Installation & Mise en cache
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[Service Worker] Mise en cache des ressources V2');
            return cache.addAll(ASSETS_TO_CACHE);
        }).then(() => self.skipWaiting())
    );
});

// Activation & Nettoyage des anciens caches (ex: V1 avec reconnaissance vocale)
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keyList) => {
            return Promise.all(
                keyList.map((key) => {
                    if (key !== CACHE_NAME) {
                        console.log('[Service Worker] Suppression ancien cache :', key);
                        return caches.delete(key);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// Interception des requêtes (Mode hors-ligne)
self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request).then((response) => {
            return response || fetch(event.request);
        })
    );
});
