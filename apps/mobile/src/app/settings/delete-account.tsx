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
import { t } from '@/lib/i18n';

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
          ? t(body.count === 1 ? 'da_upcoming' : 'da_upcoming_many', { n: body.count ?? 0 })
          : t('da_fail'),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen title={t('da_title')} tabs={false} right={<BackButton variant="back" />}>
      <GlassCard>
        <View style={{ gap: space.md }}>
          <Text variant="bodyStrong">{t('da_deletes')}</Text>
          {[
            t('da_l1'),
            t('da_l2'),
            t('da_l3'),
            t('da_l4'),
            t('da_l5'),
          ].map((line) => (
            <Text key={line} variant="body" tone="steel">
              ·  {line}
            </Text>
          ))}
          <Text variant="caption" style={{ marginTop: space.sm }}>
            {t('da_note')}
          </Text>
        </View>
      </GlassCard>

      <Field
        label={t('da_type')}
        value={confirm}
        onChangeText={setConfirm}
        autoCapitalize="characters"
        autoCorrect={false}
        error={error}
      />
      <Button label={t('da_btn')} variant="danger" onPress={remove} loading={busy} disabled={confirm.trim() !== 'DELETE'} />
      <Text variant="caption" style={{ textAlign: 'center' }}>
        {t('da_undo')}
      </Text>
    </Screen>
  );
}
