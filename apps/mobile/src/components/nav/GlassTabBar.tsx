import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import type { BottomTabBarProps } from 'expo-router/tabs';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated, { LinearTransition, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, type IconName } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { haptic } from '@/lib/haptics';
import { colors, springs } from '@/theme/tokens';

const TABS: Record<string, { label: string; icon: IconName }> = {
  index: { label: 'Today', icon: 'today' },
  calendar: { label: 'Calendar', icon: 'calendar' },
  clients: { label: 'Clients', icon: 'clients' },
  money: { label: 'Money', icon: 'money' },
};

export const TAB_BAR_SPACE = 120; // scroll padding so content clears the floating bar

/**
 * Floating glass pill from the design: the active tab grows into a labelled
 * capsule (layout spring), and the centre bead button opens a new quote.
 */
export function GlassTabBar({ state, navigateToTab }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const routes = state.routes.filter((r) => r.name in TABS);
  const left = routes.slice(0, 2);
  const right = routes.slice(2);

  const tab = (route: (typeof routes)[number]) => {
    const meta = TABS[route.name];
    const focused = state.routes[state.index]?.key === route.key;
    return (
      <Animated.View key={route.key} layout={LinearTransition.springify().damping(18).stiffness(220)}>
        <Pressable
          accessibilityRole="tab"
          accessibilityLabel={meta.label}
          accessibilityState={{ selected: focused }}
          onPress={() => {
            if (focused) return;
            haptic.select();
            navigateToTab(route.key);
          }}
          style={[styles.tab, focused && styles.tabActive]}>
          <Icon name={meta.icon} size={20} color={focused ? colors.bead : colors.steel} strokeWidth={focused ? 2 : 1.8} />
          {focused && (
            <Text variant="caption" tone="bead" style={styles.tabLabel}>
              {meta.label}
            </Text>
          )}
        </Pressable>
      </Animated.View>
    );
  };

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 12) + 8 }]}>
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(10,12,16,0)', colors.midnight]}
        locations={[0, 0.55]}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.bar}>
        {Platform.OS === 'ios' && <BlurView intensity={40} tint="systemUltraThinMaterialDark" style={StyleSheet.absoluteFill} />}
        <View style={[StyleSheet.absoluteFill, styles.fill]} />
        {left.map(tab)}
        <QuoteButton />
        {right.map(tab)}
      </View>
    </View>
  );
}

function QuoteButton() {
  const scale = useSharedValue(1);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  return (
    <Animated.View style={style}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="New quote"
        onPressIn={() => scale.set(withSpring(0.9, springs.press))}
        onPressOut={() => scale.set(withSpring(1, springs.bouncy))}
        onPress={() => {
          haptic.tap();
          router.push('/quote');
        }}
        style={styles.quote}>
        <Icon name="plus" size={22} color={colors.beadInk} strokeWidth={2.6} />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingTop: 40, paddingHorizontal: 20 },
  bar: {
    height: 64,
    borderRadius: 32,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  fill: { backgroundColor: Platform.OS === 'ios' ? 'rgba(28,33,42,0.55)' : 'rgba(28,33,42,0.94)' },
  tab: { height: 48, minWidth: 48, borderRadius: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  tabActive: { paddingHorizontal: 16, backgroundColor: 'rgba(77,216,255,0.14)' },
  tabLabel: { fontSize: 14 },
  quote: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.bead,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.bead,
    shadowOpacity: 0.45,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
});
