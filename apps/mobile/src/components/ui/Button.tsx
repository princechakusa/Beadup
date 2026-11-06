import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { haptic } from '@/lib/haptics';
import { colors, glow, radius, space, springs } from '@/theme/tokens';

import { Text } from './Text';

type Variant = 'primary' | 'glass' | 'ghost' | 'danger';

type Props = {
  label: string;
  onPress: () => void;
  variant?: Variant;
  icon?: ReactNode;
  disabled?: boolean;
  loading?: boolean;
  accessibilityHint?: string;
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** Springy press (squish to 96%), light haptic, 52pt touch target. */
export function Button({ label, onPress, variant = 'primary', icon, disabled, loading, accessibilityHint }: Props) {
  const scale = useSharedValue(1);
  const pressed = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  const inactive = disabled || loading;

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      disabled={inactive}
      onPressIn={() => {
        scale.set(withSpring(0.96, springs.press));
      }}
      onPressOut={() => {
        scale.set(withSpring(1, springs.bouncy));
      }}
      onPress={() => {
        haptic.tap();
        onPress();
      }}
      style={[styles.base, variantStyles[variant], variant === 'primary' && !inactive && glow, inactive && styles.inactive, pressed]}>
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? colors.beadInk : colors.paint} />
      ) : (
        <View style={styles.row}>
          {icon}
          <Text variant="bodyStrong" tone={variant === 'primary' ? 'beadInk' : variant === 'danger' ? 'danger' : 'paint'}>
            {label}
          </Text>
        </View>
      )}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 52,
    borderRadius: radius.pill,
    paddingHorizontal: space.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  inactive: { opacity: 0.45 },
});

const variantStyles = StyleSheet.create({
  primary: { backgroundColor: colors.bead },
  glass: { backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.lineStrong },
  ghost: { backgroundColor: 'transparent' },
  danger: { backgroundColor: 'rgba(255,138,138,0.1)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,138,138,0.35)' },
});
