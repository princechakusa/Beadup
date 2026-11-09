import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { BackButton } from '@/components/nav/BackButton';
import { GlassCard } from '@/components/ui/GlassCard';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { fetchProfile, fetchReviews, useQuery } from '@/lib/data';
import { dayLabel } from '@/lib/format';
import { apiBaseUrl } from '@/lib/supabase';
import { colors, space } from '@/theme/tokens';

const STAR = 'M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z';

function Stars({ value, size = 14 }: { value: number; size?: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 2 }} accessibilityLabel={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Svg key={i} width={size} height={size} viewBox="0 0 24 24">
          <Path d={STAR} fill={i <= Math.round(value) ? colors.gold : 'rgba(255,255,255,0.12)'} />
        </Svg>
      ))}
    </View>
  );
}

/**
 * The detailer's reviews. Read-only: detailers can't edit or hide reviews
 * (Apple 1.2). Clients see the average and count on the booking page.
 */
export default function Reviews() {
  const reviews = useQuery(fetchReviews, [], 'reviews');
  const profile = useQuery(fetchProfile);
  const tz = profile.data?.timezone ?? 'America/Chicago';
  const list = reviews.data ?? [];
  const avg = list.length ? list.reduce((n, r) => n + r.rating, 0) / list.length : null;

  return (
    <Screen title="Reviews" tabs={false} right={<BackButton variant="back" />} offline={reviews.stale} onRefresh={reviews.refresh} refreshing={reviews.loading && !!reviews.data}>
      <GlassCard>
        <View style={styles.summary}>
          <Text style={styles.avg}>{avg !== null ? avg.toFixed(1) : '–'}</Text>
          <View style={{ gap: 6, flex: 1 }}>
            <Stars value={avg ?? 0} size={18} />
            <Text variant="caption">
              {list.length === 0 ? 'No reviews yet' : `${list.length} review${list.length === 1 ? '' : 's'}`}
            </Text>
          </View>
        </View>
        <Text variant="caption" style={{ marginTop: space.md, lineHeight: 19 }}>
          Clients see your average and count at the top of {apiBaseUrl.replace(/^https?:\/\//, '')}/{profile.data?.handle ?? 'you'}. After a job,
          open it and tap &quot;Ask for a review&quot; to text your client their private review link.
        </Text>
      </GlassCard>

      {list.map((r, i) => (
        <Animated.View key={r.id} entering={FadeInDown.delay(Math.min(i, 8) * 50).springify()}>
          <GlassCard>
            <View style={styles.head}>
              <Text variant="bodyStrong">{r.clientName}</Text>
              <Text variant="caption">{dayLabel(r.createdAt, tz)}</Text>
            </View>
            <View style={{ marginTop: 6 }}>
              <Stars value={r.rating} />
            </View>
            {!!r.body && (
              <Text variant="body" style={{ marginTop: space.sm, color: colors.paint }}>
                {r.body}
              </Text>
            )}
          </GlassCard>
        </Animated.View>
      ))}

      {reviews.error && !reviews.data && <Text variant="caption">Could not load reviews. Pull down to retry.</Text>}
    </Screen>
  );
}

const styles = StyleSheet.create({
  summary: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
  avg: { fontFamily: 'Sora_800ExtraBold', fontSize: 48, letterSpacing: -2, lineHeight: 52, color: colors.gold },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
