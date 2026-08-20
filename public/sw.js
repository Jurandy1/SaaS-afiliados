self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : {};
  const origin = self.location.origin;
  const abs = (u) => {
    if (!u) return undefined;
    if (/^https?:\/\//i.test(u)) return u;
    return origin + (u.startsWith("/") ? u : `/${u}`);
  };

  event.waitUntil((async () => {
    const title = data.title || "Lucro Líquido";
    const image = abs(data.image);
    const icon = abs(data.icon) || `${origin}/assets/shopee.png`;
    const badge = abs(data.badge) || `${origin}/assets/push/shopee-coin-72.png`;

    // Pré-baixa a imagem do banner — no Android o Chrome só mostra se conseguir baixar a tempo
    if (image) {
      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 12000);
        await fetch(image, { signal: ctrl.signal, cache: "no-cache", mode: "cors" });
        clearTimeout(t);
      } catch (_) { /* segue sem banner se falhar */ }
    }

    await self.registration.showNotification(title, {
      body: data.body || "Seus dados foram atualizados.",
      icon,
      badge,
      image,
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
    });
  })());
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
