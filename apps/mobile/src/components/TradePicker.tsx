import { Pressable, StyleSheet, View } from 'react-native';

import { Dropdown } from '@/components/ui/Dropdown';
import { Text } from '@/components/ui/Text';
import { haptic } from '@/lib/haptics';
import { TRADE_IDS, TRADES, type TradeId } from '@/lib/trades';
import { colors, space } from '@/theme/tokens';
import { phrase } from '@/lib/i18n/phrases';
import { t as tr } from '@/lib/i18n';

/** Which trade the business is in. Sets the words, pricing and booking steps clients see. */
export function TradePicker({ value, onChange }: { value: TradeId; onChange: (t: TradeId) => void }) {
  const options = TRADE_IDS.map((t) => ({
    value: t,
    label: phrase(TRADES[t].name),
    hint: TRADES[t].pricing === 'tiers' ? tr('tp_prices_by', { what: phrase(TRADES[t].tierTitle).toLowerCase().replace(/^(your|tu|votre|seu|sua) /, '') }) : tr('tp_one_price'),
  }));
  return <Dropdown label={tr('tp_label')} title={tr('tp_title')} value={value} options={options} onChange={onChange} searchable />;
}

/** Whether the business goes to the client (needs their address) or the client comes to the business. */
export function VisitPicker({ value, onChange }: { value: 'mobile' | 'studio'; onChange: (v: 'mobile' | 'studio') => void }) {
  const options = [
    { id: 'mobile' as const, label: tr('vp_mobile') },
    { id: 'studio' as const, label: tr('vp_studio') },
  ];
  return (
    <View style={{ gap: space.sm }}>
      <Text variant="caption">{tr('vp_label')}</Text>
      <View style={styles.row} accessibilityRole="radiogroup">
        {options.map((o) => {
          const on = o.id === value;
          return (
            <Pressable
              key={o.id}
              onPress={() => {
                haptic.select();
                onChange(o.id);
              }}
              style={[styles.half, on && styles.chipOn]}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}>
              <Text variant="caption" style={{ color: on ? colors.beadInk : colors.paint, fontWeight: on ? '700' : '500', textAlign: 'center' }}>
                {o.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Text variant="caption" style={{ fontSize: 12 }}>
        {value === 'studio' ? tr('vp_studio_d') : tr('vp_mobile_d')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { height: 36, paddingHorizontal: 13, borderRadius: 18, justifyContent: 'center', backgroundColor: colors.gunmetal, borderWidth: 1, borderColor: '#262B35' },
  chipOn: { backgroundColor: colors.bead, borderColor: colors.bead },
  row: { flexDirection: 'row', gap: 8 },
  half: { flex: 1, minHeight: 44, paddingHorizontal: 10, borderRadius: 16, justifyContent: 'center', backgroundColor: colors.gunmetal, borderWidth: 1, borderColor: '#262B35' },
});
