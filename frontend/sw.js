// Service Worker for ChitChat - Ultra-fast caching
const CACHE_NAME = 'chitchat-v1.0.0';
const STATIC_CACHE = 'chitchat-static-v1.0.0';
const API_CACHE = 'chitchat-api-v1.0.0';

// Resources to cache immediately
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/css/styles.css',
  '/js/app.js',
  '/js/auth.js',
  '/js/chat.js',
  '/js/crypto.js',
  '/js/safe.js',
  '/terms.html',
  '/privacy.html'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('🚀 ChitChat Service Worker installing...');
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('📦 Caching static assets...');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean old caches
self.addEventListener('activate', (event) => {
  console.log('✅ ChitChat Service Worker activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== STATIC_CACHE && cacheName !== API_CACHE) {
            console.log('🗑️ Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event - serve from cache or network
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Handle API requests
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache successful GET requests for short time
          if (request.method === 'GET' && response.ok) {
            const responseClone = response.clone();
            caches.open(API_CACHE).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          // Return cached version if network fails
          return caches.match(request);
        })
    );
    return;
  }

  // Handle static assets - cache-first strategy
  event.respondWith(
    caches.match(request)
      .then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }

        // Fetch from network
        return fetch(request).then((response) => {
          // Don't cache non-successful responses
          if (!response.ok) {
            return response;
          }

          // Cache successful responses
          const responseClone = response.clone();
          caches.open(STATIC_CACHE).then((cache) => {
            cache.put(request, responseClone);
          });

          return response;
        });
      })
      .catch(() => {
        // Offline fallback
        if (request.mode === 'navigate') {
          return caches.match('/index.html');
        }
        return new Response('Offline content not available', { status: 503 });
      })
  );
});

// Background sync for offline actions (if supported)
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync') {
    event.waitUntil(doBackgroundSync());
  }
});

async function doBackgroundSync() {
  console.log('🔄 Background sync triggered');
  // Handle offline actions here
}

// Push notifications (if implemented later)
self.addEventListener('push', (event) => {
  if (event.data) {
    const data = event.data.json();
    const options = {
      body: data.body,
      icon: '/icon-192x192.png',
      badge: '/icon-192x192.png',
      vibrate: [100, 50, 100],
      data: data.data
    };

    event.waitUntil(
      self.registration.showNotification(data.title, options)
    );
  }
});

// Performance monitoring
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'GET_CACHE_STATS') {
    caches.keys().then((cacheNames) => {
      const stats = {};
      const promises = cacheNames.map((cacheName) => {
        return caches.open(cacheName).then((cache) => {
          return cache.keys().then((requests) => {
            stats[cacheName] = requests.length;
          });
        });
      });

      Promise.all(promises).then(() => {
        event.ports[0].postMessage(stats);
      });
    });
  }
});
