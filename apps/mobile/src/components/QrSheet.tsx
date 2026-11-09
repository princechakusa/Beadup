// eslint-disable-next-line import/no-named-as-default -- the package's types only declare a default export
import qrcode from 'qrcode-generator';
import { useMemo } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, ZoomIn } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path, Rect } from 'react-native-svg';

import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { haptic } from '@/lib/haptics';
import { shareLink } from '@/lib/share';
import { colors } from '@/theme/tokens';

/** One SVG path for every dark module: fast to draw and crisp at any size. */
function qrPath(data: string) {
  const qr = qrcode(0, 'Q'); // Q: still scans with a scuffed decal or a glare spot
  qr.addData(data);
  qr.make();
  const n = qr.getModuleCount();
  let d = '';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) d += `M${c} ${r}h1v1h-1z`;
  return { d, n };
}

/**
 * Full-screen QR code for the booking link: for a client standing at the van,
 * a business card or a flyer. Dark modules on white so every camera reads it.
 */
export function QrSheet({ visible, onClose, url, businessName }: { visible: boolean; onClose: () => void; url: string; businessName: string }) {
  const { d, n } = useMemo(() => qrPath(url), [url]);
  const quiet = 4; // the quiet zone scanners need around the code
  const size = n + quiet * 2;

  const share = () => {
    haptic.select();
    shareLink(`Book your next detail with ${businessName}:`, url);
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Text variant="eyebrow">Booking QR code</Text>
          <Pressable onPress={onClose} style={styles.close} accessibilityRole="button" accessibilityLabel="Close" hitSlop={8}>
            <Icon name="close" size={18} />
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.body}>
          {visible && (
            <Animated.View entering={ZoomIn.springify().damping(16)} style={styles.card}>
              <Svg
                width="100%"
                height="100%"
                viewBox={`${-quiet} ${-quiet} ${size} ${size}`}
                accessibilityLabel={`QR code for ${url}`}
              >
                <Rect x={-quiet} y={-quiet} width={size} height={size} fill="#FFFFFF" />
                <Path d={d} fill="#0A0C10" />
              </Svg>
            </Animated.View>
          )}
          <Animated.View entering={FadeInDown.delay(120)} style={{ alignItems: 'center', gap: 6 }}>
            <Text variant="title" style={{ textAlign: 'center' }}>
              {businessName}
            </Text>
            <Text variant="bodyStrong" tone="bead" style={{ textAlign: 'center' }}>
              {url.replace(/^https?:\/\//, '')}
            </Text>
            <Text variant="caption" style={{ textAlign: 'center', marginTop: 8, maxWidth: 300 }}>
              Clients point their camera here and book in the browser. Screenshot it for your van, business cards or a
              flyer.
            </Text>
          </Animated.View>
          <Pressable onPress={share} style={styles.share} accessibilityRole="button" accessibilityLabel="Share booking link">
            <Icon name="share" size={18} color={colors.beadInk} />
            <Text variant="bodyStrong" style={{ color: colors.beadInk }}>
              Share link
            </Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.midnight },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 12 },
  close: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.gunmetal, borderWidth: 1, borderColor: colors.lineStrong },
  body: { alignItems: 'center', gap: 24, paddingHorizontal: 24, paddingTop: 12, paddingBottom: 40 },
  card: {
    width: '100%',
    maxWidth: 320,
    aspectRatio: 1,
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    shadowColor: colors.bead,
    shadowOpacity: 0.45,
    shadowRadius: 36,
    shadowOffset: { width: 0, height: 0 },
  },
  share: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 52, paddingHorizontal: 28, borderRadius: 26, backgroundColor: colors.bead },
});
