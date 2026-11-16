import { LinearGradient } from 'expo-linear-gradient';
import { View } from 'react-native';

import { colors } from '@/theme/tokens';

type Props = { size?: number; dropIn?: boolean; interactive?: boolean };

/** Expo web preview only: a simple glass bead (the native version is drawn with Skia). */
export function LiquidBead({ size = 140 }: Props) {
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <LinearGradient
        colors={['#BDEFFF', colors.bead, colors.beadDeep]}
        start={{ x: 0.25, y: 0.15 }}
        end={{ x: 0.8, y: 1 }}
        style={{ width: size * 0.9, height: size * 0.82, borderRadius: size * 0.45, opacity: 0.92 }}
      />
    </View>
  );
}
