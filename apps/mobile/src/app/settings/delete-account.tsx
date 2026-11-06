import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { BackButton } from '@/components/nav/BackButton';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { GlassCard } from '@/components/ui/GlassCard';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { ApiError, deleteAccount } from '@/lib/data';
import { haptic } from '@/lib/haptics';
import { space } from '@/theme/tokens';

// In-app account deletion (Apple 5.1.1(v), Google Play; rules.md section 2).
export default function DeleteAccount() {
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const remove = async () => {
    setBusy(true);
    setError(null);
    try {
      await deleteAccount();
      haptic.success();
      router.replace('/sign-in');
    } catch (e) {
      haptic.error();
      const body = e instanceof ApiError ? (e.body as { error?: string; count?: number } | null) : null;
      setError(
        body?.error === 'upcoming_bookings'
          ? `You have ${body.count} upcoming paid booking${body.count === 1 ? '' : 's'}. Cancel ${body.count === 1 ? 'it' : 'them'} first so clients get their deposits back.`
          : 'Could not delete your account. Check your connection and try again.',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen title="Delete account" tabs={false} right={<BackButton variant="back" />}>
      <GlassCard>
        <View style={{ gap: space.md }}>
          <Text variant="bodyStrong">This permanently deletes:</Text>
          {[
            'Your Beadup account and sign-in',
            'Your business profile and booking link',
            'Services, prices and availability',
            'Clients, bookings, quotes and photos',
            'Messages and payment history in Beadup',
          ].map((t) => (
            <Text key={t} variant="body" tone="steel">
              ·  {t}
            </Text>
          ))}
          <Text variant="caption" style={{ marginTop: space.sm }}>
            Your Stripe account is yours and is not deleted. Stripe and the card networks keep payment records they are
            required to by law. Beadup keeps a security log entry that the account was deleted, without your details.
          </Text>
        </View>
      </GlassCard>

      <Field
        label='Type DELETE to confirm'
        value={confirm}
        onChangeText={setConfirm}
        autoCapitalize="characters"
        autoCorrect={false}
        error={error}
      />
      <Button label="Delete my account" variant="danger" onPress={remove} loading={busy} disabled={confirm.trim() !== 'DELETE'} />
      <Text variant="caption" style={{ textAlign: 'center' }}>
        This can&apos;t be undone.
      </Text>
    </Screen>
  );
}
