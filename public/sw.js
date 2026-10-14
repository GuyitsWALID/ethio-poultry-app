const STATIC_CACHE = "ethiopoultry-static-v2";
const OFFLINE_SHELL = "/offline";
const SAFE_STATIC_PATHS = ["/app-icon.svg", "/app-icon-maskable.svg", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil((async()=>{
    const cache=await caches.open(STATIC_CACHE);
    const shell=await fetch(OFFLINE_SHELL,{credentials:"omit",cache:"reload"});
    if(!shell.ok||shell.headers.get("X-Offline-Shell")!=="public-v1")throw Error("Unsafe offline shell response");
    const html=await shell.clone().text();
    const assets=[...new Set([...html.matchAll(/(?:src|href)="([^"<>]+)"/g)].map(match=>match[1]).filter(path=>path.startsWith("/_next/static/")))];
    if(!assets.length)throw Error("Offline shell assets missing");
    await cache.addAll([...SAFE_STATIC_PATHS,...assets]);
    await cache.put(OFFLINE_SHELL,shell);
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith("ethiopoultry-static-") && key !== STATIC_CACHE).map((key) => caches.delete(key)))),
  );
  self.clients.claim();
});

// Background Sync only wakes foreground clients. It never caches credentials
// or sends protected commands without their online session/assignment refresh.
self.addEventListener("sync", (event) => {
  if (event.tag !== "ethiopoultry-today-outbox") return;
  event.waitUntil(self.clients.matchAll({type: "window", includeUncontrolled: true}).then((clients) => {
    for (const client of clients) client.postMessage({type: "ethiopoultry:sync-outbox"});
  }));
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if(request.mode==="navigate"&&(url.pathname==="/app/today"||url.pathname==="/app/farm-manager"||url.pathname===OFFLINE_SHELL)){
    event.respondWith(fetch(request).catch(async()=>{
      const shell=await (await caches.open(STATIC_CACHE)).match(OFFLINE_SHELL);
      return shell??Response.error();
    }));
    return;
  }

  const safeStatic = url.pathname.startsWith("/_next/static/") || SAFE_STATIC_PATHS.includes(url.pathname);
  if (!safeStatic) return;

  event.respondWith(
    caches.open(STATIC_CACHE).then(async (cache) => {
      const cached = await cache.match(request);
      if (cached) return cached;
      const response = await fetch(request);
      if (response.ok) await cache.put(request, response.clone());
      return response;
    }),
  );
});
