self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
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
