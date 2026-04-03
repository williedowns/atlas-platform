const CACHE_NAME = "atlas-spas-v3";
const OFFLINE_DB = "atlas-offline";
const APP_SHELL = ["/", "/dashboard", "/contracts/new", "/login"];

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
}

async function replayQueue() {
  const db = await openOfflineDB();
  const tx = db.transaction("requests", "readwrite");
  const store = tx.objectStore("requests");
  const all = await new Promise((resolve) => {
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve([]);
  });

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
      }
    } catch {
      // Still offline — leave in queue
    }
  }
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
    (url.pathname.startsWith("/api/contracts") || url.pathname.startsWith("/api/payments"))
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

  // Navigation: network-first, fall back to cached shell
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match("/").then((cached) => cached || fetch(request))
      )
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
