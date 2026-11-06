import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';

import { secureStorage } from './secure-storage';

/**
 * Supabase client for the detailer app. Only the public URL and anon key ship
 * in the bundle (row level security protects the data); every secret lives on
 * the server (rules.md section 7). Null when the env vars are not set.
 */
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const supabase: SupabaseClient | null =
  url && anonKey
    ? createClient(url, anonKey, {
        auth: {
          storage: secureStorage,
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: false,
          flowType: 'pkce', // magic links return a one-time code, exchanged in the app
        },
      })
    : null;

/** Base URL of the web app and its API (beadup.app in production). */
export const apiBaseUrl = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

// Refresh tokens only while the app is in the foreground (Supabase's
// recommendation for React Native: timers don't run reliably in background).
if (supabase) {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}
