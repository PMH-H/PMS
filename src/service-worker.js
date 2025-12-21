/// <reference lib="webworker" />

// Inject Precache Manifest (handled by Workbox/VitePWA)
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching'
import { clientsClaim } from 'workbox-core'

cleanupOutdatedCaches()

// self.__WB_MANIFEST is injected by VitePWA
precacheAndRoute(self.__WB_MANIFEST)

self.skipWaiting()
clientsClaim()

// Push Notification Handler
self.addEventListener('push', (event) => {
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
})

// Notification Click Handler
self.addEventListener('notificationclick', (event) => {
    event.notification.close()
    event.waitUntil(
        clients.openWindow(event.notification.data)
    )
})
