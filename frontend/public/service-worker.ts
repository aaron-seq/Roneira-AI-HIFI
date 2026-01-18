/**
 * Service Worker for Roneira AI HIFI
 * 
 * Provides offline support, caching strategies, and background sync.
 * Uses stale-while-revalidate for API responses and cache-first for static assets.
 * 
 * @author Roneira AI
 * @version 2026
 */

const CACHE_NAME = 'roneira-hifi-v1';
const API_CACHE_NAME = 'roneira-hifi-api-v1';

// Static assets to cache immediately
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
];

// API routes to cache with stale-while-revalidate
const API_ROUTES = [
  '/api/portfolio',
  '/api/stock',
  '/api/predictions',
];

// Install event - cache static assets
self.addEventListener('install', (event: ExtendableEvent) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Caching static assets');
      return cache.addAll(STATIC_ASSETS);
    })
  );
  // Activate immediately without waiting
  (self as unknown as ServiceWorkerGlobalScope).skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event: ExtendableEvent) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME && name !== API_CACHE_NAME)
          .map((name) => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    })
  );
  // Take control immediately
  (self as unknown as ServiceWorkerGlobalScope).clients.claim();
});

// Fetch event - handle requests
self.addEventListener('fetch', (event: FetchEvent) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // API requests - stale-while-revalidate
  if (API_ROUTES.some((route) => url.pathname.startsWith(route))) {
    event.respondWith(staleWhileRevalidate(request, API_CACHE_NAME));
    return;
  }

  // Static assets - cache-first
  if (isStaticAsset(url.pathname)) {
    event.respondWith(cacheFirst(request, CACHE_NAME));
    return;
  }

  // HTML navigation - network-first with offline fallback
  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request, CACHE_NAME));
    return;
  }

  // Default - network with cache fallback
  event.respondWith(networkWithCacheFallback(request, CACHE_NAME));
});

/**
 * Cache-first strategy
 * Best for static assets that rarely change
 */
async function cacheFirst(request: Request, cacheName: string): Promise<Response> {
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }

  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    return createOfflineResponse();
  }
}

/**
 * Network-first strategy
 * Best for HTML that should be fresh but work offline
 */
async function networkFirst(request: Request, cacheName: string): Promise<Response> {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    return createOfflineResponse();
  }
}

/**
 * Stale-while-revalidate strategy
 * Best for API data that should be fast but eventually consistent
 */
async function staleWhileRevalidate(request: Request, cacheName: string): Promise<Response> {
  const cache = await caches.open(cacheName);
  const cachedResponse = await cache.match(request);

  // Start network fetch in background
  const fetchPromise = fetch(request)
    .then((networkResponse) => {
      if (networkResponse.ok) {
        cache.put(request, networkResponse.clone());
      }
      return networkResponse;
    })
    .catch(() => null);

  // Return cached response immediately if available
  if (cachedResponse) {
    // Add header to indicate stale data
    const headers = new Headers(cachedResponse.headers);
    headers.set('X-Cache-Status', 'stale');
    return new Response(cachedResponse.body, {
      status: cachedResponse.status,
      statusText: cachedResponse.statusText,
      headers,
    });
  }

  // Wait for network if no cache
  const networkResponse = await fetchPromise;
  if (networkResponse) {
    return networkResponse;
  }

  return createOfflineResponse();
}

/**
 * Network with cache fallback
 */
async function networkWithCacheFallback(request: Request, cacheName: string): Promise<Response> {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    return createOfflineResponse();
  }
}

/**
 * Check if URL is a static asset
 */
function isStaticAsset(pathname: string): boolean {
  const staticExtensions = [
    '.js', '.css', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.woff', '.woff2',
    '.ttf', '.eot', '.ico', '.webp', '.avif'
  ];
  return staticExtensions.some((ext) => pathname.endsWith(ext));
}

/**
 * Create offline fallback response
 */
function createOfflineResponse(): Response {
  const offlineHTML = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Offline - Roneira AI HIFI</title>
      <style>
        body {
          font-family: system-ui, -apple-system, sans-serif;
          background: linear-gradient(135deg, #0a0e27 0%, #1a1f3a 100%);
          color: #fff;
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0;
        }
        .container {
          text-align: center;
          padding: 2rem;
        }
        h1 {
          color: #00f5ff;
          margin-bottom: 1rem;
        }
        p {
          color: #94a3b8;
          margin-bottom: 2rem;
        }
        button {
          background: linear-gradient(135deg, #00f5ff 0%, #00c8d4 100%);
          color: #000;
          border: none;
          padding: 0.75rem 1.5rem;
          border-radius: 0.5rem;
          font-weight: 600;
          cursor: pointer;
        }
        button:hover {
          transform: scale(1.02);
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>You're Offline</h1>
        <p>Please check your internet connection and try again.</p>
        <button onclick="location.reload()">Retry</button>
      </div>
    </body>
    </html>
  `;

  return new Response(offlineHTML, {
    status: 503,
    statusText: 'Service Unavailable',
    headers: { 'Content-Type': 'text/html' },
  });
}

// Background sync for portfolio updates
self.addEventListener('sync', (event: SyncEvent) => {
  if (event.tag === 'sync-portfolio') {
    event.waitUntil(syncPortfolioUpdates());
  }
});

/**
 * Sync pending portfolio updates when back online
 */
async function syncPortfolioUpdates(): Promise<void> {
  // Get pending updates from IndexedDB
  // This is a placeholder - implement based on your needs
  console.log('[SW] Syncing portfolio updates...');
}

// Message handling for cache control
self.addEventListener('message', (event: MessageEvent) => {
  if (event.data?.type === 'SKIP_WAITING') {
    (self as unknown as ServiceWorkerGlobalScope).skipWaiting();
  }
  if (event.data?.type === 'CLEAR_CACHE') {
    caches.delete(CACHE_NAME);
    caches.delete(API_CACHE_NAME);
  }
});

// Type declarations for service worker events
interface ExtendableEvent extends Event {
  waitUntil(promise: Promise<unknown>): void;
}

interface FetchEvent extends ExtendableEvent {
  request: Request;
  respondWith(response: Promise<Response> | Response): void;
}

interface SyncEvent extends ExtendableEvent {
  tag: string;
}

interface MessageEvent extends Event {
  data: { type: string };
}
