// ═══════════════════════════════════════════════════════════════
// Fredinho — Service Worker
// Versão: 1.0
// Responsável por: cache offline + recepção de push notifications
// ═══════════════════════════════════════════════════════════════

const CACHE_NAME = 'fredinho-v1';
const OFFLINE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

// ── Instalação: pré-cacheia arquivos essenciais ──
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(OFFLINE_URLS).catch(err => {
        // Não falha se algum ícone ainda não existir
        console.warn('[SW] Cache parcial:', err);
      });
    })
  );
  self.skipWaiting();
});

// ── Ativação: remove caches antigos ──
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ── Fetch: serve do cache quando offline ──
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  if (!event.request.url.startsWith(self.location.origin)) return;
  event.respondWith(
    caches.match(event.request).then(cached => {
      return cached || fetch(event.request).then(response => {
        // Cacheia respostas bem-sucedidas de arquivos locais
        if (response.ok && event.request.url.startsWith(self.location.origin)) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => cached || new Response('Offline', { status: 503 }));
    })
  );
});

// ── Push: recebe notificação do servidor ──
self.addEventListener('push', event => {
  let data = { title: 'Fredinho', body: 'Você tem um novo convite.' };

  try {
    if (event.data) {
      const parsed = event.data.json();
      data = { ...data, ...parsed };
    }
  } catch (e) {
    if (event.data) data.body = event.data.text();
  }

  const options = {
    body: data.body,
    icon: data.icon || '/icons/icon-192.png',
    badge: data.badge || '/icons/icon-192.png',
    image: data.image || undefined,
    data: {
      url: data.url || '/',
      experience_id: data.experience_id || null,
    },
    actions: data.actions || [
      { action: 'open', title: 'Ver agora' },
      { action: 'dismiss', title: 'Depois' },
    ],
    requireInteraction: false,
    silent: false,
    vibrate: [200, 100, 200],
    tag: data.tag || 'fredinho-convite',
    renotify: true,
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// ── Clique na notificação ──
self.addEventListener('notificationclick', event => {
  event.notification.close();

  const targetUrl = (event.notification.data && event.notification.data.url)
    ? event.notification.data.url
    : '/';

  if (event.action === 'dismiss') return;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      // Se o app já está aberto, foca nele
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus();
          client.postMessage({ type: 'NOTIFICATION_CLICK', url: targetUrl });
          return;
        }
      }
      // Senão, abre uma nova janela
      if (clients.openWindow) return clients.openWindow(targetUrl);
    })
  );
});

// ── Push subscription change (renovação automática) ──
self.addEventListener('pushsubscriptionchange', event => {
  event.waitUntil(
    self.registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: event.oldSubscription
        ? event.oldSubscription.options.applicationServerKey
        : null,
    }).then(subscription => {
      // Notifica o servidor da nova subscription
      return fetch('/api/push/renew', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: subscription.toJSON() }),
      }).catch(() => console.warn('[SW] Falha ao renovar subscription'));
    })
  );
});