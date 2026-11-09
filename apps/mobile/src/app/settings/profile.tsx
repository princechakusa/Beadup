import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { BackButton } from '@/components/nav/BackButton';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { useAuth } from '@/lib/auth';
import { fetchBusinessProfile, saveBusinessProfile, useQuery, type BusinessProfile } from '@/lib/data';
import { COUNTRIES, type Country } from '@/lib/format';
import { haptic } from '@/lib/haptics';
import { apiBaseUrl } from '@/lib/supabase';
import { colors, space } from '@/theme/tokens';

/** Settings: business name, tagline, service area and country (what clients see on the booking page). */
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
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!name.trim()) {
      haptic.error();
      return setError('Add your business name.');
    }
    setBusy(true);
    setError(null);
    try {
      await saveBusinessProfile({ businessName: name, tagline, serviceArea: area, country });
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
      <Field label="Tagline (optional)" value={tagline} onChangeText={setTagline} maxLength={120} placeholder="e.g. Mobile detailing · we come to you" />
      <Field label="Service area (optional)" value={area} onChangeText={setArea} maxLength={80} placeholder="e.g. Austin, TX · 25 mi" />
      <View style={{ gap: space.sm }}>
        <Text variant="eyebrow">Country</Text>
        <View style={styles.chips} accessibilityRole="radiogroup">
          {(Object.keys(COUNTRIES) as Country[]).map((c) => {
            const on = c === country;
            return (
              <Pressable
                key={c}
                onPress={() => {
                  haptic.select();
                  setCountry(c);
                }}
                style={[styles.chip, on && styles.chipOn]}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
              >
                <Text variant="bodyStrong" style={{ fontSize: 14, color: on ? colors.beadInk : colors.paint }}>
                  {COUNTRIES[c].name}
                </Text>
                <Text variant="caption" style={{ fontSize: 12, color: on ? colors.beadInk : colors.steel }}>
                  {COUNTRIES[c].currency}
                </Text>
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
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.gunmetal,
    borderWidth: 1,
    borderColor: colors.lineStrong,
  },
  chipOn: { backgroundColor: colors.bead, borderColor: colors.bead },
});
