import type { Session } from '@supabase/supabase-js';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import * as Linking from 'expo-linking';
import { createContext, use, useEffect, useState, type ReactNode } from 'react';
import { z } from 'zod';

import { clearCache } from './cache';
import { disablePush } from './push';
import { resetPurchases } from './purchases';
import { supabase } from './supabase';
import { t } from './i18n';

type AuthState = {
  session: Session | null;
  /** True until the stored session (and, if signed in, the profile check) is loaded. */
  loading: boolean;
  /** No backend configured (EXPO_PUBLIC_SUPABASE_* unset): local preview only. */
  offline: boolean;
  /** Signed in and has a business profile; false means onboarding is needed. */
  hasProfile: boolean;
  refreshProfile: () => Promise<void>;
  /** Preview mode only (no backend): whether the demo is "signed in". */
  demoSignedIn: boolean;
};

const AuthContext = createContext<AuthState>({
  session: null,
  loading: true,
  offline: false,
  hasProfile: false,
  refreshProfile: async () => {},
  demoSignedIn: true,
});

// Preview mode has no session to clear, so sign-out flips this flag instead.
let setDemoSignedIn: ((v: boolean) => void) | null = null;
/** Preview mode: open the demo again from the sign-in screen. */
export function enterDemo(): void {
  setDemoSignedIn?.(true);
}

async function profileExists(): Promise<boolean> {
  if (!supabase) return true;
  const { data, error } = await supabase.from('detailers').select('id').maybeSingle();
  // Offline or a server hiccup: assume an existing user rather than sending
  // them into onboarding (which would fail anyway without a connection).
  if (error) return true;
  return !!data;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(!!supabase);
  const [hasProfile, setHasProfile] = useState(!supabase);
  const [demoSignedIn, setDemo] = useState(true);
  useEffect(() => {
    setDemoSignedIn = setDemo;
    return () => {
      setDemoSignedIn = null;
    };
  }, []);

  useEffect(() => {
    if (!supabase) return;
    const apply = async (s: Session | null) => {
      setSession(s);
      setHasProfile(s ? await profileExists() : false);
      setLoading(false);
    };
    supabase.auth.getSession().then(({ data }) => apply(data.session));
    const { data } = supabase.auth.onAuthStateChange((event, s) => {
      // Token refreshes don't change who is signed in.
      if (event === 'TOKEN_REFRESHED') return setSession(s);
      apply(s);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const value: AuthState = {
    session,
    loading,
    offline: !supabase,
    hasProfile,
    refreshProfile: async () => setHasProfile(await profileExists()),
    demoSignedIn,
  };
  return <AuthContext value={value}>{children}</AuthContext>;
}

export const useAuth = () => use(AuthContext);

export class AuthError extends Error {}

function client() {
  if (!supabase) throw new AuthError(t('ae_preview'));
  return supabase;
}

const email = z.email().max(254);

/** Where magic links send the user back (beadup://auth/callback in builds). */
export const authRedirectUrl = () => Linking.createURL('auth/callback');

export async function sendMagicLink(address: string): Promise<void> {
  const parsed = email.safeParse(address.trim().toLowerCase());
  if (!parsed.success) throw new AuthError(t('ae_email'));
  const { error } = await client().auth.signInWithOtp({
    email: parsed.data,
    options: { emailRedirectTo: authRedirectUrl(), shouldCreateUser: true },
  });
  if (error) throw new AuthError(error.status === 429 ? t('ae_429') : t('ae_send'));
}

/** The code from the same email (6 to 10 digits, set in Supabase Auth), for when the link opens elsewhere. */
export async function verifyEmailCode(address: string, code: string): Promise<void> {
  if (!/^\d{6,10}$/.test(code)) throw new AuthError(t('ae_code'));
  const { error } = await client().auth.verifyOtp({ email: address.trim().toLowerCase(), token: code, type: 'email' });
  if (error) throw new AuthError(t('ae_code_bad'));
}

/**
 * Email + password, for accounts that have a password (the App Review demo
 * account, created by the owner in the Supabase dashboard). New detailers use
 * Apple or the emailed link/code; there is no password sign-up in the app.
 */
export async function signInWithPassword(address: string, password: string): Promise<void> {
  const parsed = email.safeParse(address.trim().toLowerCase());
  if (!parsed.success) throw new AuthError('Enter a valid email address.');
  if (password.length < 8 || password.length > 128) throw new AuthError(t('ae_pw'));
  const { error } = await client().auth.signInWithPassword({ email: parsed.data, password });
  if (error) throw new AuthError(error.status === 429 ? t('ae_429b') : t('ae_pw_bad'));
}

/** Completes a magic link: exchanges the PKCE code from beadup://auth/callback?code=... */
export async function completeMagicLink(code: string): Promise<void> {
  const { error } = await client().auth.exchangeCodeForSession(code);
  if (error) throw new AuthError(t('ae_expired'));
}

/**
 * Native Sign in with Apple (iOS). A random nonce is hashed for Apple and the
 * raw value sent to Supabase, which checks they match (replay protection).
 * Returns false if the user cancelled.
 */
export async function signInWithApple(): Promise<boolean> {
  const rawNonce = Crypto.randomUUID() + Crypto.randomUUID();
  const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);
  try {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL],
      nonce: hashedNonce,
    });
    if (!credential.identityToken) throw new AuthError(t('ae_apple'));
    const { error } = await client().auth.signInWithIdToken({
      provider: 'apple',
      token: credential.identityToken,
      nonce: rawNonce,
    });
    if (error) throw new AuthError('Sign in with Apple failed. Try again or use email.');
    // Apple shares the name only on the very first sign-in: keep it for onboarding.
    const name = [credential.fullName?.givenName, credential.fullName?.familyName].filter(Boolean).join(' ');
    if (name) await client().auth.updateUser({ data: { full_name: name } });
    return true;
  } catch (e) {
    if (e instanceof AuthError) throw e;
    if ((e as { code?: string }).code === 'ERR_REQUEST_CANCELED') return false;
    throw new AuthError('Sign in with Apple failed. Try again or use email.');
  }
}

export async function signOut(): Promise<void> {
  clearCache(); // personal data must not outlive the session on this device
  await disablePush().catch(() => {}); // the next account on this phone can claim the token
  await resetPurchases().catch(() => {});
  if (!supabase) {
    setDemoSignedIn?.(false);
    return;
  }
  // Revoke the session on the server; if that fails (no signal), still sign
  // out on this phone so the button always works.
  const { error } = await supabase.auth.signOut();
  if (error) await supabase.auth.signOut({ scope: 'local' });
}
