// TAT ERP Service Worker — enables PWA install prompt
// CACHE version includes build timestamp so every deploy busts the old cache
const CACHE = 'tat-erp-v__BUILD_TIME__'
const STATIC = ['/']

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(STATIC)))
  self.skipWaiting()
})

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  )
  self.clients.claim()
})

// Network-first strategy (always get fresh data, fallback to cache)
self.addEventListener('fetch', e => {
  // Skip API calls and non-GET requests
  if (e.request.method !== 'GET' || e.request.url.includes('/api/')) return

  e.respondWith(
    fetch(e.request)
      .then(res => {
        const clone = res.clone()
        caches.open(CACHE).then(c => c.put(e.request, clone))
        return res
      })
      .catch(() => caches.match(e.request))
  )
})
