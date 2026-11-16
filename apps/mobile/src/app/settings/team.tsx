import { useState } from 'react';
import { Pressable, StyleSheet, Switch, View } from 'react-native';

import { BackButton } from '@/components/nav/BackButton';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Icon } from '@/components/ui/Icon';
import { ListCard, Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { addStaff, fetchStaff, removeStaff, setStaffActive, useQuery } from '@/lib/data';
import { haptic } from '@/lib/haptics';
import { colors, space } from '@/theme/tokens';
import { t } from '@/lib/i18n';

/**
 * Settings: the team. Each person gets their own calendar, so two clients can
 * book the same time with different people. Clients choose a person or
 * "anyone". With no team, Beadup works as a one-person business.
 */
export default function Team() {
  const staff = useQuery(fetchStaff, [], 'staff');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<void>) => {
    setError(null);
    try {
      await fn();
      haptic.success();
      await staff.refresh();
    } catch {
      haptic.error();
      setError(t('tm_fail'));
    }
  };

  return (
    <Screen title={t('tm_title')} tabs={false} right={<BackButton variant="back" />}>
      <Text variant="caption" style={{ fontSize: 14, lineHeight: 20 }}>
        {t('tm_intro')}
      </Text>
      {(staff.data ?? []).length > 0 && (
        <ListCard>
          {(staff.data ?? []).map((m) => (
            <View key={m.id} style={styles.row}>
              <Text variant="bodyStrong" style={{ flex: 1, color: m.active ? colors.paint : colors.steel }}>
                {m.name}
              </Text>
              <Switch
                value={m.active}
                onValueChange={(v) => run(() => setStaffActive(m.id, v))}
                trackColor={{ true: colors.bead, false: '#262B35' }}
                accessibilityLabel={t('tm_takes', { name: m.name })}
              />
              <Pressable onPress={() => run(() => removeStaff(m.id))} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('tm_remove', { name: m.name })}>
                <Icon name="trash" size={18} color={colors.danger} />
              </Pressable>
            </View>
          ))}
        </ListCard>
      )}
      <View style={{ gap: space.md }}>
        <Field label={t('tm_add_person')} value={name} onChangeText={setName} placeholder={t('tm_ph')} maxLength={40} autoCapitalize="words" />
        <Button
          label={t('tm_add')}
          loading={busy}
          disabled={!name.trim()}
          onPress={async () => {
            setBusy(true);
            await run(() => addStaff(name.trim(), (staff.data ?? []).length + 1));
            setName('');
            setBusy(false);
          }}
        />
      </View>
      {error && (
        <Text variant="caption" tone="danger">
          {error}
        </Text>
      )}
      <Text variant="caption" style={{ fontSize: 12 }}>
        {t('tm_note')}
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
});
