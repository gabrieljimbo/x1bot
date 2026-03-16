export const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? '';

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const bytes = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    bytes[i] = rawData.charCodeAt(i);
  }
  return bytes.buffer as ArrayBuffer;
}

export async function requestPushPermission(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  if (!('Notification' in window) || !('serviceWorker' in navigator)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;

  const permission = await Notification.requestPermission();
  return permission === 'granted';
}

export async function subscribeToPush(apiBase: string, authToken: string): Promise<boolean> {
  try {
    if (!VAPID_PUBLIC_KEY) return false;
    const registration = await navigator.serviceWorker.ready;

    // Check if already subscribed
    const existing = await registration.pushManager.getSubscription();
    if (existing) return true;

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });

    const sub = subscription.toJSON();
    await fetch(`${apiBase}/push/subscribe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        endpoint: sub.endpoint,
        keys: { p256dh: sub.keys?.p256dh, auth: sub.keys?.auth },
      }),
    });

    return true;
  } catch (err) {
    console.error('[PUSH] Erro ao registrar subscription:', err);
    return false;
  }
}

export async function setupPushNotifications(apiBase: string, authToken: string): Promise<void> {
  const granted = await requestPushPermission();
  if (!granted) return;
  await subscribeToPush(apiBase, authToken);
}
