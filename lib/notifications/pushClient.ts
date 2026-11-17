export interface PushPreferences {
  notify_daily: boolean;
  notify_weekly: boolean;
  notify_monthly: boolean;
}

export function isPushNotificationSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

export function isIOSDevice(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

export function isPWAStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const isStandaloneMedia = window.matchMedia('(display-mode: standalone)').matches;
  const isNavigatorStandalone = (navigator as any).standalone === true;
  return isStandaloneMedia || isNavigatorStandalone;
}

export function getNotificationPermission(): NotificationPermission {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'default';
  }
  return Notification.permission;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Register Service Worker if not registered yet.
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!isPushNotificationSupported()) return null;

  try {
    const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    await navigator.serviceWorker.ready;
    return reg;
  } catch (err) {
    console.error('Failed to register service worker for push:', err);
    return null;
  }
}

/**
 * Get active push subscription on this device.
 */
export async function getCurrentPushSubscription(): Promise<PushSubscription | null> {
  if (!isPushNotificationSupported()) return null;

  try {
    const reg = await registerServiceWorker();
    if (!reg) return null;
    return await reg.pushManager.getSubscription();
  } catch (err) {
    console.warn('Could not get current push subscription:', err);
    return null;
  }
}

/**
 * Request notification permission and subscribe this browser/device to Web Push.
 */
export async function subscribeToPushNotifications(
  preferences: PushPreferences = {
    notify_daily: true,
    notify_weekly: true,
    notify_monthly: true,
  }
): Promise<{ success: boolean; error?: string; subscription?: PushSubscription }> {
  if (!isPushNotificationSupported()) {
    return { success: false, error: 'Web Push is not supported in this browser.' };
  }

  // iOS 16.4+ standalone requirement check
  if (isIOSDevice() && !isPWAStandalone()) {
    return {
      success: false,
      error:
        'On iPhone or iPad, please add PocketLog to your Home Screen first (Share -> Add to Home Screen) to receive notifications.',
    };
  }

  try {
    // 1. Request permission
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return {
        success: false,
        error:
          permission === 'denied'
            ? 'Notification permission was denied. Please allow notifications in your browser or device settings.'
            : 'Notification permission was not granted.',
      };
    }

    // 2. Ensure Service Worker is registered
    const reg = await registerServiceWorker();
    if (!reg) {
      return { success: false, error: 'Failed to initialize Service Worker.' };
    }

    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapidKey) {
      return { success: false, error: 'VAPID Public Key is not configured on the server.' };
    }

    // 3. Subscribe with PushManager
    const existing = await reg.pushManager.getSubscription();
    let sub = existing;
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey) as unknown as BufferSource,
      });
    }

    // 4. Send subscription keys to backend API
    const subJSON = sub.toJSON();
    const res = await fetch('/api/notifications/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subscription: {
          endpoint: sub.endpoint,
          keys: {
            p256dh: subJSON.keys?.p256dh,
            auth: subJSON.keys?.auth,
          },
        },
        preferences,
      }),
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      return { success: false, error: data.error || 'Failed to save notification subscription.' };
    }

    return { success: true, subscription: sub };
  } catch (err: any) {
    console.error('subscribeToPushNotifications error:', err);
    return { success: false, error: err?.message || 'Failed to subscribe to push notifications.' };
  }
}

/**
 * Unsubscribe this device from push notifications.
 */
export async function unsubscribeFromPushNotifications(): Promise<{ success: boolean; error?: string }> {
  try {
    const sub = await getCurrentPushSubscription();
    if (sub) {
      const endpoint = sub.endpoint;
      await sub.unsubscribe();

      await fetch('/api/notifications/subscribe', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint }),
      });
    }
    return { success: true };
  } catch (err: any) {
    console.error('unsubscribeFromPushNotifications error:', err);
    return { success: false, error: err?.message || 'Failed to disable notifications.' };
  }
}
