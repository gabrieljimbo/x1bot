self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(clients.claim()));

self.addEventListener('push', (event) => {
  if (!event.data) return;

  let data;
  try {
    data = event.data.json();
  } catch {
    data = { title: 'X1Bot', body: event.data.text() };
  }

  event.waitUntil(
    self.registration.showNotification(data.title ?? 'X1Bot', {
      body: data.body ?? '',
      icon: data.icon ?? '/logo.png',
      badge: '/logo.png',
      vibrate: [200, 100, 200],
      data: data.data ?? {},
      actions: [
        { action: 'view', title: 'Ver sessoes' },
        { action: 'dismiss', title: 'Dispensar' },
      ],
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') return;

  const url = event.notification.data?.url ?? '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Navegar qualquer aba já aberta do mesmo origin para a URL da notificação
      for (const client of clientList) {
        if (client.url.startsWith(self.location.origin) && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      // Nenhuma aba aberta — abrir nova
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});
