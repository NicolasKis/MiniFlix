// Keeps the app shell and posters on the device so Sacred Timeline opens without a connection.
// App files: network first, cached copy when offline. Posters: cached copy first. The API is never cached.
const CACHE = 'st-v1'

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()))

// Notifications from the server (new releases, variance report, backup reminder, test).
self.addEventListener('push', e => {
  const d = e.data ? e.data.json() : {}
  e.waitUntil(self.registration.showNotification(d.title || 'Sacred Timeline', { body: d.body || '', icon: '/icon-512.png' }))
})
self.addEventListener('notificationclick', e => {
  e.notification.close()
  e.waitUntil(self.clients.matchAll({ type: 'window' }).then(list => (list[0] ? list[0].focus() : self.clients.openWindow('/'))))
})

self.addEventListener('fetch', e => {
  const req = e.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)

  if (url.hostname === 'image.tmdb.org') {
    e.respondWith(caches.open(CACHE).then(c => c.match(req).then(hit => hit || fetch(req).then(res => { c.put(req, res.clone()); return res }))))
    return
  }
  if (url.origin !== location.origin || url.pathname.startsWith('/api/')) return

  e.respondWith(
    fetch(req)
      .then(res => {
        if (res.ok) {
          const copy = res.clone()
          caches.open(CACHE).then(c => c.put(req, copy))
        }
        return res
      })
      .catch(() => caches.match(req).then(hit => hit || (req.mode === 'navigate' ? caches.match('/') : Response.error()))),
  )
})
