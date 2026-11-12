import Constants from 'expo-constants';

import { apiBaseUrl } from './supabase';

/** Sends an app crash to the website's /api/log (shown in /admin). Best effort; no personal details. */
export function reportError(error: Error, where: string) {
  if (!apiBaseUrl || __DEV__) return;
  fetch(`${apiBaseUrl}/api/log`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      source: 'app',
      message: String(error?.message ?? error).slice(0, 2000),
      where: where.slice(0, 300),
      stack: String(error?.stack ?? '').slice(0, 8000),
      release: Constants.expoConfig?.version ?? '',
    }),
  }).catch(() => {});
}
