/**
 * sw.js
 * Service worker: precaches the app shell so the installed app opens offline.
 * Bump CACHE_VERSION whenever the file list below changes.
 */
const CACHE_VERSION = 'quizr-v9';
const RUNTIME_CACHE = 'quizbowl-runtime-v1';

const APP_SHELL = [
    './',
    './index.html',
    './public.html',
    './manifest.webmanifest',
    './icons/icon.svg',
    './icons/icon-192.png',
    './icons/icon-512.png',
    './icons/apple-touch-icon.png',
    './icons/favicon-32.png',
    './css/variables.css',
    './css/main.css',
    './css/components.css',
    './css/dashboard.css',
    './css/questions.css',
    './css/views.css',
    './css/public.css',
    './css/generate.css',
    './css/account.css',
    './css/host.css',
    './js/app.js',
    './js/pwa.js',
    './js/router.js',
    './js/components/modal.js',
    './js/components/toast.js',
    './js/ai/ai-providers.js',
    './js/ai/doc-extract.js',
    './js/ai/question-generator.js',
    './js/export/pdf-export.js',
    './js/export/export-options.js',
    './js/data/storage.js',
    './js/data/questions-db.js',
    './js/data/teams-db.js',
    './js/data/history-db.js',
    './js/data/settings-db.js',
    './js/data/seed-data.js',
    './js/data/quizzes-db.js',
    './js/cloud/config.js',
    './js/cloud/cloud.js',
    './js/cloud/host-cloud.js',
    './js/services/question-service.js',
    './js/services/team-service.js',
    './js/services/scoring-service.js',
    './js/services/host-service.js',
    './js/services/hosting.js',
    './js/utils/search.js',
    './js/utils/ui.js',
    './js/views/dashboard.js',
    './js/views/questions.js',
    './js/views/add-question.js',
    './js/views/question.js',
    './js/views/teams.js',
    './js/views/history.js',
    './js/views/settings.js',
    './js/views/quizzes.js',
    './js/views/generate.js',
    './js/views/export.js',
    './js/views/host.js',
    './js/views/take.js',
    './js/views/results.js',
    './js/views/account.js'
];

// Third-party files (fonts, MathJax, confetti, document readers, PDF maker) cached the first time they load online
const CDN_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com', 'cdn.jsdelivr.net', 'cdnjs.cloudflare.com'];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_VERSION)
            .then(cache => cache.addAll(APP_SHELL.map(url => new Request(url, { cache: 'reload' }))))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then(keys => Promise.all(keys
                .filter(key => key !== CACHE_VERSION && key !== RUNTIME_CACHE)
                .map(key => caches.delete(key))))
            .then(() => self.clients.claim())
    );
});

// Serve from cache straight away, refresh the cache in the background
function staleWhileRevalidate(request, cacheName, matchOptions) {
    return caches.open(cacheName).then(cache =>
        cache.match(request, matchOptions).then(cached => {
            const network = fetch(request)
                .then(response => {
                    if (response && (response.ok || response.type === 'opaque')) {
                        cache.put(request, response.clone());
                    }
                    return response;
                })
                .catch(() => cached);
            return cached || network;
        })
    );
}

async function offlinePage(request, url) {
    return (await caches.match(request, { ignoreSearch: true }))
        || (url.pathname.endsWith('/public') && await caches.match('./public.html'))
        || caches.match('./index.html');
}

self.addEventListener('fetch', (event) => {
    const request = event.request;
    if (request.method !== 'GET') return;
    const url = new URL(request.url);

    if (url.origin === self.location.origin) {
        // Pages: try the network first so updates show up, fall back to the cached copy offline.
        // ignoreSearch lets "/index.html?x" and "/public" (clean URL) find their cached page.
        if (request.mode === 'navigate') {
            event.respondWith(
                fetch(request)
                    .then(response => {
                        const copy = response.clone();
                        caches.open(CACHE_VERSION).then(cache => cache.put(request, copy));
                        return response;
                    })
                    .catch(() => offlinePage(request, url))
            );
            return;
        }
        event.respondWith(staleWhileRevalidate(request, CACHE_VERSION, { ignoreSearch: true }));
        return;
    }

    if (CDN_HOSTS.includes(url.hostname)) {
        event.respondWith(staleWhileRevalidate(request, RUNTIME_CACHE));
    }
});
