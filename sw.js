const worker = /** @type {ServiceWorkerGlobalScope} */ (
  /** @type {unknown} */ (self)
);
const CACHE = "xiajibaji-shell-v2";
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
worker.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => worker.skipWaiting()),
  );
});
worker.addEventListener("activate", (event) => {
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
      .then(() => worker.clients.claim()),
  );
});
worker.addEventListener("fetch", (event) => {
  if (
    event.request.method !== "GET" ||
    new URL(event.request.url).origin !== worker.location.origin
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
