import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { haptic } from '@/lib/haptics';
import { TRADE_IDS, TRADES, type TradeId } from '@/lib/trades';
import { colors, space } from '@/theme/tokens';

/** Which trade the business is in. Sets the words, pricing and booking steps clients see. */
export function TradePicker({ value, onChange }: { value: TradeId; onChange: (t: TradeId) => void }) {
  return (
    <View style={{ gap: space.sm }}>
      <Text variant="caption">What do you do?</Text>
      <View style={styles.wrap} accessibilityRole="radiogroup">
        {TRADE_IDS.map((t) => {
          const on = t === value;
          return (
            <Pressable
              key={t}
              onPress={() => {
                haptic.select();
                onChange(t);
              }}
              style={[styles.chip, on && styles.chipOn]}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              accessibilityLabel={TRADES[t].name}>
              <Text variant="caption" style={{ color: on ? colors.beadInk : colors.paint, fontWeight: on ? '700' : '500' }}>
                {TRADES[t].name}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** Whether the business goes to the client (needs their address) or the client comes to the business. */
export function VisitPicker({ value, onChange }: { value: 'mobile' | 'studio'; onChange: (v: 'mobile' | 'studio') => void }) {
  const options = [
    { id: 'mobile' as const, label: 'I go to my clients' },
    { id: 'studio' as const, label: 'Clients come to me' },
  ];
  return (
    <View style={{ gap: space.sm }}>
      <Text variant="caption">Where do appointments happen?</Text>
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
        {value === 'studio' ? 'Clients won’t be asked for an address. Put your area or address in your service area.' : 'Clients give the address where you’ll do the job.'}
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
