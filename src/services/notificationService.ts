import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import { auth } from '@/integrations/firebase/config';
import { supabase } from '@/integrations/supabase/client';

export class NotificationService {
  private messaging = getMessaging();

  private async savePushToken(token: string, platform: string) {
    const user = auth.currentUser;
    if (!user || !token) return;

    await supabase.rpc('register_push_token' as any, {
      _user_id: user.uid,
      _token: token,
      _platform: platform,
    } as any);
  }

  async initialize() {
    if (Capacitor.isNativePlatform()) {
      await this.initializeNative();
    } else {
      await this.initializeWeb();
    }
  }

  private async initializeWeb() {
    try {
      const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
      if (!vapidKey) {
        console.warn('VITE_FIREBASE_VAPID_KEY not set; skipping web push registration');
      } else if ('Notification' in window && Notification.permission === 'granted') {
        const registration = 'serviceWorker' in navigator
          ? await navigator.serviceWorker.ready.catch(() => undefined)
          : undefined;
        const token = await getToken(this.messaging, {
          vapidKey,
          serviceWorkerRegistration: registration,
        });
        console.log('FCM Token:', token);
        await this.savePushToken(token, 'web');
      }

      onMessage(this.messaging, (payload) => {
        console.log('Message received:', payload);
        this.showNotification(payload);
      });
    } catch (error) {
      console.error('Error getting FCM token:', error);
    }
  }

  private async initializeNative() {
    try {
      const result = await PushNotifications.requestPermissions();
      if (result.receive === 'granted') {
        await PushNotifications.register();
      }

      PushNotifications.addListener('registration', (token) => {
        console.log('Push registration success, token:', token.value);
        this.savePushToken(token.value, Capacitor.getPlatform()).catch(console.error);
      });

      PushNotifications.addListener('registrationError', (error) => {
        console.error('Error on registration:', error);
      });

      PushNotifications.addListener('pushNotificationReceived', (notification) => {
        console.log('Push notification received:', notification);
      });

      PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
        console.log('Push notification action performed:', notification);
      });
    } catch (error) {
      console.error('Error initializing push notifications:', error);
    }
  }

  private showNotification(payload: any) {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(payload.notification?.title || 'WarGram', {
        body: payload.notification?.body,
        icon: '/favicon.ico',
      });
    }
  }

  async requestPermission() {
    if (Capacitor.isNativePlatform()) {
      const result = await PushNotifications.requestPermissions();
      if (result.receive === 'granted') {
        await PushNotifications.register();
        return true;
      }
      return false;
    }

    if ('Notification' in window) {
      try {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
          await this.initializeWeb();
        }
        return permission === 'granted';
      } catch (error) {
        console.error('Error requesting notification permission:', error);
        return false;
      }
    }
    return false;
  }
}

export const notificationService = new NotificationService();
