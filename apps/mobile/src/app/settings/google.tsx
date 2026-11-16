import * as Clipboard from 'expo-clipboard';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { BackButton } from '@/components/nav/BackButton';
import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { fetchProfile, useQuery } from '@/lib/data';
import { haptic } from '@/lib/haptics';
import { apiBaseUrl } from '@/lib/supabase';
import { colors, space } from '@/theme/tokens';
import { t } from '@/lib/i18n';

const STEP_KEYS = [
  ['gg_s1t', 'gg_s1b'],
  ['gg_s2t', 'gg_s2b'],
  ['gg_s3t', 'gg_s3b'],
  ['gg_s4t', 'gg_s4b'],
] as const;

/** How to put the Beadup booking link on Google Search and Maps (no API, no fees). */
export default function GoogleGuide() {
  const profile = useQuery(fetchProfile, [], 'profile');
  const link = profile.data ? `${apiBaseUrl}/${profile.data.handle}` : '';
  const [copied, setCopied] = useState(false);
  const STEPS = STEP_KEYS.map(([a, b]) => [t(a), t(b)] as const);
  return (
    <Screen title={t('gg_title')} tabs={false} right={<BackButton variant="back" />}>
      <Text variant="caption" style={{ fontSize: 14, lineHeight: 20 }}>
        {t('gg_intro')}
      </Text>
      <View style={styles.card}>
        <Text variant="eyebrow">{t('gg_link')}</Text>
        <Text variant="bodyStrong" selectable>
          {link.replace(/^https?:\/\//, '') || '…'}
        </Text>
        <Button
          label={copied ? t('gg_copied') : t('gg_copy')}
          variant="glass"
          onPress={async () => {
            await Clipboard.setStringAsync(link);
            haptic.success();
            setCopied(true);
          }}
          disabled={!link}
        />
      </View>
      {STEPS.map(([title, body], i) => (
        <View key={title} style={styles.card}>
          <Text variant="eyebrow">{t('gg_step', { n: i + 1 })}</Text>
          <Text variant="bodyStrong">{title}</Text>
          <Text variant="caption" style={{ fontSize: 14, lineHeight: 20 }}>
            {body}
          </Text>
        </View>
      ))}
      <Button label={t('gg_open')} onPress={() => WebBrowser.openBrowserAsync('https://business.google.com')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { gap: space.sm, padding: 16, borderRadius: 20, backgroundColor: '#11151B', borderWidth: 1, borderColor: colors.line },
});
