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
import { t } from '@/lib/i18n';

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
      setError(e instanceof AuthError ? e.message : t('si_wrong'));
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
        <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <View style={styles.hero}>
              <LiquidBead size={112} />
              <Text variant="title" style={{ marginTop: space.xl, textAlign: 'center' }}>
                {sentTo ? t('si_check') : t('si_welcome')}
              </Text>
              <Text variant="body" tone="steel" style={{ marginTop: space.sm, textAlign: 'center' }}>
                {sentTo
                  ? t('si_sent', { email: sentTo })
                  : t('si_tag')}
              </Text>
            </View>

            {offline && (
              <View style={{ gap: space.md }}>
                <Text variant="caption" tone="danger" style={{ textAlign: 'center' }}>
                  {t('si_preview')}
                </Text>
                {__DEV__ && <Button label={t('si_demo')} variant="glass" onPress={enterDemo} />}
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
                      <Text variant="caption">{t('si_or')}</Text>
                      <View style={styles.rule} />
                    </View>
                  </>
                )}
                <Field
                  label={t('si_email')}
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
                      label={t('si_password')}
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
                      label={t('si_signin')}
                      onPress={() => run('password', () => signInWithPassword(email, password))}
                      loading={busy === 'password'}
                      disabled={offline || !password}
                    />
                  </>
                ) : (
                  <Button label={t('si_send_link')} onPress={() => send(email)} loading={busy === 'email'} disabled={offline} />
                )}
                <Button
                  label={usePassword ? t('si_link_instead') : t('si_use_password')}
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
                  label={t('si_code')}
                  value={code}
                  onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 10))}
                  placeholder="12345678"
                  keyboardType="number-pad"
                  textContentType="oneTimeCode"
                  autoComplete="one-time-code"
                  maxLength={10}
                  style={styles.code}
                  error={error}
                />
                <Button label={t('si_signin')} onPress={() => run('code', () => verifyEmailCode(sentTo, code))} loading={busy === 'code'} disabled={code.length < 6} />
                <Button
                  label={cooldown > 0 ? t('si_resend_in', { n: cooldown }) : t('si_resend')}
                  variant="glass"
                  onPress={() => send(sentTo)}
                  disabled={cooldown > 0 || busy !== null}
                />
                <Button
                  label={t('si_other')}
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
              {t('si_agree')}{' '}
              <Text variant="caption" tone="bead" onPress={() => openLegal('terms')} accessibilityRole="link">
                {t('si_terms')}
              </Text>{' '}
              {t('si_and')}{' '}
              <Text variant="caption" tone="bead" onPress={() => openLegal('privacy')} accessibilityRole="link">
                {t('si_privacy')}
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
