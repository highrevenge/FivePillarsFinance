/*
 * 5-PILLAR FINANCE — Service Worker
 * -----------------------------------
 * Bump CACHE_VERSION whenever any cached file changes, so returning users
 * get the new version instead of a stale cached copy.
 */
const CACHE_VERSION = "v1";
const CACHE_NAME = "five-pillar-finance-" + CACHE_VERSION;

// The app shell: everything needed to load and use the app while offline.
// Login/register/dashboard all work fully offline (they're pure
// localStorage), except sending a *new* password-reset email, which
// still needs a live connection to EmailJS.
const APP_SHELL = [
  "./",
  "./index.html",
  "./dashboard.html",
  "./login.css",
  "./dashboard.css",
  "./usersLoginSystem.js",
  "./emailVerification.js",
  "./systemDashboard.js",
  "./userDataProfiles.js",
  "./aiAssistant.js",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-512-maskable.png",
  "./hero-image.png" // optional — caching this file is best-effort below
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Cache each file independently instead of cache.addAll(), which is
      // all-or-nothing — one missing optional file (e.g. hero-image.png,
      // if you haven't added it yet) would otherwise abort caching
      // everything else too.
      return Promise.allSettled(
        APP_SHELL.map((url) =>
          cache.add(url).catch((err) => {
            console.warn("SW: could not precache", url, err);
          })
        )
      );
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return; // never intercept POST/etc.

  const url = new URL(event.request.url);
  const isSameOrigin = url.origin === self.location.origin;

  if (isSameOrigin) {
    // App shell files: stale-while-revalidate — serve instantly from
    // cache (works offline), and refresh the cache in the background so
    // the next load picks up any changes.
    event.respondWith(
      caches.match(event.request).then((cached) => {
        const network = fetch(event.request)
          .then((response) => {
            if (response && response.ok) {
              const clone = response.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
            }
            return response;
          })
          .catch(() => cached); // offline and not cached yet — nothing we can do
        return cached || network;
      })
    );
  } else {
    // Cross-origin (Google Fonts, EmailJS CDN): network-first, since these
    // should stay current when online, with a cached fallback for offline.
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
  }
});