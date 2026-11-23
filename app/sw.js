/* CALIVVS app service worker: lets the app open quickly and work offline.
   App files and pictures are cached; the Google Sheet is always fetched
   live (with the saved menu as the backup when offline). */
const CACHE = 'calivvs-app-v1';
const FILES = [
  './', './index.html', './app.css', './app.js', './manifest.webmanifest',
  './icons/icon-192.png', './icons/icon-512.png',
  '../js/calivvs-data.js', '../data/menu-backup.js',
  '../images/hero-burger.svg', '../images/combo.svg',
  '../images/burger-classic.svg', '../images/burger-cheese.svg', '../images/burger-double.svg', '../images/burger-grilled-cheese.svg',
  '../images/fries-golden.svg', '../images/fries-sunset.svg',
  '../images/shake-vanilla.svg', '../images/shake-chocolate.svg', '../images/shake-strawberry.svg',
  '../images/drink-soda.svg', '../images/drink-lemonade.svg', '../images/drink-water.svg',
  '../images/offer-student.svg', '../images/offer-late-night.svg', '../images/offer-family.svg', '../images/offer-shake.svg'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return; // Google Sheets: always live
  event.respondWith(
    fetch(event.request)
      .then(response => {
        const copy = response.clone();
        caches.open(CACHE).then(cache => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
