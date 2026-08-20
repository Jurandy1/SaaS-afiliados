self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || "COMISSÃO TOTAL";
  const options = {
    body: data.body || "Seus dados foram atualizados.",
    icon: data.icon || "/assets/push/shopee-coin-192.png",
    badge: data.badge || "/assets/push/shopee-coin-72.png",
    image: data.image || undefined,
    tag: data.tag || "comissao-ontem",
    renotify: true,
    requireInteraction: false,
    data: {
      url: data.url || "/",
      com: data.com,
      lucro: data.lucro,
      pedidos: data.pedidos,
      date: data.date,
    },
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
