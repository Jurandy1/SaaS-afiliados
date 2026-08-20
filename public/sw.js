self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : {};
  const origin = self.location.origin;
  const abs = (u) => {
    if (!u) return undefined;
    if (/^https?:\/\//i.test(u)) return u;
    return origin + (u.startsWith("/") ? u : `/${u}`);
  };
  const title = data.title || "Lucro Líquido";
  const options = {
    body: data.body || "Seus dados foram atualizados.",
    icon: abs(data.icon) || `${origin}/assets/push/shopee-bag-150.png`,
    badge: abs(data.badge) || `${origin}/assets/push/shopee-coin-72.png`,
    image: abs(data.image),
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
  if (event.action === "close") return;
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
