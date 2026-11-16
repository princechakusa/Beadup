import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Switch, View } from 'react-native';

import { BackButton } from '@/components/nav/BackButton';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { useAuth } from '@/lib/auth';
import { fetchBusinessProfile, saveBusinessProfile, switchToStarters, useQuery, type BusinessProfile } from '@/lib/data';
import { Dropdown } from '@/components/ui/Dropdown';
import { COUNTRIES, type Country } from '@/lib/format';
import { haptic } from '@/lib/haptics';
import { formatPhone, toE164 } from '@/lib/phone';
import { TRADES, type TradeId } from '@/lib/trades';
import { TradePicker, VisitPicker } from '@/components/TradePicker';
import { apiBaseUrl } from '@/lib/supabase';
import { colors, space } from '@/theme/tokens';

/** Settings: business name, tagline, service area, client phone and country (what clients see on the booking page). */
export default function BusinessProfileScreen() {
  const profile = useQuery(fetchBusinessProfile, [], 'business-profile');
  return (
    <Screen title="Business profile" tabs={false} right={<BackButton variant="back" />}>
      {profile.data ? (
        <ProfileForm initial={profile.data} />
      ) : (
        <Text variant="caption">{profile.error ? 'Could not load. Pull down to retry.' : 'Loading…'}</Text>
      )}
    </Screen>
  );
}

function ProfileForm({ initial }: { initial: BusinessProfile }) {
  const { refreshProfile } = useAuth();
  const [name, setName] = useState(initial.businessName);
  const [tagline, setTagline] = useState(initial.tagline);
  const [area, setArea] = useState(initial.serviceArea);
  const [country, setCountry] = useState<Country>(initial.country);
  const [trade, setTrade] = useState<TradeId>(initial.trade);
  const [visitMode, setVisitMode] = useState(initial.visitMode);
  const [listed, setListed] = useState(initial.listed);
  const [phone, setPhone] = useState(initial.contactPhone ? formatPhone(initial.contactPhone, initial.country) : '');
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // After a trade change: offer the new trade's starter services.
  const [offer, setOffer] = useState(false);

  const save = async () => {
    if (!name.trim()) {
      haptic.error();
      return setError('Add your business name.');
    }
    const contactPhone = phone.trim() ? toE164(phone, country) : null;
    if (phone.trim() && !contactPhone) {
      haptic.error();
      return setPhoneError(`Enter a ${COUNTRIES[country].name} number, or start with + and the country code.`);
    }
    setPhoneError(null);
    setBusy(true);
    setError(null);
    try {
      await saveBusinessProfile({ businessName: name, tagline, serviceArea: area, country, contactPhone, trade, visitMode, listed });
      haptic.success();
      await refreshProfile();
      if (trade !== initial.trade) setOffer(true);
      else router.back();
    } catch {
      haptic.error();
      setError('Could not save. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  };

  const useStarters = async () => {
    setBusy(true);
    try {
      await switchToStarters(trade, country);
      haptic.success();
      router.back();
    } catch {
      haptic.error();
      setError('Could not switch your services. Try again from Services.');
    } finally {
      setBusy(false);
    }
  };

  if (offer) {
    return (
      <View style={{ gap: space.lg }}>
        <Text variant="title">Switch your services too?</Text>
        <Text variant="body" tone="steel">
          Your current services and add-ons were made for {TRADES[initial.trade].name.toLowerCase()}. Switching hides them (past bookings keep their names) and adds
          starter services for {TRADES[trade].name.toLowerCase()}. You can edit everything in Services.
        </Text>
        {error ? <Text variant="caption" style={{ color: colors.danger }}>{error}</Text> : null}
        <Button label={`Use ${TRADES[trade].name.toLowerCase()} starters`} onPress={useStarters} loading={busy} />
        <Button label="Keep my current services" variant="ghost" onPress={() => router.back()} />
      </View>
    );
  }

  return (
    <View style={{ gap: space.lg }}>
      <Field label="Business name" value={name} onChangeText={setName} maxLength={80} autoCapitalize="words" error={error} />
      <TradePicker value={trade} onChange={setTrade} />
      <VisitPicker value={visitMode} onChange={setVisitMode} />
      <View style={styles.listedRow}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="bodyStrong">Show me in the Beadup directory</Text>
          <Text variant="caption" style={{ fontSize: 13 }}>New clients can find you at beadup.app/find by trade and area.</Text>
        </View>
        <Switch value={listed} onValueChange={setListed} trackColor={{ true: colors.bead, false: '#262B35' }} accessibilityLabel="Show me in the Beadup directory" />
      </View>
      <Field label="Tagline (optional)" value={tagline} onChangeText={setTagline} maxLength={120} placeholder="e.g. Mobile detailing · we come to you" />
      <Field label="Service area (optional)" value={area} onChangeText={setArea} maxLength={80} placeholder="e.g. Austin, TX · 25 mi" />
      <View style={{ gap: space.xs }}>
        <Field
          label="Phone for clients (optional)"
          value={phone}
          onChangeText={setPhone}
          maxLength={30}
          keyboardType="phone-pad"
          textContentType="telephoneNumber"
          autoComplete="tel"
          error={phoneError}
        />
        <Text variant="caption" style={{ fontSize: 13, lineHeight: 19 }}>
          Shown on your booking page and confirmation, so clients can text or call you about their booking.
        </Text>
      </View>
      <View style={{ gap: space.sm }}>
        <Dropdown
          label="Country"
          value={country}
          options={(Object.keys(COUNTRIES) as Country[]).map((c) => ({ value: c, label: COUNTRIES[c].name, meta: COUNTRIES[c].currency }))}
          onChange={setCountry}
          searchable
        />
        <Text variant="caption" style={{ fontSize: 13, lineHeight: 19 }}>
          Sets the currency your prices are shown in and how clients&apos; phone numbers are read. It doesn&apos;t convert your prices.
        </Text>
      </View>
      <Text variant="caption" style={{ fontSize: 13, lineHeight: 19 }}>
        Clients see these on your booking page. Your link stays {apiBaseUrl.replace(/^https?:\/\//, '')}/{initial.handle}, so links you
        already shared keep working.
      </Text>
      <Button label="Save" onPress={save} loading={busy} />
    </View>
  );
}

const styles = StyleSheet.create({
  listedRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 18, backgroundColor: '#11151B', borderWidth: 1, borderColor: colors.line },
  list: { borderRadius: 22, overflow: 'hidden', backgroundColor: 'rgba(22,26,33,0.72)', borderWidth: 1, borderColor: colors.line },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 54, paddingHorizontal: 14 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.lineStrong },
  rowOn: { backgroundColor: 'rgba(77,216,255,0.08)' },
  code: { width: 34, height: 26, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.gunmetal, borderWidth: 1, borderColor: colors.lineStrong },
  codeOn: { backgroundColor: colors.bead, borderColor: colors.bead },
  radio: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: colors.lineStrong },
  radioOn: { backgroundColor: colors.bead, borderColor: colors.bead },
});
