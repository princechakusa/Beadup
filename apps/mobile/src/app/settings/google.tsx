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

const STEPS = [
  ['Open your Google Business Profile', 'Search your business name on Google or open Google Business. If you have no profile yet, create one: it’s free.'],
  ['Add your booking link', 'Edit profile, then Contact, then add your Beadup link as your Website and as your Appointment link.'],
  ['Turn on “Book”', 'Google shows a Book button that opens your Beadup page. Clients can book straight from Search and Maps.'],
  ['Ask for Google reviews', 'After a job, send the receipt from Beadup, then ask happy clients to review you on Google too.'],
] as const;

/** How to put the Beadup booking link on Google Search and Maps (no API, no fees). */
export default function GoogleGuide() {
  const profile = useQuery(fetchProfile, [], 'profile');
  const link = profile.data ? `${apiBaseUrl}/${profile.data.handle}` : '';
  const [copied, setCopied] = useState(false);
  return (
    <Screen title="Get found on Google" tabs={false} right={<BackButton variant="back" />}>
      <Text variant="caption" style={{ fontSize: 14, lineHeight: 20 }}>
        Most clients search Google or Maps first. Put your Beadup link on your free Google Business Profile so they can book you
        in one tap. Your Beadup page is also listed in the Beadup directory and is set up for search engines.
      </Text>
      <View style={styles.card}>
        <Text variant="eyebrow">Your booking link</Text>
        <Text variant="bodyStrong" selectable>
          {link.replace(/^https?:\/\//, '') || '…'}
        </Text>
        <Button
          label={copied ? 'Copied' : 'Copy link'}
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
          <Text variant="eyebrow">Step {i + 1}</Text>
          <Text variant="bodyStrong">{title}</Text>
          <Text variant="caption" style={{ fontSize: 14, lineHeight: 20 }}>
            {body}
          </Text>
        </View>
      ))}
      <Button label="Open Google Business" onPress={() => WebBrowser.openBrowserAsync('https://business.google.com')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { gap: space.sm, padding: 16, borderRadius: 20, backgroundColor: '#11151B', borderWidth: 1, borderColor: colors.line },
});
