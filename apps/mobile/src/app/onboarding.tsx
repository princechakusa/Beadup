import { LinearGradient } from 'expo-linear-gradient';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Switch, TextInput, View } from 'react-native';
import Animated, { FadeInRight, FadeOutLeft, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LiquidBead } from '@/components/bead/LiquidBead';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Text } from '@/components/ui/Text';
import { signOut, useAuth } from '@/lib/auth';
import { Icon } from '@/components/ui/Icon';
import { PaymentDetailsForm } from '@/components/payments/PaymentDetailsForm';
import { startPayoutsSetup, usePaymentsMode } from '@/lib/data';
import { haptic } from '@/lib/haptics';
import { apiBaseUrl, supabase } from '@/lib/supabase';
import { colors, fonts, radius, space, springs } from '@/theme/tokens';

type Svc = { name: string; description: string; durationMin: number; sedan: string; suv: string; truck: string; on: boolean };
const TEMPLATES: Svc[] = [
  { name: 'Express wash', description: 'Hand wash, wheels, tires, glass', durationMin: 60, sedan: '60', suv: '70', truck: '80', on: true },
  { name: 'Full detail', description: 'Inside and out, hand wax, interior deep clean', durationMin: 180, sedan: '180', suv: '210', truck: '230', on: true },
  { name: 'Interior refresh', description: 'Vacuum, wipe-down, glass, mats', durationMin: 120, sedan: '120', suv: '140', truck: '150', on: false },
];
const ADD_ONS = [
  { name: 'Pet hair removal (seats and carpets)', price: '40', on: true },
  { name: 'Odor treatment', price: '35', on: false },
  { name: 'Engine bay clean', price: '30', on: false },
];
const DAYS = [
  { wd: 1, label: 'Mon' },
  { wd: 2, label: 'Tue' },
  { wd: 3, label: 'Wed' },
  { wd: 4, label: 'Thu' },
  { wd: 5, label: 'Fri' },
  { wd: 6, label: 'Sat' },
  { wd: 0, label: 'Sun' },
];
const TIMES = ['07:00', '08:00', '09:30', '10:30', '12:00', '13:00', '14:30', '15:30', '17:00'];
const to12h = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
};
const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
const cents = (v: string) => Math.round(Number(v.replace(/[^0-9.]/g, '')) * 100);
const STEPS = ['Business', 'Services', 'Hours', 'Get paid'];

export default function Onboarding() {
  const insets = useSafeAreaInsets();
  const { refreshProfile } = useAuth();
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [handle, setHandle] = useState('');
  const [handleEdited, setHandleEdited] = useState(false);
  const [area, setArea] = useState('');
  const [handleOk, setHandleOk] = useState<boolean | null>(null);
  const [services, setServices] = useState(TEMPLATES);
  const [addOns, setAddOns] = useState(ADD_ONS);
  const [days, setDays] = useState([1, 2, 3, 4, 5, 6]);
  const [times, setTimes] = useState(['08:00', '10:30', '13:00', '15:30']);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const effectiveHandle = handleEdited ? handle : slug(name);
  const paymentsMode = usePaymentsMode();

  // Live handle check (debounced).
  useEffect(() => {
    if (!supabase || effectiveHandle.length < 2) return;
    let alive = true;
    const t = setTimeout(async () => {
      const { data } = await supabase!.rpc('handle_available', { p_handle: effectiveHandle });
      if (alive) setHandleOk(data === true);
    }, 350);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [effectiveHandle]);
  const handleValid = effectiveHandle.length >= 2 && handleOk !== false;

  const progress = useAnimatedStyle(() => ({ width: withSpring(`${((step + 1) / STEPS.length) * 100}%`, springs.settle) }));
  const go = (n: number) => {
    haptic.select();
    setError(null);
    setStep(n);
  };

  const create = async () => {
    if (!supabase) return;
    setBusy(true);
    setError(null);
    const chosen = services.filter((s) => s.on);
    const { data, error: e } = await supabase.rpc('create_detailer_profile', {
      p_handle: effectiveHandle,
      p_business_name: name.trim(),
      p_service_area: area.trim(),
      p_timezone: timezone,
      p_services: chosen.map((s) => ({
        name: s.name,
        description: s.description,
        durationMin: s.durationMin,
        priceCents: { sedan: cents(s.sedan), suv: cents(s.suv), truck: cents(s.truck) },
      })),
      p_add_ons: addOns.filter((a) => a.on).map((a) => ({ name: a.name, priceCents: cents(a.price) })),
      p_slots: days.flatMap((wd) => times.map((time) => ({ weekday: wd, time }))),
    });
    setBusy(false);
    const res = data as { ok: boolean; error?: string } | null;
    if (e || !res?.ok) {
      haptic.error();
      if (res?.error === 'exists') return go(3); // already set up on another device
      if (res?.error === 'handle_taken') {
        setError('That booking link was just taken. Pick another.');
        return setStep(0);
      }
      return setError('Something in your setup didn’t check out. Check the prices and try again.');
    }
    haptic.success();
    go(3);
  };

  const connectStripe = async () => {
    setBusy(true);
    try {
      await WebBrowser.openBrowserAsync(await startPayoutsSetup());
      await refreshProfile();
    } catch {
      haptic.error();
      setError('Could not open Stripe. You can finish this later in Settings.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.root}>
      <LinearGradient colors={['rgba(77,216,255,0.14)', 'rgba(10,12,16,0)']} style={styles.aurora} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingTop: insets.top + space.lg, paddingBottom: insets.bottom + space.xl, paddingHorizontal: 20, gap: space.lg }}>
          <View style={styles.top}>
            {(step === 1 || step === 2) && (
              <Pressable
                onPress={() => go(step - 1)}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Back"
                style={styles.backBtn}>
                <Icon name="chevronLeft" size={20} color={colors.paint} />
              </Pressable>
            )}
            <Text variant="eyebrow" tone="bead" style={{ flex: 1 }}>
              Step {step + 1} of {STEPS.length} · {STEPS[step]}
            </Text>
            {step === 0 && (
              <Pressable onPress={() => signOut()} hitSlop={8}>
                <Text variant="caption">Sign out</Text>
              </Pressable>
            )}
          </View>
          <View style={styles.track}>
            <Animated.View style={[styles.fill, progress]} />
          </View>

          <Animated.View key={step} entering={FadeInRight.springify().damping(20)} exiting={FadeOutLeft.duration(150)} style={{ gap: space.lg }}>
            {step === 0 && (
              <>
                <Text variant="title">Set up your business</Text>
                <Field label="Business name" value={name} onChangeText={setName} placeholder="e.g. Marcus Shine Co." maxLength={80} autoCapitalize="words" />
                <View style={{ gap: 6 }}>
                  <Field
                    label="Your booking link"
                    value={effectiveHandle}
                    onChangeText={(v) => {
                      setHandleEdited(true);
                      setHandle(slug(v));
                    }}
                    autoCapitalize="none"
                    autoCorrect={false}
                    maxLength={40}
                    error={handleOk === false ? 'That link is taken. Try another.' : error}
                  />
                  <Text variant="caption" tone={handleOk ? 'bead' : 'steel'}>
                    {apiBaseUrl.replace(/^https?:\/\//, '')}/{effectiveHandle || 'your-name'}
                    {handleOk ? '  ·  available' : ''}
                  </Text>
                </View>
                <Field label="Service area" value={area} onChangeText={setArea} placeholder="e.g. Austin, TX · 25 mi" maxLength={80} />
                <Text variant="caption">Times are in your timezone: {timezone.replace(/_/g, ' ')}</Text>
                <Button label="Continue" onPress={() => go(1)} disabled={!name.trim() || !handleValid} />
              </>
            )}

            {step === 1 && (
              <>
                <Text variant="title">Services and prices</Text>
                <Text variant="body" tone="steel">
                  Start from these and change anything. Clients see the price for their vehicle size.
                </Text>
                {services.map((s, i) => (
                  <View key={s.name} style={[styles.card, s.on && styles.cardOn]}>
                    <View style={styles.cardHead}>
                      <View style={{ flex: 1 }}>
                        <Text variant="bodyStrong">{s.name}</Text>
                        <Text variant="caption">{s.description}</Text>
                      </View>
                      <Switch
                        value={s.on}
                        onValueChange={(on) => setServices((xs) => xs.map((x, j) => (j === i ? { ...x, on } : x)))}
                        trackColor={{ true: colors.bead, false: '#262B35' }}
                        accessibilityLabel={`Offer ${s.name}`}
                      />
                    </View>
                    {s.on && (
                      <View style={styles.prices}>
                        {(['sedan', 'suv', 'truck'] as const).map((k) => (
                          <View key={k} style={{ flex: 1, gap: 4 }}>
                            <Text variant="caption">{k === 'suv' ? 'SUV' : k[0].toUpperCase() + k.slice(1)}</Text>
                            <TextInput
                              value={`$${s[k]}`}
                              onChangeText={(v) => setServices((xs) => xs.map((x, j) => (j === i ? { ...x, [k]: v.replace(/[^0-9.]/g, '') } : x)))}
                              keyboardType="decimal-pad"
                              accessibilityLabel={`${s.name} ${k} price`}
                              style={styles.price}
                            />
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                ))}
                <Text variant="eyebrow">Add-ons</Text>
                {addOns.map((a, i) => (
                  <View key={a.name} style={styles.addOn}>
                    <Text variant="body" style={{ flex: 1 }}>
                      {a.name}
                    </Text>
                    <TextInput
                      value={`$${a.price}`}
                      onChangeText={(v) => setAddOns((xs) => xs.map((x, j) => (j === i ? { ...x, price: v.replace(/[^0-9.]/g, '') } : x)))}
                      keyboardType="decimal-pad"
                      accessibilityLabel={`${a.name} price`}
                      style={[styles.price, { width: 72 }]}
                    />
                    <Switch
                      value={a.on}
                      onValueChange={(on) => setAddOns((xs) => xs.map((x, j) => (j === i ? { ...x, on } : x)))}
                      trackColor={{ true: colors.bead, false: '#262B35' }}
                      accessibilityLabel={`Offer ${a.name}`}
                    />
                  </View>
                ))}
                <Button
                  label="Continue"
                  onPress={() => go(2)}
                  disabled={!services.some((s) => s.on) || services.some((s) => s.on && [s.sedan, s.suv, s.truck].some((v) => !(cents(v) > 0)))}
                />
                <Button label="Back" variant="ghost" onPress={() => go(0)} />
              </>
            )}

            {step === 2 && (
              <>
                <Text variant="title">When can clients book?</Text>
                <Text variant="body" tone="steel">
                  Pick your days and start times. You can fine-tune each day later in Settings.
                </Text>
                <View style={styles.wrap}>
                  {DAYS.map((d) => {
                    const on = days.includes(d.wd);
                    return (
                      <Chip
                        key={d.wd}
                        label={d.label}
                        on={on}
                        onPress={() => setDays((xs) => (on ? xs.filter((x) => x !== d.wd) : [...xs, d.wd]))}
                      />
                    );
                  })}
                </View>
                <View style={styles.wrap}>
                  {TIMES.map((t) => {
                    const on = times.includes(t);
                    return <Chip key={t} label={to12h(t)} on={on} onPress={() => setTimes((xs) => (on ? xs.filter((x) => x !== t) : [...xs, t].sort()))} />;
                  })}
                </View>
                {error && (
                  <Text variant="caption" tone="danger">
                    {error}
                  </Text>
                )}
                <Button label="Create my booking page" onPress={create} loading={busy} disabled={!days.length || !times.length} />
                <Button label="Back" variant="ghost" onPress={() => go(1)} />
              </>
            )}

            {step === 3 && (
              <>
                <View style={{ alignItems: 'center', gap: space.md }}>
                  <LiquidBead size={96} />
                  <Text variant="title" style={{ textAlign: 'center' }}>
                    Your page is live
                  </Text>
                  <Text variant="body" tone="bead" style={{ textAlign: 'center' }}>
                    {apiBaseUrl.replace(/^https?:\/\//, '')}/{effectiveHandle}
                  </Text>
                </View>
                {paymentsMode === 'external' ? (
                  <>
                    <Text variant="body" tone="steel" style={{ textAlign: 'center' }}>
                      Last step: how should clients pay your deposit? They see this right after they book.
                    </Text>
                    <PaymentDetailsForm initial={{ link: null, note: null }} saveLabel="Save and open Beadup" onSaved={() => refreshProfile()} />
                  </>
                ) : (
                  <>
                    <Text variant="body" tone="steel" style={{ textAlign: 'center' }}>
                      Connect Stripe so clients can pay deposits. Beadup never sees card numbers, and payouts go straight to
                      your bank.
                    </Text>
                    {error && (
                      <Text variant="caption" tone="danger" style={{ textAlign: 'center' }}>
                        {error}
                      </Text>
                    )}
                    <Button label="Connect Stripe" onPress={connectStripe} loading={busy} />
                  </>
                )}
                <Button label="I’ll do this later" variant="ghost" onPress={() => refreshProfile()} />
              </>
            )}
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: on }}
      onPress={() => {
        haptic.select();
        onPress();
      }}
      style={[styles.chip, on && styles.chipOn]}>
      <Text variant="caption" style={{ color: on ? colors.beadInk : colors.paint, fontFamily: fonts.bodySemi, fontSize: 14 }}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.06)', marginRight: 10 },
  root: { flex: 1, backgroundColor: colors.midnight },
  aurora: { position: 'absolute', top: 0, left: 0, right: 0, height: 380 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  track: { height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.08)', overflow: 'hidden' },
  fill: { height: 4, borderRadius: 2, backgroundColor: colors.bead },
  card: { padding: 16, gap: 12, borderRadius: 22, backgroundColor: '#11151B', borderWidth: 1, borderColor: colors.line },
  cardOn: { borderColor: 'rgba(77,216,255,0.45)', backgroundColor: '#0F1A20' },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  prices: { flexDirection: 'row', gap: 8 },
  price: { height: 46, borderRadius: radius.sm, paddingHorizontal: 12, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: colors.line, color: colors.paint, fontFamily: fonts.bodySemi, fontSize: 16 },
  addOn: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { height: 40, paddingHorizontal: 16, borderRadius: 20, justifyContent: 'center', backgroundColor: colors.gunmetal, borderWidth: 1, borderColor: '#262B35' },
  chipOn: { backgroundColor: colors.bead, borderColor: colors.bead },
});
