/**
 * push-handler.js — injected into the Workbox service worker via importScripts.
 * Handles Web Push notification display and click routing.
 */

self.addEventListener('push', function (event) {
  if (!event.data) return

  let payload
  try {
    payload = event.data.json()
  } catch {
    payload = { title: 'Particular Baptist Devotional', body: event.data.text() }
  }

  const title = payload.title || 'Particular Baptist Devotional'
  const options = {
    body:    payload.body  || 'Your daily reading is ready.',
    icon:    payload.icon  || '/pwa-192.png',
    badge:   payload.badge || '/pwa-192.png',
    tag:     payload.tag   || 'daily-reading',
    data:    { url: payload.url || '/' },
    // Show notification even when app is in foreground
    requireInteraction: false,
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', function (event) {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || '/'
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (windowClients) {
      // Focus existing window if open
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url)
          return client.focus()
        }
      }
      // Otherwise open new window
      if (clients.openWindow) return clients.openWindow(url)
    })
  )
})
