/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
// Service Worker: Web-Push für Alarme. Bewusst OHNE Offline-Cache — ein Monitoring-Dashboard,
// das veraltete Werte aus dem Cache zeigt, ist schlimmer als eines, das offline leer bleibt.

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { title: 'Homelab', body: event.data && event.data.text() }; }
  const kritisch = data.severity === 'critical';
  event.waitUntil(self.registration.showNotification(data.title || 'Homelab', {
    body: data.body || '',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    // Gleiche Meldung ersetzt die alte, statt den Sperrbildschirm zu fluten.
    tag: data.tag || 'homelab',
    renotify: true,
    requireInteraction: kritisch,
    data: { url: data.url || '/alerts' },
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/alerts';
  event.waitUntil((async () => {
    const fenster = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const f of fenster) {
      if ('focus' in f) { await f.focus(); if ('navigate' in f) { try { await f.navigate(url); } catch { /* egal */ } } return; }
    }
    await self.clients.openWindow(url);
  })());
});
