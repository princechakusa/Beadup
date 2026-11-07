import type { ReactNode } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TAB_BAR_SPACE } from '@/components/nav/GlassTabBar';
import { colors, space } from '@/theme/tokens';

import { Text } from './Text';

type Props = {
  eyebrow?: string;
  title: string;
  right?: ReactNode;
  children: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  /** Space for the floating tab bar (tab screens). */
  tabs?: boolean;
  /** Showing saved data because the network is unavailable. */
  offline?: boolean;
};

/** Standard screen: small grey line over a big Sora title, pull to refresh. */
export function Screen({ eyebrow, title, right, children, refreshing = false, onRefresh, tabs = true, offline = false }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={styles.root}
      // Keyboard: iOS scrolls the focused field above the keyboard, taps on
      // buttons work while it is open, and dragging the list down closes it
      // (number pads have no return key). Android resizes the window.
      automaticallyAdjustKeyboardInsets
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      contentContainerStyle={{
        paddingTop: insets.top + space.lg,
        paddingHorizontal: 20,
        paddingBottom: tabs ? TAB_BAR_SPACE + insets.bottom : space.xxxl,
        gap: 16,
      }}
      refreshControl={
        onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.bead} /> : undefined
      }>
      <View style={styles.header}>
        <View style={{ flex: 1, gap: 2 }}>
          {eyebrow && <Text variant="caption" style={{ fontSize: 14 }}>{eyebrow}</Text>}
          <Text variant="title" accessibilityRole="header" style={{ fontSize: 26 }}>
            {title}
          </Text>
        </View>
        {right}
      </View>
      {offline && (
        <View style={styles.offline} accessibilityLiveRegion="polite">
          <View style={styles.offlineDot} />
          <Text variant="caption" style={{ fontSize: 12 }}>
            Offline · showing your saved schedule
          </Text>
        </View>
      )}
      {children}
    </ScrollView>
  );
}

/** Small rounded status pill (Booked, Quote sent, Regular...). */
export function Badge({ label, tone }: { label: string; tone: 'bead' | 'gold' | 'success' | 'danger' | 'steel' }) {
  const c = { bead: colors.bead, gold: colors.gold, success: colors.success, danger: colors.danger, steel: colors.steel }[tone];
  return (
    <View style={[styles.badge, { backgroundColor: `${c}1F` }]}>
      <Text variant="caption" style={{ color: c, fontSize: 11, fontFamily: 'Inter_600SemiBold' }}>
        {label}
      </Text>
    </View>
  );
}

/** Grouped list card with hairline separators. */
export function ListCard({ children }: { children: ReactNode[] | ReactNode }) {
  const items = (Array.isArray(children) ? children : [children]).filter(Boolean);
  return (
    <View style={styles.list}>
      {items.map((child, i) => (
        <View key={i}>
          {i > 0 && <View style={styles.sep} />}
          {child}
        </View>
      ))}
    </View>
  );
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <View style={styles.empty}>
      <Text variant="bodyStrong">{title}</Text>
      <Text variant="caption" style={{ textAlign: 'center' }}>
        {body}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.midnight },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  list: { borderRadius: 24, backgroundColor: '#11151B', borderWidth: 1, borderColor: colors.line, overflow: 'hidden' },
  sep: { height: 1, marginHorizontal: 16, backgroundColor: 'rgba(255,255,255,0.06)' },
  empty: { alignItems: 'center', gap: 6, paddingVertical: space.xxl, paddingHorizontal: space.xl },
  offline: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: colors.lineStrong },
  offlineDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.steel },
});
