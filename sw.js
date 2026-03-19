// ════════════════════════════════════════════════
// Fredinho — Service Worker
// Versão: 1.0
// ════════════════════════════════════════════════

const CACHE_NAME = 'fredinho-v1';
const ASSETS = [
  '/',
  '/index.html',
];

// ── Instalação: cacheia assets principais ──
self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)).catch(() => {})
  );
});

// ── Ativação: limpa caches antigos ──
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// ── Fetch: serve do cache quando offline ──
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});

// ── Push: exibe notificação quando chega mensagem ──
self.addEventListener('push', e => {
  let data = { title: 'Fredinho', body: 'Você tem um novo convite.', url: '/' };
  try {
    if (e.data) data = { ...data, ...e.data.json() };
  } catch (_) {
    if (e.data) data.body = e.data.text();
  }

  const options = {
    body:    data.body,
    icon:    '/icons/icon-192.png',
    badge:   '/icons/icon-192.png',
    image:   data.image || undefined,
    data:    { url: data.url || '/' },
    vibrate: [100, 50, 100],
    actions: data.actions || [],
    tag:     data.tag || 'fredinho-notif',
    renotify: true,
  };

  e.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// ── Clique na notificação: abre o app ──
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = e.notification.data?.url || '/';
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      const existing = list.find(c => c.url.includes(self.location.origin));
      if (existing) return existing.focus();
      return clients.openWindow(url);
    })
  );
});