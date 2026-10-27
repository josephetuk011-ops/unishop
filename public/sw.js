self.addEventListener('push', (event) => {
  let data = { title: 'Unishop', body: '', url: '/dashboard.html' };
  try { data = { ...data, ...event.data.json() }; } catch {}
  event.waitUntil(self.registration.showNotification(data.title, { body: data.body, icon: '/assets/unishop-logo.jpeg', data: { url: data.url } }));
});
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/dashboard.html';
  event.waitUntil(self.clients.matchAll({ type: 'window' }).then((windows) => {
    const open = windows.find((client) => client.url.includes(url));
    return open ? open.focus() : self.clients.openWindow(url);
  }));
});
