import { LinearGradient } from 'expo-linear-gradient';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LiquidBead } from '@/components/bead/LiquidBead';
import { Button } from '@/components/ui/Button';
import { GlassCard } from '@/components/ui/GlassCard';
import { Text } from '@/components/ui/Text';
import { signOut, useAuth } from '@/lib/auth';
import { haptic } from '@/lib/haptics';
import { colors, space } from '@/theme/tokens';

// Design system preview. Replaced by the Today dashboard in the screens step
// of M4; kept small so the theme can be checked on a device in Expo.
export default function DesignPreview() {
  const { session } = useAuth();
  return (
    <View style={styles.root}>
      <LinearGradient
        colors={['rgba(77,216,255,0.16)', 'rgba(10,12,16,0)']}
        style={styles.aurora}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.6, y: 1 }}
      />
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.hero}>
            <LiquidBead size={132} />
            <Text variant="eyebrow" tone="bead" style={{ marginTop: space.xl }}>
              Beadup
            </Text>
            <Text variant="hero" style={{ textAlign: 'center', marginTop: space.sm }}>
              Quote, book{'\n'}and get paid
            </Text>
            <Text variant="body" tone="steel" style={{ textAlign: 'center', marginTop: space.md }}>
              Tilt your phone and watch the light move. Tap the bead.
            </Text>
          </View>

          <GlassCard glowing>
            <Text variant="eyebrow">Today</Text>
            <Text variant="money" style={{ marginTop: space.sm }}>
              $1,240
            </Text>
            <Text variant="caption" style={{ marginTop: space.xs }}>
              4 jobs · next at 9:30 AM
            </Text>
          </GlassCard>

          <GlassCard>
            <Text variant="heading">Full detail · SUV</Text>
            <Text variant="caption" style={{ marginTop: space.xs }}>
              Dana R. · 1200 Barton Springs Rd
            </Text>
          </GlassCard>

          <View style={{ gap: space.md }}>
            <Button label="New quote" onPress={() => haptic.success()} />
            <Button label="Share booking link" variant="glass" onPress={() => {}} />
            <Button label="Cancel booking" variant="danger" onPress={() => haptic.warning()} />
            {session && <Button label="Sign out" variant="ghost" onPress={() => signOut()} />}
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.midnight },
  aurora: { position: 'absolute', top: 0, left: 0, right: 0, height: 420 },
  content: { padding: space.xl, gap: space.lg, paddingBottom: space.xxxl },
  hero: { alignItems: 'center', paddingVertical: space.xl },
});
