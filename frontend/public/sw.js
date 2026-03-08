// Global Intelligence Platform — Service Worker
// Provides offline caching, background sync, and push notification support

const CACHE_NAME = "gip-v3.0";
const OFFLINE_URL = "/offline.html";

// Assets to pre-cache on install
const PRECACHE_URLS = [
  "/",
  "/index.html",
  "/manifest.json",
];

// API routes to cache with network-first strategy
const API_CACHE_PATTERNS = [
  "/api/news",
  "/api/cii",
  "/api/finance",
  "/api/travel-advisories",
  "/api/fleet",
  "/api/airports",
  "/api/gnss",
  "/api/infrastructure",
  "/api/predictions",
  "/api/conflicts",
];

// Install: pre-cache critical assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_URLS).catch((err) => {
        console.warn("SW: Pre-cache partial failure:", err);
      });
    })
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// Fetch: network-first for API, cache-first for static assets
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== "GET") return;

  // Skip WebSocket upgrades
  if (url.protocol === "ws:" || url.protocol === "wss:") return;

  // API requests: network-first with cache fallback
  if (API_CACHE_PATTERNS.some((pattern) => url.pathname.startsWith(pattern))) {
    event.respondWith(networkFirstThenCache(request));
    return;
  }

  // Static assets: cache-first
  if (
    url.pathname.match(/\.(js|css|woff2?|ttf|png|jpg|svg|ico|json)$/) ||
    url.pathname.startsWith("/cesium/")
  ) {
    event.respondWith(cacheFirstThenNetwork(request));
    return;
  }

  // HTML navigation: network-first
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => caches.match("/index.html"))
    );
    return;
  }

  // Default: network with cache fallback
  event.respondWith(networkFirstThenCache(request));
});

async function networkFirstThenCache(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    return cached || new Response(JSON.stringify({ success: false, offline: true }), {
      headers: { "Content-Type": "application/json" },
    });
  }
}

async function cacheFirstThenNetwork(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response("", { status: 503 });
  }
}

// Background sync for offline actions
self.addEventListener("sync", (event) => {
  if (event.tag === "sync-events") {
    event.waitUntil(syncOfflineEvents());
  }
});

async function syncOfflineEvents() {
  // Future: sync any queued offline actions when connection restores
  console.log("SW: Background sync triggered");
}

// Push notifications
self.addEventListener("push", (event) => {
  const data = event.data?.json() || {};
  const title = data.title || "GIP Alert";
  const options = {
    body: data.body || "New intelligence update",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    tag: data.tag || "gip-alert",
    data: { url: data.url || "/" },
    vibrate: [200, 100, 200],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then((clients) => {
      for (const client of clients) {
        if (client.url === url && "focus" in client) return client.focus();
      }
      return self.clients.openWindow(url);
    })
  );
});
