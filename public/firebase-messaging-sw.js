self.addEventListener('push', function(event) {
  const notificationData = event.data?.json() || {};
  const title = notificationData?.notification?.title || 'WarGram';
  const options = {
    body: notificationData?.notification?.body || 'You have a new notification',
    icon: '/icon-192x192.png',
    data: notificationData?.data || {},
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      if (clientList.length > 0) {
        const client = clientList[0];
        return client.focus();
      }
      return clients.openWindow('/');
    })
  );
});
