// service-worker.js
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow('./tickets.html'));
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'play-sound') {
    self.clients.matchAll().then(clients => {
      clients.forEach(client => {
        client.postMessage({ type: 'play-sound', sound: event.data.sound });
      });
    });
  }
});

// Para notificações push (não usamos, mas pode ficar)
self.addEventListener('push', (event) => {
  const data = event.data.json();
  const options = {
    body: data.body,
    icon: './assets/icons/icon-192x192.png',
    badge: './assets/icons/badge-72x72.png'
  };
  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});