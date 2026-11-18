import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { Dropdown } from '@/components/ui/Dropdown';
import { Text } from '@/components/ui/Text';
import { DEPOSIT_PERCENTS, fetchDepositPercent, saveDepositPercent } from '@/lib/data';
import { haptic } from '@/lib/haptics';
import { t } from '@/lib/i18n';
import { space } from '@/theme/tokens';

/** Settings: what share of the price a client pays to hold their time (10 to 50%). */
export function DepositPercent() {
  const [value, setValue] = useState<number | null>(null);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    fetchDepositPercent().then(setValue).catch(() => setValue(30));
  }, []);

  if (value === null) return null;

  const change = async (v: string) => {
    const previous = value;
    const next = Number(v);
    setValue(next);
    try {
      await saveDepositPercent(next);
      haptic.success();
      setNote(t('dep_saved'));
    } catch {
      haptic.error();
      setValue(previous);
      setNote(t('dep_fail'));
    }
  };

  return (
    <View style={{ gap: space.sm }}>
      <Dropdown
        label={t('dep_title')}
        value={String(value)}
        options={DEPOSIT_PERCENTS.map((p) => ({ value: String(p), label: `${p}%` }))}
        onChange={change}
      />
      <Text variant="caption" style={{ fontSize: 13, lineHeight: 19 }}>
        {note ?? t('dep_sub')}
      </Text>
    </View>
  );
}
