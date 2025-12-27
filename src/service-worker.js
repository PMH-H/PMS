/// <reference lib="webworker" />

// Inject Precache Manifest (handled by Workbox/VitePWA)
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';
import { clientsClaim } from 'workbox-core';

cleanupOutdatedCaches();
self.skipWaiting();
clientsClaim();

// self.__WB_MANIFEST is injected by VitePWA
precacheAndRoute(self.__WB_MANIFEST);

// API Caching Strategy (Network First, fallback to cache)
const API_CACHE_NAME = 'pharmai-api-cache-v1';

self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Cache Supabase API calls (select queries, not RPC or mutations ideally, but for now cache GET-like behavior)
    // Supabase REST endpoint format: /rest/v1/
    if (url.pathname.includes('/rest/v1/') && event.request.method === 'GET') {
        event.respondWith(
            fetch(event.request)
                .then((response) => {
                    // Clone response to cache it
                    const responseClone = response.clone();
                    caches.open(API_CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseClone);
                    });
                    return response;
                })
                .catch(() => {
                    // Fallback to cache
                    return caches.match(event.request).then((cachedResponse) => {
                        if (cachedResponse) return cachedResponse;
                        // Return empty if offline and not cached
                        return new Response(JSON.stringify([]), {
                            headers: { 'Content-Type': 'application/json' }
                        });
                    });
                })
        );
        return;
    }

    // Cache Storage Images (Stale-While-Revalidate)
    if (url.pathname.includes('/storage/v1/object/public/')) {
        event.respondWith(
            caches.open('pharmai-images-v1').then((cache) => {
                return cache.match(event.request).then((cachedResponse) => {
                    const fetchPromise = fetch(event.request).then((networkResponse) => {
                        cache.put(event.request, networkResponse.clone());
                        return networkResponse;
                    });
                    return cachedResponse || fetchPromise;
                });
            })
        );
        return;
    }
});

// Push Notification Handler
self.addEventListener('push', (event) => {
    // ... existing push handler code
    const data = event.data ? event.data.json() : {}
    const title = data.title || 'New Notification'
    const options = {
        body: data.body || 'You have a new update.',
        icon: '/pwa-192x192.png',
        badge: '/pwa-192x192.png',
        data: data.url || '/'
    }

    event.waitUntil(
        self.registration.showNotification(title, options)
    )
});

// Notification Click Handler
self.addEventListener('notificationclick', (event) => {
    event.notification.close()
    event.waitUntil(
        clients.openWindow(event.notification.data)
    )
});
