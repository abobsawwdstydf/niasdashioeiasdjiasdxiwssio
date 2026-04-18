/* eslint-disable no-restricted-globals */

// Unified Notification Service Worker
// Works with both Firebase (mobile) and Web Push (desktop)

const CACHE_NAME = 'nexo-notification-v1';

// Handle push events
self.addEventListener('push', (event) => {
  console.log('[Notification SW] Push received:', event);

  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      try {
        const text = event.data.text();
        data = JSON.parse(text);
      } catch {
        data = { title: 'Nexo', body: event.data.text() };
      }
    }
  }

  const notification = data.notification || data;
  const { title, body, icon, badge, image, data: notificationData } = notification;

  // Determine notification type and actions
  let actions = [];
  const notificationType = notificationData?.type || 'message';

  if (notificationType === 'message') {
    // Message notification - add Reply action
    actions = [
      { action: 'reply', title: 'Ответить', icon: '/logo.png' },
      { action: 'open', title: 'Открыть', icon: '/logo.png' }
    ];
  } else if (notificationType === 'incoming_call') {
    // Call notification - add Accept/Decline actions
    actions = [
      { action: 'accept_call', title: 'Принять', icon: '/logo.png' },
      { action: 'decline_call', title: 'Отклонить', icon: '/logo.png' }
    ];
  } else if (notificationType === 'friend_request') {
    // Friend request - add Accept/Decline actions
    actions = [
      { action: 'accept_friend', title: 'Принять', icon: '/logo.png' },
      { action: 'decline_friend', title: 'Отклонить', icon: '/logo.png' }
    ];
  } else {
    // Default actions
    actions = [
      { action: 'open', title: 'Открыть', icon: '/logo.png' },
      { action: 'dismiss', title: 'Закрыть' }
    ];
  }

  const notificationOptions = {
    body: body || 'Новое сообщение',
    icon: icon || '/logo.png',
    badge: badge || '/logo.png',
    image: image || undefined,
    vibrate: notificationType === 'incoming_call' ? [300, 200, 300, 200, 300, 200, 300] : [200, 100, 200],
    tag: notificationData?.chatId || notificationData?.callerId || 'nexo-default',
    renotify: true,
    data: {
      dateOfArrival: Date.now(),
      primaryKey: Date.now(),
      ...notificationData
    },
    requireInteraction: notificationType === 'incoming_call', // Calls require interaction
    silent: false,
    actions: actions,
    // Add sound for calls on mobile
    sound: notificationType === 'incoming_call' ? '/sounds/call_sound.mp3' : undefined
  };

  event.waitUntil(
    self.registration.showNotification(title || 'Nexo Messenger', notificationOptions)
  );
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  console.log('[Notification SW] Notification click:', event);
  event.notification.close();

  const { action } = event;
  const data = event.notification.data;
  let url = '/';

  // Handle different actions
  if (action === 'reply') {
    // Reply to message - open chat
    if (data?.chatId) {
      url = `/?chat=${data.chatId}&reply=true`;
    }
  } else if (action === 'accept_call') {
    // Accept incoming call
    url = `/?call_action=accept&callerId=${data.callerId || ''}&callType=${data.callType || 'voice'}`;
  } else if (action === 'decline_call') {
    // Decline call - send message to app to decline
    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
        for (const client of windowClients) {
          if (client.url.includes(self.location.origin)) {
            client.postMessage({
              type: 'decline_call',
              callerId: data.callerId,
              callType: data.callType
            });
            return;
          }
        }
      })
    );
    return; // Don't open window for decline
  } else if (action === 'accept_friend') {
    // Accept friend request
    url = `/?friend_action=accept&friendRequestId=${data.friendRequestId || ''}`;
  } else if (action === 'decline_friend') {
    // Decline friend request
    url = `/?friend_action=decline&friendRequestId=${data.friendRequestId || ''}`;
  } else if (action === 'dismiss') {
    // Just close notification
    return;
  } else if (action === 'open' || !action) {
    // Default open action - build URL based on notification type
    if (data?.type === 'incoming_call') {
      url = `/?call_action=incoming&callerId=${data.callerId || ''}&callType=${data.callType || 'voice'}`;
    } else if (data?.chatId) {
      url = `/?chat=${data.chatId}`;
    } else if (data?.friendRequestId) {
      url = `/?friend_request=${data.friendRequestId}`;
    }
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Try to focus existing visible window
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && client.visibilityState === 'visible') {
          client.postMessage({
            type: 'notification_click',
            action,
            data
          });
          return client.focus();
        }
      }

      // Focus any existing window
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin)) {
          return client.focus().then(() => {
            client.postMessage({
              type: 'notification_click',
              action,
              data
            });
          });
        }
      }

      // Open new window
      return clients.openWindow(url);
    })
  );
});

// Handle messages from the main app
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data?.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.delete(CACHE_NAME)
    );
  }
});

// Install event - cache assets
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll([
        '/',
        '/logo.png'
      ]);
    })
  );
});

// Activate event
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  return self.clients.claim();
});
