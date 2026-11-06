import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { LiquidBead } from '@/components/bead/LiquidBead';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { AuthError, completeMagicLink } from '@/lib/auth';
import { haptic } from '@/lib/haptics';
import { colors, space } from '@/theme/tokens';

/**
 * Magic link landing: beadup://auth/callback?code=... (PKCE). Exchanges the
 * one-time code for a session; the root layout then routes into the app.
 */
export default function AuthCallback() {
  const { code, error_description } = useLocalSearchParams<{ code?: string; error_description?: string }>();
  const [error, setError] = useState<string | null>(
    error_description ? 'This sign-in link has expired or was already used.' : !code ? 'This sign-in link is incomplete.' : null,
  );

  useEffect(() => {
    if (!code || error_description) return;
    completeMagicLink(code)
      .then(() => {
        haptic.success();
        router.replace('/');
      })
      .catch((e) => setError(e instanceof AuthError ? e.message : 'Could not sign you in.'));
  }, [code, error_description]);

  return (
    <View style={styles.root}>
      <LiquidBead size={96} interactive={false} />
      <Text variant="heading" style={{ marginTop: space.xl, textAlign: 'center' }}>
        {error ? 'Link not valid' : 'Signing you in…'}
      </Text>
      {error && (
        <>
          <Text variant="body" tone="steel" style={{ marginTop: space.sm, textAlign: 'center' }}>
            {error}
          </Text>
          <View style={{ marginTop: space.xl, alignSelf: 'stretch' }}>
            <Button label="Back to sign in" onPress={() => router.replace('/sign-in')} />
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.midnight, alignItems: 'center', justifyContent: 'center', padding: space.xl },
});
