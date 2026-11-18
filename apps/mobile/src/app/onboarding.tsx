import { LinearGradient } from 'expo-linear-gradient';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, Switch, TextInput, View } from 'react-native';
import Animated, { FadeInRight, FadeOutLeft, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LiquidBead } from '@/components/bead/LiquidBead';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Text } from '@/components/ui/Text';
import { signOut, useAuth } from '@/lib/auth';
import { Icon } from '@/components/ui/Icon';
import { PaymentDetailsForm } from '@/components/payments/PaymentDetailsForm';
import { claimReferral, startPayoutsSetup, usePaymentsMode } from '@/lib/data';
import { COUNTRIES, currencySymbol, deviceCountry, setMoneyCountry, type Country } from '@/lib/format';
import { startersFor } from '@/lib/starters';
import { setCurrentTrade, TRADES, type TradeId } from '@/lib/trades';
import { TradePicker, VisitPicker } from '@/components/TradePicker';
import { Dropdown } from '@/components/ui/Dropdown';
import { haptic } from '@/lib/haptics';
import { apiBaseUrl, supabase } from '@/lib/supabase';
import { colors, fonts, radius, space, springs } from '@/theme/tokens';
import { phrase } from '@/lib/i18n/phrases';
import { dateLocale, t } from '@/lib/i18n';

const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
// 2023-01-01 was a Sunday, so weekday number n is 2023-01-0(1 + n).
const dayShort = (wd: number) => new Date(Date.UTC(2023, 0, 1 + wd)).toLocaleDateString(dateLocale(), { weekday: 'short', timeZone: 'UTC' });
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
const STEP_KEYS = ['ob_s1', 'ob_s2', 'ob_s3', 'ob_s4'] as const;

export default function Onboarding() {
  const insets = useSafeAreaInsets();
  const { refreshProfile } = useAuth();
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [handle, setHandle] = useState('');
  const [handleEdited, setHandleEdited] = useState(false);
  const [area, setArea] = useState('');
  const [referral, setReferral] = useState('');
  const [handleOk, setHandleOk] = useState<boolean | null>(null);
  // Country of the business: sets the currency. Starts where the phone is.
  const [country, setCountry] = useState<Country>(deviceCountry);
  const [pricesEdited, setPricesEdited] = useState(false);
  // The trade: sets the starter services, how prices work and the words clients see.
  const [tradeId, setTradeId] = useState<TradeId>('detailing');
  const [visitMode, setVisitMode] = useState<'mobile' | 'studio'>('mobile');
  const trade = TRADES[tradeId];
  const tiers = trade.pricing === 'tiers';
  const [services, setServices] = useState(() => startersFor('detailing', deviceCountry()).services);
  const [addOns, setAddOns] = useState(() => startersFor('detailing', deviceCountry()).addOns);
  const symbol = currencySymbol();
  const pickCountry = (c: Country) => {
    haptic.select();
    setCountry(c);
    setMoneyCountry(c);
    if (!pricesEdited) {
      const st = startersFor(tradeId, c);
      setServices((xs) => st.services.map((sv, i) => ({ ...sv, on: xs[i]?.on ?? sv.on })));
      setAddOns((xs) => st.addOns.map((a, i) => ({ ...a, on: xs[i]?.on ?? a.on })));
    }
  };
  const pickTrade = (tid: TradeId) => {
    setTradeId(tid);
    setVisitMode(TRADES[tid].visit);
    setCurrentTrade(tid);
    // A new trade means new starter services (the old ones were for another trade).
    const st = startersFor(tid, country);
    setServices(st.services);
    setAddOns(st.addOns);
    setPricesEdited(false);
  };
  const [days, setDays] = useState([1, 2, 3, 4, 5, 6]);
  const [times, setTimes] = useState(['08:00', '10:30', '13:00', '15:30']);
  const [busy, setBusy] = useState(false);
  const [confirmOut, setConfirmOut] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const effectiveHandle = handleEdited ? handle : slug(name);
  const paymentsMode = usePaymentsMode();

  // Live handle check (debounced).
  useEffect(() => {
    if (!supabase || effectiveHandle.length < 2) return;
    let alive = true;
    const timer = setTimeout(async () => {
      const { data } = await supabase!.rpc('handle_available', { p_handle: effectiveHandle });
      if (alive) setHandleOk(data === true);
    }, 350);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [effectiveHandle]);
  const handleValid = effectiveHandle.length >= 2 && handleOk !== false;

  const progress = useAnimatedStyle(() => ({ width: withSpring(`${((step + 1) / STEP_KEYS.length) * 100}%`, springs.settle) }));
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
        // One-price trades keep the same price in every size column.
        priceCents: tiers ? { sedan: cents(s.sedan), suv: cents(s.suv), truck: cents(s.truck) } : { sedan: cents(s.sedan), suv: cents(s.sedan), truck: cents(s.sedan) },
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
        setError(t('ob_taken_now'));
        return setStep(0);
      }
      return setError(t('ob_bad'));
    }
    // The business country (currency). The database guessed it from the
    // timezone; the detailer's choice wins.
    const { data: me } = await supabase.auth.getUser();
    if (me.user) await supabase.from('detailers').update({ country, trade: tradeId, visit_mode: visitMode }).eq('id', me.user.id);
    setCurrentTrade(tradeId);
    setMoneyCountry(country);
    // Optional "referred by" code. Never blocks setup: a wrong code can be
    // fixed later in Settings > Invite & earn.
    if (referral.trim()) await claimReferral(referral.trim()).catch(() => null);
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
      setError(t('ob_stripe_fail'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.root}>
      <LinearGradient colors={['rgba(77,216,255,0.14)', 'rgba(10,12,16,0)']} style={styles.aurora} />
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingTop: insets.top + space.lg, paddingBottom: insets.bottom + space.xl, paddingHorizontal: 20, gap: space.lg }}>
          <View style={styles.top}>
            {(step === 1 || step === 2) && (
              <Pressable
                onPress={() => go(step - 1)}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel={t('back')}
                style={styles.backBtn}>
                <Icon name="chevronLeft" size={20} color={colors.paint} />
              </Pressable>
            )}
            <Text variant="eyebrow" tone="bead" style={{ flex: 1 }}>
              {t('ob_step', { n: step + 1, total: STEP_KEYS.length, name: t(STEP_KEYS[step]) })}
            </Text>
            {step === 0 && (
              <Pressable onPress={() => setConfirmOut(true)} hitSlop={8}>
                <Text variant="caption">{t('signout')}</Text>
              </Pressable>
            )}
          </View>
          {confirmOut && (
            <View style={{ gap: 10, padding: 16, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,138,138,0.35)', backgroundColor: 'rgba(255,138,138,0.06)' }}>
              <Text variant="heading" style={{ fontSize: 18 }}>
                {t('so_title')}
              </Text>
              <Text variant="body" tone="steel">
                {t('so_body')}
              </Text>
              <Button label={t('so_yes')} variant="danger" onPress={() => signOut()} />
              <Button label={t('so_no')} variant="ghost" onPress={() => setConfirmOut(false)} />
            </View>
          )}
          <View style={styles.track}>
            <Animated.View style={[styles.fill, progress]} />
          </View>

          <Animated.View key={step} entering={FadeInRight.springify().damping(20)} exiting={FadeOutLeft.duration(150)} style={{ gap: space.lg }}>
            {step === 0 && (
              <>
                <Text variant="title">{t('ob_title')}</Text>
                <TradePicker value={tradeId} onChange={pickTrade} />
                <VisitPicker value={visitMode} onChange={setVisitMode} />
                <Field label={t('bp_name')} value={name} onChangeText={setName} placeholder={t('ob_name_ph')} maxLength={80} autoCapitalize="words" />
                <View style={{ gap: 6 }}>
                  <Field
                    label={t('ob_link')}
                    value={effectiveHandle}
                    onChangeText={(v) => {
                      setHandleEdited(true);
                      setHandle(slug(v));
                    }}
                    autoCapitalize="none"
                    autoCorrect={false}
                    maxLength={40}
                    error={handleOk === false ? t('ob_taken') : error}
                  />
                  <Text variant="caption" tone={handleOk ? 'bead' : 'steel'}>
                    {apiBaseUrl.replace(/^https?:\/\//, '')}/{effectiveHandle || t('ob_your_name')}
                    {handleOk ? `  ·  ${t('ob_available')}` : ''}
                  </Text>
                </View>
                <Field label={t('ob_area')} value={area} onChangeText={setArea} placeholder={t('bp_area_ph')} maxLength={80} />
                <Field
                  label={t('ob_ref')}
                  value={referral}
                  onChangeText={setReferral}
                  placeholder={t('ob_ref_ph')}
                  maxLength={120}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <Dropdown
                  label={t('ob_country')}
                  value={country}
                  options={(Object.keys(COUNTRIES) as Country[]).map((c) => ({ value: c, label: COUNTRIES[c].name, meta: COUNTRIES[c].currency }))}
                  onChange={pickCountry}
                  searchable
                />
                <Text variant="caption">{t('ob_tz', { tz: timezone.replace(/_/g, ' ') })}</Text>
                <Button label={t('continue')} onPress={() => go(1)} disabled={!name.trim() || !handleValid} />
              </>
            )}

            {step === 1 && (
              <>
                <Text variant="title">{t('ob_services')}</Text>
                <Text variant="body" tone="steel">
                  {tiers
                    ? t('ob_intro_tiers', { a: phrase(trade.tiers.sedan), b: phrase(trade.tiers.suv), c: phrase(trade.tiers.truck) })
                    : t('ob_intro_single')}
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
                        accessibilityLabel={t('ob_offer', { name: s.name })}
                      />
                    </View>
                    {s.on && (
                      <View style={styles.prices}>
                        {(tiers ? (['sedan', 'suv', 'truck'] as const) : (['sedan'] as const)).map((k) => (
                          <View key={k} style={{ flex: 1, gap: 4 }}>
                            <Text variant="caption">{tiers ? phrase(trade.tiers[k]) : t('ob_price')}</Text>
                            <TextInput
                              value={`${symbol}${s[k]}`}
                              onChangeText={(v) => {
                                setPricesEdited(true);
                                setServices((xs) => xs.map((x, j) => (j === i ? { ...x, [k]: v.replace(/[^0-9.]/g, '') } : x)));
                              }}
                              keyboardType="decimal-pad"
                              accessibilityLabel={tiers ? t('ob_tier_price_a11y', { name: s.name, tier: phrase(trade.tiers[k]) }) : t('ob_price_a11y', { name: s.name })}
                              style={styles.price}
                            />
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                ))}
                {addOns.length > 0 && <Text variant="eyebrow">{t('sv_addons')}</Text>}
                {addOns.map((a, i) => (
                  <View key={a.name} style={styles.addOn}>
                    <Text variant="body" style={{ flex: 1 }}>
                      {a.name}
                    </Text>
                    <TextInput
                      value={`${symbol}${a.price}`}
                      onChangeText={(v) => {
                        setPricesEdited(true);
                        setAddOns((xs) => xs.map((x, j) => (j === i ? { ...x, price: v.replace(/[^0-9.]/g, '') } : x)));
                      }}
                      keyboardType="decimal-pad"
                      accessibilityLabel={t('ob_price_a11y', { name: a.name })}
                      style={[styles.price, { width: 72 }]}
                    />
                    <Switch
                      value={a.on}
                      onValueChange={(on) => setAddOns((xs) => xs.map((x, j) => (j === i ? { ...x, on } : x)))}
                      trackColor={{ true: colors.bead, false: '#262B35' }}
                      accessibilityLabel={t('ob_offer', { name: a.name })}
                    />
                  </View>
                ))}
                <Button
                  label={t('continue')}
                  onPress={() => go(2)}
                  disabled={!services.some((s) => s.on) || services.some((s) => s.on && [s.sedan, s.suv, s.truck].some((v) => !(cents(v) > 0)))}
                />
                <Button label={t('back')} variant="ghost" onPress={() => go(0)} />
              </>
            )}

            {step === 2 && (
              <>
                <Text variant="title">{t('ob_when')}</Text>
                <Text variant="body" tone="steel">
                  {t('ob_when_d')}
                </Text>
                <View style={styles.wrap}>
                  {DAY_ORDER.map((wd) => {
                    const on = days.includes(wd);
                    return (
                      <Chip
                        key={wd}
                        label={dayShort(wd)}
                        on={on}
                        onPress={() => setDays((xs) => (on ? xs.filter((x) => x !== wd) : [...xs, wd]))}
                      />
                    );
                  })}
                </View>
                <View style={styles.wrap}>
                  {TIMES.map((slot) => {
                    const on = times.includes(slot);
                    return <Chip key={slot} label={to12h(slot)} on={on} onPress={() => setTimes((xs) => (on ? xs.filter((x) => x !== slot) : [...xs, slot].sort()))} />;
                  })}
                </View>
                {error && (
                  <Text variant="caption" tone="danger">
                    {error}
                  </Text>
                )}
                <Button label={t('ob_create')} onPress={create} loading={busy} disabled={!days.length || !times.length} />
                <Button label={t('back')} variant="ghost" onPress={() => go(1)} />
              </>
            )}

            {step === 3 && (
              <>
                <View style={{ alignItems: 'center', gap: space.md }}>
                  <LiquidBead size={96} />
                  <Text variant="title" style={{ textAlign: 'center' }}>
                    {t('ob_live')}
                  </Text>
                  <Text variant="body" tone="bead" style={{ textAlign: 'center' }}>
                    {apiBaseUrl.replace(/^https?:\/\//, '')}/{effectiveHandle}
                  </Text>
                </View>
                {paymentsMode === 'external' ? (
                  <>
                    <Text variant="body" tone="steel" style={{ textAlign: 'center' }}>
                      {t('ob_last')}
                    </Text>
                    <PaymentDetailsForm initial={{ link: null, note: null }} saveLabel={t('ob_save_open')} onSaved={() => refreshProfile()} />
                  </>
                ) : (
                  <>
                    <Text variant="body" tone="steel" style={{ textAlign: 'center' }}>
                      {t('ob_connect_d')}
                    </Text>
                    {error && (
                      <Text variant="caption" tone="danger" style={{ textAlign: 'center' }}>
                        {error}
                      </Text>
                    )}
                    <Button label={t('ob_connect')} onPress={connectStripe} loading={busy} />
                  </>
                )}
                <Button label={t('ob_later')} variant="ghost" onPress={() => refreshProfile()} />
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
  countries: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  countryChip: { height: 34, paddingHorizontal: 12, borderRadius: 17, justifyContent: 'center', backgroundColor: colors.gunmetal, borderWidth: 1, borderColor: '#262B35' },
  countryChipOn: { backgroundColor: colors.bead, borderColor: colors.bead },
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
