// Klingenhort Service Worker – App offline spielbar machen
const VERSION = 'klingenhort-v6.2.1';
const SHELL = ['./', './index.html', './manifest.webmanifest', './js/i18n.js', './js/lang/en.js', './js/lang/tr.js', './js/lang/es.js', './js/lang/it.js', './js/lang/fr.js', './js/data.js', './js/story.js', './js/news.js', './js/weekly.js', './js/core.js', './js/art.js', './js/items.js', './js/elements.js', './js/forge.js', './js/pets.js', './js/mastery.js', './js/trade.js', './js/auras.js', './js/bosses.js', './js/artefakte.js', './js/mods.js', './js/lande.js', './js/voegel.js', './js/market.js', './js/world.js', './js/combat.js', './js/render.js', './js/hideout.js', './js/bauen.js', './js/controls.js', './js/handbuch.js', './js/fraktionen.js', './js/auftraege.js', './js/ui.js', './assets/sheet.png', './assets/fx.png', './icons/icon-192.png', './icons/icon-512.png', './icons/maskable-512.png', './icons/apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL.map(u => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const own = url.origin === location.origin;
  // Spieldateien: erst Netz (damit Updates sofort ankommen), sonst Cache
  if (req.mode === 'navigate' || (own && /\.(js|html)$/.test(url.pathname))) {
    // no-cache: beim Server nachfragen, ob es eine neue Version gibt (sonst bis zu 10 Min. alte Dateien)
    let fresh = req; try { fresh = new Request(req, { cache: 'no-cache' }); } catch (_) { }
    e.respondWith(fetch(fresh).then(r => { if (r.ok) { const copy = r.clone(); caches.open(VERSION).then(c => c.put(req.mode === 'navigate' ? './index.html' : req, copy)); } return r; }).catch(() => caches.match(req.mode === 'navigate' ? './index.html' : req)));
    return;
  }
  // Grafik und Schriften: Cache zuerst
  if (own || url.host.endsWith('fonts.googleapis.com') || url.host.endsWith('fonts.gstatic.com')) {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => { if (r && (r.ok || r.type === 'opaque')) { const copy = r.clone(); caches.open(VERSION).then(c => c.put(req, copy)); } return r; })));
  }
});
