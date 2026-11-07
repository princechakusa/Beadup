import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LiquidBead } from '@/components/bead/LiquidBead';
import { BackButton } from '@/components/nav/BackButton';
import { Button } from '@/components/ui/Button';
import { GlassCard } from '@/components/ui/GlassCard';
import { Text } from '@/components/ui/Text';
import { fetchBalance, fetchBooking, fetchNextBookings, fetchPayments, fetchProfile, useQuery } from '@/lib/data';
import { dateKey, dayLabel, startOfDay, timeOf, usd } from '@/lib/format';
import { haptic } from '@/lib/haptics';
import { colors, space } from '@/theme/tokens';

const SIZE_LABEL = { sedan: 'sedan', suv: 'SUV', truck: 'truck' } as const;

/** Counts up to `target` cents over ~0.9s (instant under Reduce Motion). */
function useCountUp(target: number) {
  const reduce = useReducedMotion();
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (reduce) return;
    let raf = 0;
    const start = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / 900);
      setValue(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, reduce]);
  return reduce ? target : value;
}

/** "Jenna R. paid you" celebration for a booking's payments. */
export default function Paid() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const profile = useQuery(fetchProfile);
  const tz = profile.data?.timezone ?? 'America/Chicago';
  const booking = useQuery(() => fetchBooking(id), [id]);
  const today = useQuery(() => fetchPayments(startOfDay(dateKey(new Date(), tz), tz)), [tz]);
  const balance = useQuery(fetchBalance);
  const next = useQuery(() => fetchNextBookings(3));

  const b = booking.data;
  const amount = useCountUp(b?.paidCents ?? 0);
  useEffect(() => {
    if (b && b.paidCents > 0) haptic.success();
  }, [b]);

  const todayTotal = (today.data ?? []).filter((p) => p.status === 'succeeded').reduce((n, p) => n + p.amountCents, 0);
  const nextJob = (next.data ?? []).find((x) => x.id !== id);
  const arrival = balance.data?.nextPayout ? dayLabel(balance.data.nextPayout.arrivalDate, tz) : 'Next payout';
  const name = b ? `${b.client.name.split(' ')[0]}${b.client.name.split(' ')[1] ? ` ${b.client.name.split(' ')[1][0]}.` : ''}` : '';

  return (
    <View style={[styles.root, { paddingTop: insets.top + space.lg, paddingBottom: insets.bottom + space.lg }]}>
      <LinearGradient colors={['rgba(255,181,71,0.16)', 'rgba(10,12,16,0)']} style={styles.glow} />
      <View style={{ alignSelf: 'flex-end' }}>
        <BackButton />
      </View>

      <View style={styles.hero}>
        <LiquidBead size={104} />
        <Animated.View entering={FadeInDown.delay(250).springify()} style={{ alignItems: 'center', gap: 4 }}>
          <Text variant="body" tone="steel" style={{ marginTop: space.lg }}>
            {b ? `${name} paid you` : ' '}
          </Text>
          <Text style={styles.amount} accessibilityLabel={b ? `${usd(b.paidCents)} paid` : undefined}>
            {usd(amount, { cents: true })}
          </Text>
          {b && (
            <Text variant="caption" style={{ textAlign: 'center' }}>
              {b.serviceName} · {SIZE_LABEL[b.vehicleSize]} · incl. {usd(b.depositCents)} deposit
            </Text>
          )}
        </Animated.View>
      </View>

      <Animated.View entering={FadeInDown.delay(400).springify()} style={{ gap: space.md }}>
        <GlassCard>
          <View style={styles.rowBetween}>
            <Text variant="body" tone="steel">
              Arrives in your bank
            </Text>
            <Text variant="bodyStrong">{arrival}</Text>
          </View>
          <View style={[styles.rowBetween, { marginTop: space.md }]}>
            <Text variant="body" tone="steel">
              Today&apos;s total
            </Text>
            <Text variant="bodyStrong" tone="gold">
              {usd(todayTotal, { cents: false })}
            </Text>
          </View>
        </GlassCard>

        {nextJob && (
          <Button
            label={`Next job · ${dateKey(new Date(nextJob.startsAt), tz) === dateKey(new Date(), tz) ? timeOf(nextJob.startsAt, tz) : dayLabel(nextJob.startsAt, tz)}`}
            onPress={() => router.replace(`/booking/${nextJob.id}`)}
          />
        )}
        <Button label="Done" variant="glass" onPress={() => router.replace('/')} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.midnight, paddingHorizontal: 20, justifyContent: 'space-between' },
  glow: { position: 'absolute', top: 0, left: 0, right: 0, height: 420 },
  hero: { alignItems: 'center' },
  amount: { fontFamily: 'Sora_800ExtraBold', fontSize: 56, letterSpacing: -2.5, lineHeight: 62, color: colors.gold },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
