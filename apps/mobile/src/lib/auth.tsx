import type { Session } from '@supabase/supabase-js';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import * as Linking from 'expo-linking';
import { createContext, use, useEffect, useState, type ReactNode } from 'react';
import { z } from 'zod';

import { supabase } from './supabase';

type AuthState = {
  session: Session | null;
  /** True until the stored session has been read on launch. */
  loading: boolean;
  /** No backend configured (EXPO_PUBLIC_SUPABASE_* unset): local preview only. */
  offline: boolean;
};

const AuthContext = createContext<AuthState>({ session: null, loading: true, offline: false });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ session: null, loading: !!supabase, offline: !supabase });

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setState((s) => ({ ...s, session: data.session, loading: false })));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => setState((s) => ({ ...s, session, loading: false })));
    return () => data.subscription.unsubscribe();
  }, []);

  return <AuthContext value={state}>{children}</AuthContext>;
}

export const useAuth = () => use(AuthContext);

export class AuthError extends Error {}

function client() {
  if (!supabase) throw new AuthError('Sign-in is not available in preview mode.');
  return supabase;
}

const email = z.email().max(254);

/** Where magic links send the user back (beadup://auth/callback in builds). */
export const authRedirectUrl = () => Linking.createURL('auth/callback');

export async function sendMagicLink(address: string): Promise<void> {
  const parsed = email.safeParse(address.trim().toLowerCase());
  if (!parsed.success) throw new AuthError('Enter a valid email address.');
  const { error } = await client().auth.signInWithOtp({
    email: parsed.data,
    options: { emailRedirectTo: authRedirectUrl(), shouldCreateUser: true },
  });
  if (error) throw new AuthError(error.status === 429 ? 'Too many requests. Wait a minute and try again.' : 'Could not send the email. Try again.');
}

/** The 6-digit code from the same email, for when the link opens elsewhere. */
export async function verifyEmailCode(address: string, code: string): Promise<void> {
  if (!/^\d{6}$/.test(code)) throw new AuthError('Enter the 6-digit code from the email.');
  const { error } = await client().auth.verifyOtp({ email: address.trim().toLowerCase(), token: code, type: 'email' });
  if (error) throw new AuthError('That code is wrong or expired. Request a new email.');
}

/** Completes a magic link: exchanges the PKCE code from beadup://auth/callback?code=... */
export async function completeMagicLink(code: string): Promise<void> {
  const { error } = await client().auth.exchangeCodeForSession(code);
  if (error) throw new AuthError('This sign-in link has expired or was already used. Request a new one.');
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
    if (!credential.identityToken) throw new AuthError('Apple did not return a sign-in token. Try again.');
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
  await supabase?.auth.signOut();
}
