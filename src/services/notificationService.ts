import { supabase } from './supabase';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

// Base64 helper for VAPID key
function urlBase64ToUint8Array(base64String: string) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
        .replace(/\-/g, '+')
        .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

export const subscribeToPushNotifications = async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        throw new Error('Push messaging is not supported');
    }

    // 1. Request Permission
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
        throw new Error('Notification permission denied');
    }

    // 2. Get Service Worker Registration
    const registration = await navigator.serviceWorker.ready;

    // 3. Subscribe
    const subscribeOptions = {
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
    };

    const subscription = await registration.pushManager.subscribe(subscribeOptions);

    // 4. Save to Database
    const { error } = await supabase.rpc('upsert_push_subscription', {
        p_subscription: subscription.toJSON(), // Important: toJSON()
        p_user_agent: navigator.userAgent
    });

    if (error) throw error;

    return subscription;
};

export const unsubscribeFromPushNotifications = async () => {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
        await subscription.unsubscribe();
        // Ideally remove from DB too, but not strictly required if we handle 410 Gone on sends
    }
};
