// Service Worker für Twitter Engagement Bot PWA
const CACHE_NAME = 'twitter-bot-v1.2.0';
const BACKEND_URL = 'https://d74c63e7-67ab-4986-8385-15d94c71bdce.preview.emergentagent.com';

// Dateien, die gecacht werden sollen
const urlsToCache = [
  '/',
  '/static/js/bundle.js',
  '/static/css/main.css',
  '/manifest.json'
];

// API-Endpunkte, die gecacht werden sollen (für Offline-Funktionalität)
const apiEndpointsToCache = [
  `${BACKEND_URL}/api/health`,
  `${BACKEND_URL}/api/target-accounts`,
  `${BACKEND_URL}/api/comments`,
  `${BACKEND_URL}/api/settings`,
  `${BACKEND_URL}/api/logs`
];

// Installation des Service Workers
self.addEventListener('install', (event) => {
  console.log('Twitter Bot PWA: Service Worker wird installiert');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Cache wird geöffnet');
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        console.log('Twitter Bot PWA: Installation abgeschlossen');
        return self.skipWaiting();
      })
  );
});

// Aktivierung des Service Workers
self.addEventListener('activate', (event) => {
  console.log('Twitter Bot PWA: Service Worker wird aktiviert');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Alte Cache wird gelöscht:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('Twitter Bot PWA: Aktivierung abgeschlossen');
      return self.clients.claim();
    })
  );
});

// Fetch-Event Handler für Caching-Strategien
self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);
  
  // Strategie für API-Anfragen: Network First mit Fallback auf Cache
  if (requestUrl.origin === new URL(BACKEND_URL).origin && requestUrl.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Nur erfolgreiche GET-Requests cachen
          if (event.request.method === 'GET' && response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          // Bei Netzwerkfehler: Versuche aus Cache zu laden
          return caches.match(event.request);
        })
    );
    return;
  }

  // Strategie für statische Dateien: Cache First
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Cache-Hit - gib gecachte Version zurück
        if (response) {
          return response;
        }

        // Kein Cache-Hit - lade vom Netzwerk
        return fetch(event.request).then((response) => {
          // Prüfe ob die Antwort gültig ist
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }

          // Clone der Antwort für Cache
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });

          return response;
        });
      })
  );
});

// Background Sync für Bot-Aktionen (falls verfügbar)
self.addEventListener('sync', (event) => {
  if (event.tag === 'bot-action-sync') {
    console.log('Twitter Bot PWA: Background Sync für Bot-Aktionen');
    event.waitUntil(
      // Hier könnten wir Offline-Bot-Aktionen synchronisieren
      syncPendingActions()
    );
  }
});

// Push-Benachrichtigungen für Bot-Status
self.addEventListener('push', (event) => {
  console.log('Twitter Bot PWA: Push-Nachricht empfangen');
  
  const options = {
    body: event.data ? event.data.text() : 'Twitter Bot Status Update',
    icon: '/icon-192x192.png',
    badge: '/icon-192x192.png',
    vibrate: [200, 100, 200],
    tag: 'twitter-bot-notification',
    requireInteraction: true,
    actions: [
      {
        action: 'open',
        title: 'Bot öffnen',
        icon: '/icon-192x192.png'
      },
      {
        action: 'dismiss',
        title: 'Schließen'
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification('Twitter Engagement Bot', options)
  );
});

// Notification Click Handler
self.addEventListener('notificationclick', (event) => {
  console.log('Twitter Bot PWA: Benachrichtigung angeklickt');
  
  event.notification.close();

  if (event.action === 'open') {
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});

// Hilfsfunktion für Background Sync
async function syncPendingActions() {
  try {
    // Hier könnten wir gespeicherte Offline-Aktionen verarbeiten
    console.log('Twitter Bot PWA: Synchronisiere ausstehende Aktionen');
    return Promise.resolve();
  } catch (error) {
    console.error('Twitter Bot PWA: Fehler beim Synchronisieren:', error);
    throw error;
  }
}