/**
 * EcoWatch SJDM — Service Worker (PWA Offline App Shell)
 * Version: 1.0.0
 */

const CACHE_NAME = "ecowatch-cache-v1";

const PRECACHE_ASSETS = [
    "/",
    "/report",
    "/cleaner",
    "/manifest.json",
    "/logo.png",
    "/data/sjdm_barangays.geojson",
];

// Install Event — precache core App Shell
self.addEventListener("install", (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(PRECACHE_ASSETS).catch((err) => {
                console.warn("[SW] Precache partial error:", err);
            });
        }).then(() => self.skipWaiting())
    );
});

// Activate Event — cleanup outdated caches
self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.map((key) => {
                    if (key.startsWith("ecowatch-cache-") && key !== CACHE_NAME) {
                        return caches.delete(key);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// Fetch Event — App shell caching & offline navigation fallback
self.addEventListener("fetch", (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Bypass non-GET requests and external API endpoints (Backend API handled via IndexedDB Outbox)
    if (request.method !== "GET") return;
    if (url.pathname.startsWith("/api/") || url.hostname.includes("hf.space")) return;

    // Navigation requests (HTML pages)
    if (request.mode === "navigate") {
        event.respondWith(
            fetch(request).catch(async () => {
                const cachedPage = await caches.match(request);
                if (cachedPage) return cachedPage;

                // Fallback to cached portal root if specific subpage not in cache
                if (url.pathname.startsWith("/report")) {
                    return (await caches.match("/report")) || (await caches.match("/"));
                }
                if (url.pathname.startsWith("/cleaner")) {
                    return (await caches.match("/cleaner")) || (await caches.match("/"));
                }
                return caches.match("/");
            })
        );
        return;
    }

    // Static assets & GeoJSON — Stale-While-Revalidate
    if (
        url.pathname.startsWith("/_next/static/") ||
        url.pathname.startsWith("/data/") ||
        url.pathname.endsWith(".png") ||
        url.pathname.endsWith(".jpg") ||
        url.pathname.endsWith(".svg") ||
        url.pathname.endsWith(".json")
    ) {
        event.respondWith(
            caches.match(request).then((cachedResponse) => {
                const fetchPromise = fetch(request).then((networkResponse) => {
                    if (networkResponse && networkResponse.status === 200) {
                        const clone = networkResponse.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
                    }
                    return networkResponse;
                }).catch(() => cachedResponse);

                return cachedResponse || fetchPromise;
            })
        );
    }
});
