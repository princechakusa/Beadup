import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import { Pressable, Share, StyleSheet, View } from 'react-native';

import { QrSheet } from '@/components/QrSheet';
import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { haptic } from '@/lib/haptics';
import { apiBaseUrl } from '@/lib/supabase';
import { colors } from '@/theme/tokens';

/**
 * The detailer's public booking link. Clients never install the app: they
 * open this link (Instagram bio, a text, a QR code) and book in the browser,
 * so it lives on the home screen, one tap from sharing.
 */
export function BookingLinkCard({ handle, businessName }: { handle: string; businessName: string }) {
  const [copied, setCopied] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const url = `${apiBaseUrl}/${handle}`;
  const shown = url.replace(/^https?:\/\//, '');

  const share = () => {
    haptic.select();
    Share.share({ message: `Book your next detail with ${businessName}: ${url}` }).catch(() => {});
  };
  const copy = async () => {
    await Clipboard.setStringAsync(url);
    haptic.success();
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <View style={styles.card}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="caption" style={{ fontSize: 12 }}>
          Clients book here, no app needed
        </Text>
        <Text variant="bodyStrong" tone="bead" numberOfLines={1} style={{ fontSize: 15 }}>
          {shown}
        </Text>
      </View>
      <Pressable onPress={copy} style={styles.btn} accessibilityRole="button" accessibilityLabel={copied ? 'Link copied' : 'Copy booking link'} hitSlop={4}>
        <Icon name={copied ? 'check' : 'link'} size={18} color={copied ? colors.success : colors.paint} />
      </Pressable>
      <Pressable
        onPress={() => {
          haptic.select();
          setQrOpen(true);
        }}
        style={styles.btn}
        accessibilityRole="button"
        accessibilityLabel="Show booking QR code"
        hitSlop={4}
      >
        <Icon name="qr" size={18} />
      </Pressable>
      <Pressable onPress={share} style={[styles.btn, styles.primary]} accessibilityRole="button" accessibilityLabel="Share booking link" hitSlop={4}>
        <Text variant="bodyStrong" style={{ color: colors.beadInk, fontSize: 14 }}>
          Share
        </Text>
      </Pressable>
      <QrSheet visible={qrOpen} onClose={() => setQrOpen(false)} url={url} businessName={businessName} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    paddingLeft: 18,
    borderRadius: 24,
    backgroundColor: '#11151B',
    borderWidth: 1,
    borderColor: 'rgba(77,216,255,0.25)',
  },
  btn: { minWidth: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.gunmetal, borderWidth: 1, borderColor: '#262B35' },
  primary: { paddingHorizontal: 18, backgroundColor: colors.bead, borderColor: colors.bead },
});
