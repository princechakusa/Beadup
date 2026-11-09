import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Share, StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';

import { BackButton } from '@/components/nav/BackButton';
import { AiScan } from '@/components/quote/AiScan';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Icon } from '@/components/ui/Icon';
import { ListCard, Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { fetchCatalog, fetchProfile, saveQuote, useQuery, type QuoteItem } from '@/lib/data';
import { currencySymbol, money } from '@/lib/format';
import { haptic } from '@/lib/haptics';
import { apiBaseUrl } from '@/lib/supabase';
import { colors, fonts, radius } from '@/theme/tokens';

type Size = 'sedan' | 'suv' | 'truck';
const SIZES: { id: Size; label: string }[] = [
  { id: 'sedan', label: 'Sedan' },
  { id: 'suv', label: 'SUV' },
  { id: 'truck', label: 'Truck' },
];
const depositOf = (cents: number) => Math.floor((cents * 3 + 5) / 10); // same rule as the server

/**
 * Quote builder from the detailer's own price list, optionally prefilled by
 * an AI photo scan. Prices always come from the price list, and the
 * detailer approves every number before anything is sent.
 */
export default function NewQuote() {
  const catalog = useQuery(fetchCatalog);
  const profile = useQuery(fetchProfile);
  const [size, setSize] = useState<Size>('suv');
  const [vehicle, setVehicle] = useState('');
  const [serviceId, setServiceId] = useState<string | null>(null);
  const [addOnIds, setAddOnIds] = useState<string[]>([]);
  const [extras, setExtras] = useState<QuoteItem[]>([]);
  const [extraLabel, setExtraLabel] = useState('');
  const [extraPrice, setExtraPrice] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quoteId, setQuoteId] = useState<string | null>(null);

  const services = (catalog.data?.services ?? []).filter((s) => s.active);
  const addOns = (catalog.data?.addOns ?? []).filter((a) => a.active);
  const service = services.find((s) => s.id === serviceId) ?? services[0];

  const items: QuoteItem[] = [
    ...(service ? [{ label: `${service.name}, ${SIZES.find((s) => s.id === size)!.label.toLowerCase()}`, cents: service.priceCents[size] }] : []),
    ...addOns.filter((a) => addOnIds.includes(a.id)).map((a) => ({ label: a.name, cents: a.priceCents })),
    ...extras,
  ];
  const total = items.reduce((n, i) => n + i.cents, 0);

  const addExtra = () => {
    const cents = Math.round(Number(extraPrice.replace(/[^0-9.]/g, '')) * 100);
    if (!extraLabel.trim() || !Number.isFinite(cents) || cents <= 0) return;
    haptic.select();
    setExtras((xs) => [...xs, { label: extraLabel.trim().slice(0, 60), cents: Math.min(cents, 1_000_000) }]);
    setExtraLabel('');
    setExtraPrice('');
  };

  const send = async () => {
    if (!items.length) return;
    setBusy(true);
    setError(null);
    try {
      await saveQuote({ quoteId, vehicleSize: size, vehicleDesc: vehicle.trim(), items, notes: '', status: 'sent' });
      haptic.success();
      const lines = items.map((i) => `${i.label}: ${money(i.cents)}`).join('\n');
      const link = profile.data ? `\n\nBook here: ${apiBaseUrl}/${profile.data.handle}` : '';
      await Share.share({
        message: `Quote from ${profile.data?.businessName ?? 'your detailer'}${vehicle ? ` for your ${vehicle.trim()}` : ''}\n\n${lines}\nTotal: ${money(total)} (30% deposit ${money(depositOf(total))})${link}`,
      });
      router.back();
    } catch {
      haptic.error();
      setError('Could not save the quote. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen title="New quote" tabs={false} right={<BackButton />}>
      <AiScan
        onSuggestion={(s) => {
          setQuoteId(s.quoteId);
          setSize(s.vehicleSize);
          if (s.vehicleDescription && !vehicle) setVehicle(s.vehicleDescription.slice(0, 120));
          if (s.serviceId) setServiceId(s.serviceId);
          setAddOnIds(s.addOnIds);
        }}
      />
      <View style={styles.segment}>
        {SIZES.map((s) => {
          const on = s.id === size;
          return (
            <Pressable
              key={s.id}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              onPress={() => {
                haptic.select();
                setSize(s.id);
              }}
              style={[styles.segBtn, on && styles.segOn]}>
              <Text variant="bodyStrong" style={{ color: on ? colors.beadInk : colors.steel, fontSize: 15 }}>
                {s.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Field label="Vehicle (optional)" value={vehicle} onChangeText={setVehicle} placeholder="e.g. Tesla Model Y" maxLength={120} />

      <Text variant="eyebrow">Service</Text>
      <View style={{ gap: 8 }}>
        {services.map((s) => {
          const on = s.id === service?.id;
          return (
            <Pressable
              key={s.id}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              onPress={() => {
                haptic.select();
                setServiceId(s.id);
              }}
              style={[styles.option, on && styles.optionOn]}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="bodyStrong">{s.name}</Text>
                <Text variant="caption">{s.description}</Text>
              </View>
              <Text variant="bodyStrong" tone="gold" style={{ fontFamily: fonts.display }}>
                {money(s.priceCents[size])}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {addOns.length > 0 && (
        <>
          <Text variant="eyebrow">Add-ons</Text>
          <View style={styles.chips}>
            {addOns.map((a) => {
              const on = addOnIds.includes(a.id);
              return (
                <Pressable
                  key={a.id}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                  onPress={() => {
                    haptic.select();
                    setAddOnIds((xs) => (on ? xs.filter((x) => x !== a.id) : [...xs, a.id]));
                  }}
                  style={[styles.chip, on && styles.chipOn]}>
                  <Text variant="caption" style={{ color: on ? colors.beadInk : colors.paint, fontFamily: fonts.bodySemi }}>
                    {a.name.split(' (')[0]} · {money(a.priceCents)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </>
      )}

      <Text variant="eyebrow">Custom line</Text>
      <View style={styles.extraRow}>
        <TextInput
          value={extraLabel}
          onChangeText={setExtraLabel}
          placeholder="e.g. One-step polish, hood"
          placeholderTextColor="rgba(154,163,178,0.6)"
          accessibilityLabel="Custom line description"
          style={[styles.input, { flex: 1 }]}
        />
        <TextInput
          value={extraPrice}
          onChangeText={setExtraPrice}
          placeholder={currencySymbol()}
          keyboardType="decimal-pad"
          placeholderTextColor="rgba(154,163,178,0.6)"
          accessibilityLabel="Custom line price"
          style={[styles.input, { width: 90 }]}
        />
        <Pressable accessibilityRole="button" accessibilityLabel="Add line" onPress={addExtra} style={styles.addBtn}>
          <Icon name="plus" size={20} color={colors.beadInk} strokeWidth={2.4} />
        </Pressable>
      </View>

      <ListCard>
        {items.map((i, idx) => (
          <Animated.View key={`${i.label}-${idx}`} entering={FadeIn} exiting={FadeOut} layout={LinearTransition} style={styles.line}>
            <Text variant="body" style={{ flex: 1 }}>
              {i.label}
            </Text>
            <Text variant="bodyStrong">{money(i.cents)}</Text>
          </Animated.View>
        ))}
        <View style={styles.totalRow}>
          <View style={{ flex: 1 }}>
            <Text variant="bodyStrong">Total</Text>
            <Text variant="caption">30% deposit {money(depositOf(total))}</Text>
          </View>
          <Text variant="money" style={{ fontSize: 28 }}>
            {money(total)}
          </Text>
        </View>
      </ListCard>

      {error && (
        <Text variant="caption" tone="danger">
          {error}
        </Text>
      )}
      <Button label="Send quote" onPress={send} loading={busy} disabled={!items.length} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  segment: { flexDirection: 'row', padding: 4, borderRadius: radius.pill, backgroundColor: colors.gunmetal, borderWidth: 1, borderColor: colors.line },
  segBtn: { flex: 1, height: 44, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  segOn: { backgroundColor: colors.bead },
  option: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: 20, backgroundColor: '#11151B', borderWidth: 1, borderColor: colors.line },
  optionOn: { borderColor: 'rgba(77,216,255,0.6)', backgroundColor: '#0F1A20' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, height: 38, borderRadius: 19, justifyContent: 'center', backgroundColor: colors.gunmetal, borderWidth: 1, borderColor: '#262B35' },
  chipOn: { backgroundColor: colors.bead, borderColor: colors.bead },
  extraRow: { flexDirection: 'row', gap: 8 },
  input: { height: 52, borderRadius: radius.md, paddingHorizontal: 14, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: colors.line, color: colors.paint, fontFamily: fonts.body, fontSize: 15 },
  addBtn: { width: 52, height: 52, borderRadius: radius.md, backgroundColor: colors.bead, alignItems: 'center', justifyContent: 'center' },
  line: { flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  totalRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
});
