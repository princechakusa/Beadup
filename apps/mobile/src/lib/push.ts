import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { router } from 'expo-router';
import { Platform } from 'react-native';

import { supabase } from './supabase';

// Booking alerts (optional; the app works fully without them, Apple 4.5.4).
// Permission is only ever requested from the Settings toggle, never at launch.

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

const projectId: string | undefined =
  Constants.easConfig?.projectId ?? (Constants.expoConfig?.extra?.eas as { projectId?: string } | undefined)?.projectId;

export type PushState = 'on' | 'off' | 'denied' | 'unavailable';

let currentToken: string | null = null;

async function ensureChannel() {
  if (Platform.OS !== 'android') return;
  // Android 13+ only shows the permission prompt once a channel exists.
  await Notifications.setNotificationChannelAsync('bookings', {
    name: 'Bookings and payments',
    importance: AndroidImportance.HIGH,
  });
}

async function token(): Promise<string | null> {
  if (!projectId) return null; // needs an EAS project (set up before the first store build)
  try {
    return (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  } catch {
    return null; // offline or no Play Services: alerts stay off, nothing else breaks
  }
}

export async function pushState(): Promise<PushState> {
  if (!supabase || !projectId) return 'unavailable';
  const perm = await Notifications.getPermissionsAsync();
  if (!perm.granted) return perm.canAskAgain ? 'off' : 'denied';
  const t = await token();
  if (!t) return 'off';
  const { data } = await supabase.from('push_tokens').select('token').eq('token', t).maybeSingle();
  return data ? 'on' : 'off';
}

/** Asks for permission (from the Settings toggle) and registers this device. */
export async function enablePush(): Promise<PushState> {
  if (!supabase || !projectId) return 'unavailable';
  await ensureChannel();
  const perm = await Notifications.requestPermissionsAsync();
  if (!perm.granted) return perm.canAskAgain ? 'off' : 'denied';
  const t = await token();
  if (!t) return 'off';
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return 'off';
  const { error } = await supabase
    .from('push_tokens')
    .upsert({ token: t, detailer_id: user.user.id, platform: Platform.OS === 'ios' ? 'ios' : 'android' }, { onConflict: 'token' });
  if (error) return 'off';
  currentToken = t;
  return 'on';
}

/** Stops alerts on this device. Also called on sign-out. */
export async function disablePush(): Promise<void> {
  const t = currentToken ?? (await token());
  currentToken = null;
  if (t && supabase) await supabase.from('push_tokens').delete().eq('token', t);
}

/** Opens the screen a notification points at (data.url, an in-app path). */
export function listenForNotificationTaps(): () => void {
  const open = (r: Notifications.NotificationResponse | null | undefined) => {
    const url = r?.notification.request.content.data?.url;
    if (typeof url === 'string' && url.startsWith('/')) router.push(url as never);
  };
  const last = Notifications.getLastNotificationResponse();
  if (last) {
    open(last);
    Notifications.clearLastNotificationResponse();
  }
  const sub = Notifications.addNotificationResponseReceivedListener(open);
  return () => sub.remove();
}
