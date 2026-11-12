import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { BackButton } from '@/components/nav/BackButton';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Icon } from '@/components/ui/Icon';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { useAuth } from '@/lib/auth';
import { fetchBusinessProfile, saveBusinessProfile, useQuery, type BusinessProfile } from '@/lib/data';
import { COUNTRIES, type Country } from '@/lib/format';
import { haptic } from '@/lib/haptics';
import { formatPhone, toE164 } from '@/lib/phone';
import type { TradeId } from '@/lib/trades';
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
  const [phone, setPhone] = useState(initial.contactPhone ? formatPhone(initial.contactPhone, initial.country) : '');
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
      await saveBusinessProfile({ businessName: name, tagline, serviceArea: area, country, contactPhone, trade, visitMode });
      haptic.success();
      await refreshProfile();
      router.back();
    } catch {
      haptic.error();
      setError('Could not save. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ gap: space.lg }}>
      <Field label="Business name" value={name} onChangeText={setName} maxLength={80} autoCapitalize="words" error={error} />
      <TradePicker value={trade} onChange={setTrade} />
      <VisitPicker value={visitMode} onChange={setVisitMode} />
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
        <Text variant="eyebrow">Country</Text>
        {/* One glass list, one row per country: code tile, name, currency, check. */}
        <View style={styles.list} accessibilityRole="radiogroup">
          {(Object.keys(COUNTRIES) as Country[]).map((c, i) => {
            const on = c === country;
            return (
              <Pressable
                key={c}
                onPress={() => {
                  haptic.select();
                  setCountry(c);
                }}
                style={({ pressed }) => [styles.row, i > 0 && styles.divider, on && styles.rowOn, pressed && { opacity: 0.7 }]}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
                accessibilityLabel={`${COUNTRIES[c].name}, ${COUNTRIES[c].currency}`}
              >
                <View style={[styles.code, on && styles.codeOn]}>
                  <Text variant="bodyStrong" style={{ fontSize: 12, letterSpacing: 0.6, color: on ? colors.beadInk : colors.steel }}>
                    {c}
                  </Text>
                </View>
                <Text variant="bodyStrong" style={{ flex: 1, fontSize: 15 }} numberOfLines={1}>
                  {COUNTRIES[c].name}
                </Text>
                <Text variant="caption" style={{ fontSize: 13, color: on ? colors.bead : colors.steel }}>
                  {COUNTRIES[c].currency}
                </Text>
                <View style={[styles.radio, on && styles.radioOn]}>{on && <Icon name="check" size={13} strokeWidth={2.8} color={colors.beadInk} />}</View>
              </Pressable>
            );
          })}
        </View>
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
  list: { borderRadius: 22, overflow: 'hidden', backgroundColor: 'rgba(22,26,33,0.72)', borderWidth: 1, borderColor: colors.line },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 54, paddingHorizontal: 14 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.lineStrong },
  rowOn: { backgroundColor: 'rgba(77,216,255,0.08)' },
  code: { width: 34, height: 26, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.gunmetal, borderWidth: 1, borderColor: colors.lineStrong },
  codeOn: { backgroundColor: colors.bead, borderColor: colors.bead },
  radio: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: colors.lineStrong },
  radioOn: { backgroundColor: colors.bead, borderColor: colors.bead },
});
