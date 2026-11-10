/* STICK ARENA por Lucas — service worker raiz (escopo total, deixa instalável + abre offline) */
const CACHE = "stick-arena-v5";
const FILES = ["./", "./index.html", "./src/manifest.webmanifest", "./src/icon-192.png", "./src/icon-512.png", "./src/icon-mask.png", "./src/config.js", "./src/profile.js", "./src/net.js", "./src/engine.js", "./src/ui.js", "./src/game.js", "./client/config-server.js"];
self.addEventListener("install", (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener("activate", (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET" || !e.request.url.startsWith(self.location.origin)) return;
  e.respondWith(caches.match(e.request).then((hit) => hit || fetch(e.request).then((res) => {
    const copy = res.clone();
    caches.open(CACHE).then((c) => c.put(e.request, copy));
    return res;
  }).catch(() => caches.match("./index.html"))));
});
