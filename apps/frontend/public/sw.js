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

  const url = event.notification.data?.url ?? '/settings/whatsapp';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(url) && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});
