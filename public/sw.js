const CACHE_NAME = "axi-v2";

const STATIC_ASSETS = [
  "/offline",
  "/",
  "/manifest.json",
  "/axi-icon-192.png",
  "/axi-icon-512.png",
  "/axi-badge-96.png",
];

self.addEventListener("install", (event) => {
  self.skipWaiting();

  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await Promise.allSettled(
        STATIC_ASSETS.map(async (asset) => {
          try {
            await cache.add(asset);
          } catch (error) {
            console.warn(
              "No se pudo guardar en caché:",
              asset,
              error
            );
          }
        })
      );
    })
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      caches.keys().then((cacheNames) =>
        Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
              return caches.delete(cacheName);
            }

            return Promise.resolve();
          })
        )
      ),
      self.clients.claim(),
    ])
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;

  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);

  if (url.origin !== self.location.origin) {
    return;
  }

  if (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/auth/") ||
    url.pathname.includes("supabase")
  ) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const responseCopy = response.clone();

            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseCopy);
            });
          }

          return response;
        })
        .catch(async () => {
          const cachedPage = await caches.match(request);

          if (cachedPage) {
            return cachedPage;
          }

          return caches.match("/offline") || caches.match("/");
        })
    );

    return;
  }

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(request).then((response) => {
        if (
          !response ||
          response.status !== 200 ||
          response.type === "opaque"
        ) {
          return response;
        }

        const responseCopy = response.clone();

        caches.open(CACHE_NAME).then((cache) => {
          cache.put(request, responseCopy);
        });

        return response;
      });
    })
  );
});

self.addEventListener("push", (event) => {
  let payload = {
    title: "AXI Mobility",
    body: "Tienes una nueva notificación.",
    url: "/dashboard",
    tag: "axi-notification",
  };

  if (event.data) {
    try {
      payload = {
        ...payload,
        ...event.data.json(),
      };
    } catch {
      payload.body = event.data.text();
    }
  }

  const options = {
    body: payload.body,
    icon: "/axi-icon-192.png",
    badge: "/axi-badge-96.png",
    tag: payload.tag,
    renotify: true,
    data: {
      url: payload.url || "/dashboard",
    },
  };

  event.waitUntil(
    self.registration.showNotification(
      payload.title,
      options
    )
  );
});

self.addEventListener(
  "notificationclick",
  (event) => {
    event.notification.close();

    const targetUrl =
      event.notification.data?.url ||
      "/dashboard";

    event.waitUntil(
      self.clients
        .matchAll({
          type: "window",
          includeUncontrolled: true,
        })
        .then((clientList) => {
          for (const client of clientList) {
            if (
              "focus" in client &&
              new URL(client.url).origin ===
                self.location.origin
            ) {
              client.navigate(targetUrl);
              return client.focus();
            }
          }

          return self.clients.openWindow(
            targetUrl
          );
        })
    );
  }
);






