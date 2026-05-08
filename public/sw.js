// Keep OFFLINE_DB / store / message types in sync with src/lib/offline-queue.ts
const CACHE_NAME = "atlas-spas-v3";
const OFFLINE_DB = "atlas-offline";
const APP_SHELL = ["/", "/dashboard", "/contracts/new", "/login"];
const QUEUEABLE_POST_PATHS = ["/api/contracts", "/api/payments", "/api/quotes"];
const MSG_QUEUED = "QUEUE_REQUEST_QUEUED";
const MSG_DRAINED = "QUEUE_REQUEST_DRAINED";

async function broadcast(type) {
  const clients = await self.clients.matchAll({ includeUncontrolled: true });
  for (const c of clients) c.postMessage({ type });
}

// ─── Install ──────────────────────────────────────────────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(APP_SHELL).catch(() => {
        // Don't fail install if pre-cache misses (routes may need auth)
      });
    })
  );
  self.skipWaiting();
});

// ─── Activate ─────────────────────────────────────────────────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
      )
  );
  self.clients.claim();
});

// ─── IndexedDB helpers ────────────────────────────────────────────────────────
function openOfflineDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(OFFLINE_DB, 1);
    req.onupgradeneeded = (e) => {
      e.target.result.createObjectStore("requests", { keyPath: "id", autoIncrement: true });
    };
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = reject;
  });
}

async function queueRequest(request) {
  let body = "";
  try {
    body = await request.clone().text();
  } catch {}
  const db = await openOfflineDB();
  const tx = db.transaction("requests", "readwrite");
  tx.objectStore("requests").add({
    url: request.url,
    method: request.method,
    body,
    headers: Object.fromEntries(request.headers.entries()),
    timestamp: Date.now(),
  });
  await new Promise((resolve) => { tx.oncomplete = resolve; });
  broadcast(MSG_QUEUED);
}

async function replayQueue() {
  const db = await openOfflineDB();
  const all = await new Promise((resolve) => {
    const tx = db.transaction("requests", "readonly");
    const req = tx.objectStore("requests").getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve([]);
  });

  let drained = 0;
  for (const item of all) {
    try {
      const res = await fetch(item.url, {
        method: item.method,
        body: item.body || undefined,
        headers: item.headers,
      });
      if (res.ok) {
        const deleteTx = db.transaction("requests", "readwrite");
        deleteTx.objectStore("requests").delete(item.id);
        drained += 1;
      }
    } catch {
      // Still offline — leave in queue
    }
  }
  if (drained > 0) broadcast(MSG_DRAINED);
}

// ─── Fetch handler ────────────────────────────────────────────────────────────
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Static assets: cache-first
  if (
    url.pathname.startsWith("/_next/static") ||
    url.pathname.match(/\.(png|jpg|jpeg|svg|ico|woff|woff2|ttf)$/)
  ) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((res) => {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
            return res;
          })
      )
    );
    return;
  }

  // Critical write APIs: queue if offline
  if (
    request.method === "POST" &&
    QUEUEABLE_POST_PATHS.some((p) => url.pathname.startsWith(p))
  ) {
    event.respondWith(
      fetch(request.clone()).catch(async () => {
        await queueRequest(request);
        return new Response(JSON.stringify({ queued: true, offline: true }), {
          status: 202,
          headers: { "Content-Type": "application/json" },
        });
      })
    );
    return;
  }

  // Navigation: network-first, fall back to cached shell.
  //
  // iOS Safari refuses to render a Response from a service worker if the
  // underlying fetch followed any redirects (response.redirected === true)
  // and throws "Response served by service worker has redirections".
  // This kills the app for anyone whose fetch went through a 30x — for
  // example a logged-out customer hitting /contracts/new and getting
  // bounced to /login. Rebuild the response without redirect metadata so
  // Safari will accept it.
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const response = await fetch(request);
          if (!response.redirected) return response;
          const body = await response.blob();
          return new Response(body, {
            status: response.status,
            statusText: response.statusText,
            headers: response.headers,
          });
        } catch {
          const cached = await caches.match("/");
          return cached || fetch(request);
        }
      })()
    );
    return;
  }
});

// ─── Background sync ──────────────────────────────────────────────────────────
self.addEventListener("sync", (event) => {
  if (event.tag === "replay-queue") {
    event.waitUntil(replayQueue());
  }
});

// Replay when connection restored
self.addEventListener("message", (event) => {
  if (event.data === "REPLAY_QUEUE") {
    replayQueue();
  }
});
