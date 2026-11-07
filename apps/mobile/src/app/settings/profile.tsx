import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { BackButton } from '@/components/nav/BackButton';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { useAuth } from '@/lib/auth';
import { fetchBusinessProfile, saveBusinessProfile, useQuery, type BusinessProfile } from '@/lib/data';
import { haptic } from '@/lib/haptics';
import { apiBaseUrl } from '@/lib/supabase';
import { space } from '@/theme/tokens';

/** Settings: business name, tagline and service area (what clients see on the booking page). */
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
      await saveBusinessProfile({ businessName: name, tagline, serviceArea: area });
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
      <Text variant="caption" style={{ fontSize: 13, lineHeight: 19 }}>
        Clients see these on your booking page. Your link stays {apiBaseUrl.replace(/^https?:\/\//, '')}/{initial.handle}, so links you
        already shared keep working.
      </Text>
      <Button label="Save" onPress={save} loading={busy} />
    </View>
  );
}
