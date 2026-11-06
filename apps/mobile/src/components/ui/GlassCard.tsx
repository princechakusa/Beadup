import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, glow, radius, space } from '@/theme/tokens';

type Props = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Bead-blue edge glow for the one card that matters most on a screen. */
  glowing?: boolean;
  padded?: boolean;
};

/**
 * Dark glass surface: background blur (iOS), translucent gunmetal fill, a
 * hairline edge and a soft top highlight like light catching a glass pane.
 * Android has no cheap live blur, so it uses the translucent fill alone.
 */
export function GlassCard({ children, style, glowing = false, padded = true }: Props) {
  return (
    <View style={[styles.shell, glowing && glow, style]}>
      <View style={styles.clip}>
        {Platform.OS === 'ios' && (
          <BlurView intensity={28} tint="systemUltraThinMaterialDark" style={StyleSheet.absoluteFill} />
        )}
        <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.panel }]} />
        <LinearGradient
          colors={['rgba(255,255,255,0.09)', 'rgba(255,255,255,0)']}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 0.45 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        <View style={padded ? styles.pad : undefined}>{children}</View>
      </View>
      <View pointerEvents="none" style={[styles.edge, glowing && { borderColor: 'rgba(77,216,255,0.45)' }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  shell: { borderRadius: radius.lg },
  clip: { borderRadius: radius.lg, overflow: 'hidden' },
  pad: { padding: space.lg + 2 },
  edge: {
    ...StyleSheet.absoluteFill,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.lineStrong,
  },
});
