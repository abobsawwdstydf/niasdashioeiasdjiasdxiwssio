// Web Push API configuration
const VAPID_PUBLIC_KEY = 'BPVXBg4HHqwRgo2rX4fnScnnL1bD0AgeSyAiufQluXGctTM0WsSD8VqJx5DUsUsev4uP1pCH42qRGFg8PsrbDd0';
const VAPID_PRIVATE_KEY = 'fykh4MzH9dDTD_xK2oTzJG7KIzzmnedIY7I7zs6W9d4';

// Generate VAPID keys (run this once on server)
// const webPush = require('web-push');
// const vapidKeys = webPush.generateVAPIDKeys();
// console.log('Public Key:', vapidKeys.publicKey);
// console.log('Private Key:', vapidKeys.privateKey);

// Initialize service worker
export async function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.register('/web-push-sw.js', {
        scope: '/'
      });
      console.log('[Web Push] Service Worker registered:', registration.scope);
      return registration;
    } catch (error) {
      console.error('[Web Push] Service Worker registration failed:', error);
      return null;
    }
  }
  return null;
}

// Request notification permission and subscribe
export async function requestPushPermission(): Promise<PushSubscription | null> {
  if (!('Notification' in window)) {
    console.log('[Web Push] Notifications not supported');
    return null;
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.log('[Web Push] Notification permission denied');
      return null;
    }

    const registration = await registerServiceWorker();
    if (!registration) return null;

    // Subscribe to push notifications
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as any
    });

    console.log('[Web Push] Subscribed:', subscription);
    return subscription;
  } catch (error) {
    console.error('[Web Push] Subscription failed:', error);
    return null;
  }
}

// Get current subscription
export async function getPushSubscription(): Promise<PushSubscription | null> {
  const registration = await navigator.serviceWorker.ready;
  return registration.pushManager.getSubscription();
}

// Unsubscribe from push notifications
export async function unsubscribeFromPush(): Promise<boolean> {
  const subscription = await getPushSubscription();
  if (subscription) {
    return subscription.unsubscribe();
  }
  return false;
}

// Helper function to convert VAPID key
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray as unknown as Uint8Array;
}

// Send subscription to server
export async function sendSubscriptionToServer(subscription: PushSubscription): Promise<void> {
  try {
    const response = await fetch('/api/users/push-subscription', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ subscription })
    });
    
    if (!response.ok) {
      throw new Error('Failed to save subscription');
    }
    
    console.log('[Web Push] Subscription saved to server');
  } catch (error) {
    console.error('[Web Push] Failed to save subscription:', error);
  }
}
