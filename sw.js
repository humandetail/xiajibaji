const CACHE = "xiajibaji-shell-v1";
const ASSETS = [
  "./",
  "./index.html",
  "./app.css",
  "./src/app.js",
  "./src/data.js",
  "./src/export.js",
  "./src/images.js",
  "./src/settings.js",
  "./src/offline.js",
  "./manifest.webmanifest",
  "./icons/icon.svg",
  "./icons/icon-180.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
];
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting()),
  );
});
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter(
              (key) => key.startsWith("xiajibaji-shell-") && key !== CACHE,
            )
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});
self.addEventListener("fetch", (event) => {
  if (
    event.request.method !== "GET" ||
    new URL(event.request.url).origin !== self.location.origin
  )
    return;
  event.respondWith(
    (async () => {
      if (event.request.mode === "navigate") {
        try {
          return await fetch(event.request);
        } catch {
          return (await caches.match("./")) || Response.error();
        }
      }
      return (
        (await caches.match(event.request, { ignoreSearch: true })) ||
        fetch(event.request)
      );
    })(),
  );
});
