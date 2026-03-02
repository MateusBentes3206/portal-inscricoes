// service-worker.js
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow('./tickets.html'));
});

// Escuta mensagens da página para tocar som (via cliente)
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'play-sound') {
    // Notifica todas as páginas abertas para tocar o som
    self.clients.matchAll().then(clients => {
      clients.forEach(client => {
        client.postMessage({ type: 'play-sound', sound: event.data.sound });
      });
    });
  }
});

// Quando receber uma notificação push (se usar FCM no futuro)
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
