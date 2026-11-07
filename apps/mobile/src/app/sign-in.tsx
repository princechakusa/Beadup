import * as AppleAuthentication from 'expo-apple-authentication';
import { LinearGradient } from 'expo-linear-gradient';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LiquidBead } from '@/components/bead/LiquidBead';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Text } from '@/components/ui/Text';
import { AuthError, enterDemo, sendMagicLink, signInWithApple, signInWithPassword, useAuth, verifyEmailCode } from '@/lib/auth';
import { haptic } from '@/lib/haptics';
import { apiBaseUrl } from '@/lib/supabase';
import { colors, radius, space } from '@/theme/tokens';

const RESEND_SECONDS = 30;

export default function SignIn() {
  const { offline } = useAuth();
  const [appleAvailable, setAppleAvailable] = useState(false);
  const [email, setEmail] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState<'email' | 'code' | 'apple' | 'password' | null>(null);
  const [usePassword, setUsePassword] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (Platform.OS === 'ios') AppleAuthentication.isAvailableAsync().then(setAppleAvailable).catch(() => {});
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function run(kind: 'email' | 'code' | 'apple' | 'password', fn: () => Promise<void>) {
    setBusy(kind);
    setError(null);
    try {
      await fn();
    } catch (e) {
      haptic.error();
      setError(e instanceof AuthError ? e.message : 'Something went wrong. Try again.');
    } finally {
      setBusy(null);
    }
  }

  const send = (address: string) =>
    run('email', async () => {
      await sendMagicLink(address);
      haptic.success();
      setSentTo(address.trim().toLowerCase());
      setCooldown(RESEND_SECONDS);
    });

  const openLegal = (path: 'terms' | 'privacy') => WebBrowser.openBrowserAsync(`${apiBaseUrl}/${path}`).catch(() => {});

  return (
    <View style={styles.root}>
      <LinearGradient colors={['rgba(77,216,255,0.18)', 'rgba(10,12,16,0)']} style={styles.aurora} />
      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <View style={styles.hero}>
              <LiquidBead size={112} />
              <Text variant="title" style={{ marginTop: space.xl, textAlign: 'center' }}>
                {sentTo ? 'Check your email' : 'Welcome to Beadup'}
              </Text>
              <Text variant="body" tone="steel" style={{ marginTop: space.sm, textAlign: 'center' }}>
                {sentTo
                  ? `We sent a sign-in link to ${sentTo}. Tap it on this phone, or enter the 6-digit code.`
                  : 'Quotes, bookings and payments for your detailing business.'}
              </Text>
            </View>

            {offline && (
              <View style={{ gap: space.md }}>
                <Text variant="caption" tone="danger" style={{ textAlign: 'center' }}>
                  Preview build: sign-in isn&apos;t connected. Restart Expo with the project&apos;s .env.local to use real accounts.
                </Text>
                {__DEV__ && <Button label="Open the demo" variant="glass" onPress={enterDemo} />}
              </View>
            )}

            {!sentTo ? (
              <View style={{ gap: space.lg }}>
                {appleAvailable && (
                  <>
                    <AppleAuthentication.AppleAuthenticationButton
                      buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
                      buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
                      cornerRadius={radius.pill}
                      style={styles.apple}
                      onPress={() => run('apple', async () => void (await signInWithApple()))}
                    />
                    <View style={styles.divider}>
                      <View style={styles.rule} />
                      <Text variant="caption">or</Text>
                      <View style={styles.rule} />
                    </View>
                  </>
                )}
                <Field
                  label="Email"
                  value={email}
                  onChangeText={setEmail}
                  placeholder="you@yourbusiness.com"
                  autoCapitalize="none"
                  autoComplete="email"
                  keyboardType="email-address"
                  textContentType="emailAddress"
                  returnKeyType={usePassword ? 'next' : 'send'}
                  onSubmitEditing={() => !usePassword && send(email)}
                  error={usePassword ? null : error}
                />
                {usePassword ? (
                  <>
                    <Field
                      label="Password"
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry
                      autoCapitalize="none"
                      autoComplete="current-password"
                      textContentType="password"
                      returnKeyType="go"
                      onSubmitEditing={() => run('password', () => signInWithPassword(email, password))}
                      error={error}
                    />
                    <Button
                      label="Sign in"
                      onPress={() => run('password', () => signInWithPassword(email, password))}
                      loading={busy === 'password'}
                      disabled={offline || !password}
                    />
                  </>
                ) : (
                  <Button label="Email me a sign-in link" onPress={() => send(email)} loading={busy === 'email'} disabled={offline} />
                )}
                <Button
                  label={usePassword ? 'Email me a link instead' : 'Sign in with a password'}
                  variant="ghost"
                  onPress={() => {
                    setUsePassword((v) => !v);
                    setPassword('');
                    setError(null);
                  }}
                />
              </View>
            ) : (
              <View style={{ gap: space.lg }}>
                <Field
                  label="6-digit code"
                  value={code}
                  onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 6))}
                  placeholder="123456"
                  keyboardType="number-pad"
                  textContentType="oneTimeCode"
                  autoComplete="one-time-code"
                  maxLength={6}
                  style={styles.code}
                  error={error}
                />
                <Button label="Sign in" onPress={() => run('code', () => verifyEmailCode(sentTo, code))} loading={busy === 'code'} disabled={code.length !== 6} />
                <Button
                  label={cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend email'}
                  variant="glass"
                  onPress={() => send(sentTo)}
                  disabled={cooldown > 0 || busy !== null}
                />
                <Button
                  label="Use a different email"
                  variant="ghost"
                  onPress={() => {
                    setSentTo(null);
                    setCode('');
                    setError(null);
                  }}
                />
              </View>
            )}

            <Text variant="caption" style={styles.legal}>
              By continuing you agree to the{' '}
              <Text variant="caption" tone="bead" onPress={() => openLegal('terms')} accessibilityRole="link">
                Terms
              </Text>{' '}
              and{' '}
              <Text variant="caption" tone="bead" onPress={() => openLegal('privacy')} accessibilityRole="link">
                Privacy Policy
              </Text>
              .
            </Text>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.midnight },
  aurora: { position: 'absolute', top: 0, left: 0, right: 0, height: 460 },
  content: { flexGrow: 1, justifyContent: 'center', padding: space.xl, gap: space.xl },
  hero: { alignItems: 'center', marginBottom: space.sm },
  apple: { width: '100%', height: 52 },
  divider: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  rule: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.lineStrong },
  code: { fontSize: 24, letterSpacing: 8, textAlign: 'center' },
  legal: { textAlign: 'center', marginTop: space.sm },
});
