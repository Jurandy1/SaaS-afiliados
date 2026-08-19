self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || "Metricly — Vendas atualizadas";
  const options = {
    body: data.body || "Seus dados foram atualizados.",
    icon: "/assets/radar.png",
    badge: "/assets/radar.png",
    tag: data.tag || "vendas-dia",
    renotify: true,
    data: { url: data.url || "/" },
    vibrate: [200, 100, 200],
    actions: [{ action: "open", title: "Ver dashboard" }],
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if (client.url.includes(url) && "focus" in client) return client.focus();
      }
      return clients.openWindow(url);
    }),
  );
});
