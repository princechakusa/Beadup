import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { View } from 'react-native';

import { BackButton } from '@/components/nav/BackButton';
import { Button } from '@/components/ui/Button';
import { GlassCard } from '@/components/ui/GlassCard';
import { Icon } from '@/components/ui/Icon';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { giveAiConsent } from '@/lib/ai';
import { haptic } from '@/lib/haptics';
import { apiBaseUrl } from '@/lib/supabase';
import { colors, space } from '@/theme/tokens';

// Third-party AI disclosure and explicit consent (Apple 5.1.2(i), rules.md
// section 3). Shown before the first photo is ever sent; can be withdrawn in
// Settings.
export default function AiConsent() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const accept = async () => {
    setBusy(true);
    setError(null);
    try {
      await giveAiConsent();
      haptic.success();
      router.back();
    } catch {
      haptic.error();
      setError('Could not save your choice. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  };

  const points: [string, string][] = [
    ['camera', 'Beadup sends the photos you choose, plus your services and add-ons, to Anthropic, the company that makes the Claude AI model.'],
    ['sparkle', 'The AI suggests a service and add-ons from your own price list. Prices always come from your price list, and you review every quote before it goes to a client.'],
    ['link', 'Photos are stored privately in your Beadup account. Only you can see them.'],
    ['settings', 'You can turn AI photo quotes off any time in Settings. Quotes still work without it.'],
  ];

  return (
    <Screen title="AI photo quotes" tabs={false} right={<BackButton />}>
      <Text variant="body" tone="steel">
        Before you use it, here is exactly what happens with your photos.
      </Text>
      <GlassCard>
        <View style={{ gap: space.lg }}>
          {points.map(([icon, text]) => (
            <View key={text} style={{ flexDirection: 'row', gap: space.md }}>
              <Icon name={icon as 'camera'} size={20} color={colors.bead} />
              <Text variant="body" style={{ flex: 1 }}>
                {text}
              </Text>
            </View>
          ))}
        </View>
      </GlassCard>
      <Text
        variant="caption"
        tone="bead"
        accessibilityRole="link"
        onPress={() => WebBrowser.openBrowserAsync(`${apiBaseUrl}/privacy`)}>
        Read our privacy policy
      </Text>
      {error && (
        <Text variant="caption" tone="danger">
          {error}
        </Text>
      )}
      <Button label="I agree, send my photos to the AI" onPress={accept} loading={busy} />
      <Button label="Not now" variant="ghost" onPress={() => router.back()} />
    </Screen>
  );
}
