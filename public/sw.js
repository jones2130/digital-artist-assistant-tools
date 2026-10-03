const CACHE_VERSION = 'v1';
const SHELL_CACHE = `artist-studio-shell-${CACHE_VERSION}`;
const MODEL_CACHE = `artist-studio-models-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `artist-studio-dynamic-${CACHE_VERSION}`;

// Compute base path from service worker scope
const getBasePath = () => {
  const scopeUrl = new URL(self.registration.scope);
  return scopeUrl.pathname.endsWith('/') ? scopeUrl.pathname : `${scopeUrl.pathname}/`;
};

// Critical app shell files to cache upon installation
const getPrecacheAssets = () => {
  const base = getBasePath();
  return [
    base,
    `${base}index.html`,
    `${base}manifest.webmanifest`,
    `${base}favicon.svg`,
    `${base}icons/icon-192x192.png`,
    `${base}icons/icon-512x512.png`,
    `${base}icons/icon-maskable-192x192.png`,
    `${base}icons/icon-maskable-512x512.png`,
    `${base}icons/apple-touch-icon.png`,
    `${base}icons/icon-32x32.png`,
    `${base}icons/icon-16x16.png`,
    `${base}images/logo-dark.svg`,
    `${base}images/logo-dark@3x.png`,
    `${base}images/logo-light.svg`,
    `${base}images/logo-light@3x.png`,
    `${base}models/canonical_face_model.obj`,
  ];
};

// Install Event: pre-cache application shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => {
      // Use individual requests to tolerate any single asset 404 during local dev
      const assets = getPrecacheAssets();
      return Promise.allSettled(
        assets.map((asset) =>
          cache.add(asset).catch((err) => {
            console.warn(`[PWA SW] Precache warning for ${asset}:`, err);
          })
        )
      );
    }).then(() => self.skipWaiting())
  );
});

// Activate Event: purge stale caches and claim clients immediately
self.addEventListener('activate', (event) => {
  const currentCaches = [SHELL_CACHE, MODEL_CACHE, DYNAMIC_CACHE];
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (!currentCaches.includes(key)) {
            console.log(`[PWA SW] Removing obsolete cache: ${key}`);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event: handle offline routing and asset caching
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle GET requests and http/https schemes
  if (request.method !== 'GET' || !url.protocol.startsWith('http')) {
    return;
  }

  // 1. Navigation requests (HTML document) -> Network First with Cache Fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(SHELL_CACHE).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return networkResponse;
        })
        .catch(async () => {
          const cachedResponse = await caches.match(request);
          if (cachedResponse) return cachedResponse;

          const base = getBasePath();
          const cachedIndex = await caches.match(base) || await caches.match(`${base}index.html`);
          if (cachedIndex) return cachedIndex;

          return new Response('Application is offline. Please reconnect to load new pages.', {
            status: 503,
            headers: { 'Content-Type': 'text/plain; charset=utf-8' }
          });
        })
    );
    return;
  }

  // 2. Heavy ML / 3D model files & MediaPipe WASM CDN -> Cache First
  const isModelAsset = url.pathname.includes('/models/') || url.pathname.endsWith('.task') || url.pathname.endsWith('.obj');
  const isMediaPipeCDN = url.hostname === 'cdn.jsdelivr.net' && url.pathname.includes('@mediapipe/tasks-vision');

  if (isModelAsset || isMediaPipeCDN) {
    event.respondWith(
      caches.open(MODEL_CACHE).then(async (cache) => {
        const cachedResponse = await cache.match(request);
        if (cachedResponse) {
          return cachedResponse;
        }

        try {
          const networkResponse = await fetch(request);
          if (networkResponse && (networkResponse.status === 200 || networkResponse.type === 'opaque')) {
            cache.put(request, networkResponse.clone());
          }
          return networkResponse;
        } catch (fetchErr) {
          console.warn('[PWA SW] Model fetch failed while offline:', url.href, fetchErr);
          throw fetchErr;
        }
      })
    );
    return;
  }

  // 3. Built static assets with content hashes (_astro/*) -> Cache First
  if (url.pathname.includes('/_astro/')) {
    event.respondWith(
      caches.open(SHELL_CACHE).then(async (cache) => {
        const cachedResponse = await cache.match(request);
        if (cachedResponse) {
          return cachedResponse;
        }

        const networkResponse = await fetch(request);
        if (networkResponse && networkResponse.status === 200) {
          cache.put(request, networkResponse.clone());
        }
        return networkResponse;
      })
    );
    return;
  }

  // 4. Other static assets (icons, images, styles, local scripts) -> Stale-While-Revalidate
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const fetchPromise = fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(DYNAMIC_CACHE).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return networkResponse;
        })
        .catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});

// Message listener for skipWaiting or manual sync
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
