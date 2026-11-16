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
import { phrase } from '@/lib/i18n/phrases';
import { t } from '@/lib/i18n';

/** Settings: business name, tagline, service area, client phone and country (what clients see on the booking page). */
export default function BusinessProfileScreen() {
  const profile = useQuery(fetchBusinessProfile, [], 'business-profile');
  return (
    <Screen title={t('bp_title')} tabs={false} right={<BackButton variant="back" />}>
      {profile.data ? (
        <ProfileForm initial={profile.data} />
      ) : (
        <Text variant="caption">{profile.error ? t('bp_load_fail') : t('bp_loading')}</Text>
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
      return setError(t('bp_add_name'));
    }
    const contactPhone = phone.trim() ? toE164(phone, country) : null;
    if (phone.trim() && !contactPhone) {
      haptic.error();
      return setPhoneError(t('bp_phone_bad', { country: COUNTRIES[country].name }));
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
      setError(t('bp_save_fail'));
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
      setError(t('bp_switch_fail'));
    } finally {
      setBusy(false);
    }
  };

  if (offer) {
    return (
      <View style={{ gap: space.lg }}>
        <Text variant="title">{t('bp_switch_title')}</Text>
        <Text variant="body" tone="steel">
          {t('bp_switch_body', { old: phrase(TRADES[initial.trade].name).toLowerCase(), new: phrase(TRADES[trade].name).toLowerCase() })}
        </Text>
        {error ? <Text variant="caption" style={{ color: colors.danger }}>{error}</Text> : null}
        <Button label={t('bp_use_starters', { trade: phrase(TRADES[trade].name).toLowerCase() })} onPress={useStarters} loading={busy} />
        <Button label={t('bp_keep')} variant="ghost" onPress={() => router.back()} />
      </View>
    );
  }

  return (
    <View style={{ gap: space.lg }}>
      <Field label={t('bp_name')} value={name} onChangeText={setName} maxLength={80} autoCapitalize="words" error={error} />
      <TradePicker value={trade} onChange={setTrade} />
      <VisitPicker value={visitMode} onChange={setVisitMode} />
      <View style={styles.listedRow}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="bodyStrong">{t('bp_directory')}</Text>
          <Text variant="caption" style={{ fontSize: 13 }}>{t('bp_directory_d')}</Text>
        </View>
        <Switch value={listed} onValueChange={setListed} trackColor={{ true: colors.bead, false: '#262B35' }} accessibilityLabel={t('bp_directory')} />
      </View>
      <Field label={t('bp_tagline')} value={tagline} onChangeText={setTagline} maxLength={120} placeholder={t('bp_tagline_ph')} />
      <Field label={t('bp_area')} value={area} onChangeText={setArea} maxLength={80} placeholder={t('bp_area_ph')} />
      <View style={{ gap: space.xs }}>
        <Field
          label={t('bp_phone')}
          value={phone}
          onChangeText={setPhone}
          maxLength={30}
          keyboardType="phone-pad"
          textContentType="telephoneNumber"
          autoComplete="tel"
          error={phoneError}
        />
        <Text variant="caption" style={{ fontSize: 13, lineHeight: 19 }}>
          {t('bp_phone_d')}
        </Text>
      </View>
      <View style={{ gap: space.sm }}>
        <Dropdown
          label={t('bp_country')}
          value={country}
          options={(Object.keys(COUNTRIES) as Country[]).map((c) => ({ value: c, label: COUNTRIES[c].name, meta: COUNTRIES[c].currency }))}
          onChange={setCountry}
          searchable
        />
        <Text variant="caption" style={{ fontSize: 13, lineHeight: 19 }}>
          {t('bp_country_d')}
        </Text>
      </View>
      <Text variant="caption" style={{ fontSize: 13, lineHeight: 19 }}>
        {t('bp_footer', { url: `${apiBaseUrl.replace(/^https?:\/\//, '')}/${initial.handle}` })}
      </Text>
      <Button label={t('save')} onPress={save} loading={busy} />
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
