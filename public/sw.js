// TAT ERP Service Worker — enables PWA install prompt
// Cache version auto-busts on every deploy via DATE stamp
const CACHE = 'tat-erp-v__BUILD_TIME__'
const STATIC = ['/']

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(STATIC)))
  // Force new SW to activate immediately (replaces old SW without waiting)
  self.skipWaiting()
})

self.addEventListener('activate', e => {
  // Delete ALL old caches when new version activates
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => {
        console.log('[SW] Deleting old cache:', k)
        return caches.delete(k)
      }))
    )
  )
  // Take control of all open tabs immediately
  self.clients.claim()
})

// Network-first strategy (always get fresh data, fallback to cache)
self.addEventListener('fetch', e => {
  // Skip API calls and non-GET requests — never cache these
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
