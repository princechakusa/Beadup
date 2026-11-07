import { isRunningInExpoGo } from 'expo';
import Constants from 'expo-constants';
import type * as NotificationsModule from 'expo-notifications';
import { router } from 'expo-router';
import { Platform } from 'react-native';

import { supabase } from './supabase';

// Booking alerts (optional; the app works fully without them, Apple 4.5.4).
// Permission is only ever requested from the Settings toggle, never at launch.

// Expo Go has no remote push (removed on Android in SDK 53) and loading the
// module there reports an error, so it is only loaded in real builds. In Expo
// Go alerts show as "unavailable" and everything else works.
const Notifications: typeof NotificationsModule | null = isRunningInExpoGo()
  ? null
  : // eslint-disable-next-line @typescript-eslint/no-require-imports
    (require('expo-notifications') as typeof NotificationsModule);

Notifications?.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

const projectId: string | undefined = Notifications
  ? (Constants.easConfig?.projectId ??
    (Constants.expoConfig?.extra?.eas as { projectId?: string } | undefined)?.projectId)
  : undefined;

export type PushState = 'on' | 'off' | 'denied' | 'unavailable';

let currentToken: string | null = null;

async function ensureChannel() {
  if (Platform.OS !== 'android' || !Notifications) return;
  // Android 13+ only shows the permission prompt once a channel exists.
  await Notifications.setNotificationChannelAsync('bookings', {
    name: 'Bookings and payments',
    importance: Notifications.AndroidImportance.HIGH,
  });
}

async function token(): Promise<string | null> {
  if (!projectId || !Notifications) return null; // needs an EAS project (set up before the first store build)
  try {
    return (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  } catch {
    return null; // offline or no Play Services: alerts stay off, nothing else breaks
  }
}

export async function pushState(): Promise<PushState> {
  if (!supabase || !projectId || !Notifications) return 'unavailable';
  const perm = await Notifications.getPermissionsAsync();
  if (!perm.granted) return perm.canAskAgain ? 'off' : 'denied';
  const t = await token();
  if (!t) return 'off';
  const { data } = await supabase.from('push_tokens').select('token').eq('token', t).maybeSingle();
  return data ? 'on' : 'off';
}

/** Asks for permission (from the Settings toggle) and registers this device. */
export async function enablePush(): Promise<PushState> {
  if (!supabase || !projectId || !Notifications) return 'unavailable';
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
  if (!Notifications) return () => {};
  const N = Notifications;
  const open = (r: NotificationsModule.NotificationResponse | null | undefined) => {
    const url = r?.notification.request.content.data?.url;
    if (typeof url === 'string' && url.startsWith('/')) router.push(url as never);
  };
  const last = N.getLastNotificationResponse();
  if (last) {
    open(last);
    N.clearLastNotificationResponse();
  }
  const sub = N.addNotificationResponseReceivedListener(open);
  return () => sub.remove();
}
