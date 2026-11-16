import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { BackButton } from '@/components/nav/BackButton';
import { Button } from '@/components/ui/Button';
import { GlassCard } from '@/components/ui/GlassCard';
import { Icon } from '@/components/ui/Icon';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { AI_PROVIDER_LABEL, aiConsentStatus, giveAiConsent, type AiProviderId } from '@/lib/ai';
import { haptic } from '@/lib/haptics';
import { apiBaseUrl } from '@/lib/supabase';
import { colors, space } from '@/theme/tokens';
import { t } from '@/lib/i18n';

// Third-party AI disclosure and explicit consent (Apple 5.1.2(i), rules.md
// section 3). Shown before the first photo is ever sent; can be withdrawn in
// Settings.
export default function AiConsent() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [provider, setProvider] = useState<AiProviderId | null>(null);
  useEffect(() => {
    aiConsentStatus().then((s) => setProvider(s.provider));
  }, []);
  const label = provider ? AI_PROVIDER_LABEL[provider] : null;

  const accept = async () => {
    setBusy(true);
    setError(null);
    try {
      await giveAiConsent();
      haptic.success();
      router.back();
    } catch {
      haptic.error();
      setError(t('ai_fail'));
    } finally {
      setBusy(false);
    }
  };

  const points: [string, string][] = [
    ['camera', t('ai_p1', { provider: label?.long ?? t('ai_provider_fallback') })],
    ['sparkle', t('ai_p2')],
    ['link', t('ai_p3')],
    ['settings', t('ai_p4')],
  ];

  return (
    <Screen title={t('ai_title')} tabs={false} right={<BackButton />}>
      <Text variant="body" tone="steel">
        {t('ai_intro')}
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
        {t('ai_privacy')}
      </Text>
      {error && (
        <Text variant="caption" tone="danger">
          {error}
        </Text>
      )}
      <Button label={t('ai_agree')} onPress={accept} loading={busy} disabled={!provider} />
      <Button label={t('ai_not_now')} variant="ghost" onPress={() => router.back()} />
    </Screen>
  );
}
