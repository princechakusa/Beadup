import { router } from 'expo-router';
import { useState } from 'react';
import { Linking, Platform, Pressable, StyleSheet, View } from 'react-native';

import { BookingLinkCard } from '@/components/BookingLinkCard';
import { Sparkline } from '@/components/charts/Sparkline';
import { Icon } from '@/components/ui/Icon';
import { Badge, EmptyState, ListCard, Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { useAuth } from '@/lib/auth';
import {
  fetchBookings,
  fetchNextBookings,
  fetchPayments,
  usePaymentsMode,
  fetchProfile,
  fetchRating,
  useQuery,
  type Booking,
} from '@/lib/data';
import { addDaysKey, dateKey, greeting, mondayOf, startOfDay, timeOf, money, moneyParts, weekdayIndex } from '@/lib/format';
import { haptic } from '@/lib/haptics';
import { useNow } from '@/lib/time';
import { colors, space } from '@/theme/tokens';

const SIZE_LABEL = { sedan: 'Sedan', suv: 'SUV', truck: 'Truck' } as const;

export default function Today() {
  const { session } = useAuth();
  const [chartWidth, setChartWidth] = useState(0);
  const now = useNow();

  const profile = useQuery(fetchProfile, [], 'profile');
  const tz = profile.data?.timezone ?? 'America/Chicago';
  const todayKey = dateKey(new Date(), tz);
  const monday = mondayOf(todayKey);

  // Launch mode: clients pay the detailer directly, so earnings come from
  // finished jobs instead of Stripe payments.
  const external = usePaymentsMode() === 'external';
  const week = useQuery(async () => {
    const start = startOfDay(addDaysKey(monday, -7), tz);
    const [payments, twoWeeks] = await Promise.all([
      external ? Promise.resolve([]) : fetchPayments(start),
      fetchBookings(start, startOfDay(addDaysKey(monday, 7), tz)),
    ]);
    const bookings = twoWeeks.filter((b) => dateKey(new Date(b.startsAt), tz) >= monday);
    return { payments, bookings, twoWeeks };
  }, [monday, tz, external], `today-week-${monday}-${external ? 'x' : 's'}`);
  const next = useQuery(() => fetchNextBookings(6), [], 'today-next');
  const rating = useQuery(fetchRating);

  // Cumulative earnings per day this week (Mon..Sun), and last week's total.
  const daily = Array<number>(7).fill(0);
  let lastWeek = 0;
  const entries = external
    ? (week.data?.twoWeeks ?? []).filter((b) => b.status === 'completed').map((b) => ({ at: b.startsAt, cents: b.subtotalCents }))
    : (week.data?.payments ?? []).filter((p) => p.status === 'succeeded').map((p) => ({ at: p.createdAt, cents: p.amountCents }));
  for (const e of entries) {
    const k = dateKey(new Date(e.at), tz);
    if (k >= monday) daily[weekdayIndex(k)] += e.cents;
    else lastWeek += e.cents;
  }
  const cumulative = daily.map((_, i) => daily.slice(0, i + 1).reduce((a, b) => a + b, 0));
  const todayIdx = weekdayIndex(todayKey);
  const earned = cumulative[todayIdx];
  const change = lastWeek > 0 ? Math.round(((earned - lastWeek) / lastWeek) * 100) : null;
  const jobs = week.data?.bookings ?? [];
  const avgTicket = jobs.length ? Math.round(jobs.reduce((n, b) => n + b.subtotalCents, 0) / jobs.length) : 0;
  const { whole, fraction } = moneyParts(earned);

  const upcoming = next.data ?? [];
  const [first, ...rest] = upcoming;
  const laterToday = rest.filter((b) => dateKey(new Date(b.startsAt), tz) === todayKey);

  const firstName = (session?.user.user_metadata?.full_name as string | undefined)?.split(' ')[0];
  const refreshing = week.loading || next.loading;

  return (
    <Screen
      eyebrow={new Date().toLocaleDateString('en-US', { timeZone: tz, weekday: 'long', day: 'numeric', month: 'short' })}
      title={`${greeting(tz)}${firstName ? `, ${firstName}` : ''}`}
      offline={week.stale || next.stale}
      refreshing={refreshing && !!week.data}
      onRefresh={() => {
        week.refresh();
        next.refresh();
        rating.refresh();
      }}
      right={
        <Pressable accessibilityRole="button" accessibilityLabel="Settings" onPress={() => router.push('/settings')} style={styles.round}>
          <Icon name="settings" size={20} />
        </Pressable>
      }>
      {/* Earnings */}
      <View style={styles.earnCard} onLayout={(e) => setChartWidth(e.nativeEvent.layout.width)}>
        <View style={[styles.rowBetween, styles.earnHead]}>
          <Text variant="caption" style={{ fontSize: 13 }}>
            Earned this week
          </Text>
          {change !== null && (
            <View style={[styles.trend, change < 0 && { backgroundColor: 'rgba(255,138,138,0.12)' }]}>
              <Icon name="trendUp" size={12} strokeWidth={2.6} color={change < 0 ? colors.danger : colors.success} />
              <Text variant="caption" style={{ fontSize: 12, color: change < 0 ? colors.danger : colors.success }}>
                {Math.abs(change)}%
              </Text>
            </View>
          )}
        </View>
        <Text style={styles.bigMoney} accessibilityLabel={`Earned this week ${money(earned)}`}>
          {whole}
          <Text style={styles.bigFraction}>{fraction}</Text>
        </Text>
        {chartWidth > 0 && <Sparkline values={cumulative} todayIndex={todayIdx} width={chartWidth} />}
        <View style={styles.days}>
          {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
            <Text key={i} variant="caption" style={[styles.dayLetter, i === todayIdx && { color: colors.bead }]}>
              {d}
            </Text>
          ))}
        </View>
      </View>

      <View style={styles.stats}>
        <Stat value={String(jobs.length)} label="Jobs this week" />
        <Stat value={money(avgTicket, { cents: false })} label="Avg ticket" />
        <Stat value={rating.data?.rating?.toFixed(1) ?? 'New'} label="Rating" gold onPress={() => router.push('/reviews')} />
      </View>

      {profile.data && <BookingLinkCard handle={profile.data.handle} businessName={profile.data.businessName} />}

      <View style={styles.rowBetween}>
        <Text variant="heading" style={{ fontSize: 18 }}>
          Next up
        </Text>
        <Pressable onPress={() => router.navigate('/calendar')} hitSlop={8}>
          <Text variant="body" tone="bead" style={{ fontSize: 14 }}>
            See all
          </Text>
        </Pressable>
      </View>

      {first ? (
        <NextUpCard booking={first} tz={tz} now={now} />
      ) : (
        <ListCard>
          <EmptyState
            title={next.loading ? 'Loading your schedule…' : 'No jobs booked yet'}
            body={next.loading ? '' : 'Share your booking link above. When clients book, their jobs show up here.'}
          />
        </ListCard>
      )}

      {laterToday.length > 0 && (
        <ListCard>
          {laterToday.map((b) => (
            <Pressable key={b.id} onPress={() => router.push(`/booking/${b.id}`)} style={styles.laterRow}>
              <View style={[styles.stripe, { backgroundColor: colors.success }]} />
              <View style={{ flex: 1, gap: 1 }}>
                <Text variant="bodyStrong" style={{ fontSize: 14 }}>
                  {b.serviceName} · {SIZE_LABEL[b.vehicleSize]}
                </Text>
                <Text variant="caption" style={{ fontSize: 12 }}>
                  {timeOf(b.startsAt, tz)} · {b.client.name}
                </Text>
              </View>
              <Badge label="Booked" tone="success" />
            </Pressable>
          ))}
        </ListCard>
      )}
    </Screen>
  );
}

function Stat({ value, label, gold, onPress }: { value: string; label: string; gold?: boolean; onPress?: () => void }) {
  return (
    <Pressable
      style={({ pressed }) => [styles.stat, pressed && onPress && { opacity: 0.75 }]}
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={onPress ? `${label} ${value}. Opens reviews` : undefined}
    >
      <Text variant="heading" tone={gold ? 'gold' : 'paint'}>
        {value}
      </Text>
      <Text variant="caption" style={{ fontSize: 12 }}>
        {label}
      </Text>
    </Pressable>
  );
}

function NextUpCard({ booking: b, tz, now }: { booking: Booking; tz: string; now: number }) {
  const startMs = Date.parse(b.startsAt);
  const inProgress = now >= startMs;
  const progress = inProgress ? Math.min(1, (now - startMs) / (b.durationMin * 60_000)) : 0;
  const addOn = b.addOns[0]?.name.split(' (')[0].toLowerCase();

  const openMaps = () => {
    haptic.tap();
    const q = encodeURIComponent(b.address);
    Linking.openURL(Platform.OS === 'ios' ? `maps://?daddr=${q}` : `geo:0,0?q=${q}`).catch(() =>
      Linking.openURL(`https://maps.google.com/?daddr=${q}`),
    );
  };

  return (
    <Pressable onPress={() => router.push(`/booking/${b.id}`)} style={styles.nextCard} accessibilityRole="button" accessibilityLabel={`Next job, ${b.serviceName} for ${b.client.name}`}>
      <View style={styles.nextHead}>
        <View style={styles.carIcon}>
          <Icon name="car" size={24} color={colors.bead} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="heading" style={{ fontSize: 17 }}>
            {b.serviceName} · {SIZE_LABEL[b.vehicleSize]}
          </Text>
          <Text variant="caption" style={{ fontSize: 13 }}>
            {b.client.name}
            {addOn ? ` · ${addOn} add-on` : ''}
          </Text>
        </View>
        <Text variant="heading" tone="gold" style={{ fontSize: 18 }}>
          {money(b.subtotalCents)}
        </Text>
      </View>
      <View style={styles.timeRow}>
        <Text variant="bodyStrong" style={{ fontSize: 13 }}>
          {dateKey(new Date(b.startsAt), tz) === dateKey(new Date(), tz) ? timeOf(b.startsAt, tz) : new Date(b.startsAt).toLocaleDateString('en-US', { timeZone: tz, weekday: 'short' }) + ' ' + timeOf(b.startsAt, tz)}
        </Text>
        <View style={styles.track}>
          <View style={[styles.trackFill, { width: `${Math.max(progress, inProgress ? 0.04 : 0) * 100}%` }]} />
        </View>
        <Text variant="caption" style={{ fontSize: 13, color: '#C9D0DC' }}>
          {inProgress ? 'In progress' : `${Math.round(b.durationMin / 60 * 10) / 10} h`}
        </Text>
      </View>
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <Pressable onPress={openMaps} style={styles.routeBtn} accessibilityRole="button" accessibilityLabel="Start route">
          <Icon name="route" size={18} color={colors.beadInk} strokeWidth={2.2} />
          <Text variant="bodyStrong" tone="beadInk" style={{ fontSize: 15 }}>
            Start route
          </Text>
        </Pressable>
        <Pressable
          onPress={() => Linking.openURL(`sms:${b.client.phone}`)}
          style={styles.squareBtn}
          accessibilityRole="button"
          accessibilityLabel={`Text ${b.client.name}`}>
          <Icon name="message" size={20} />
        </Pressable>
        <Pressable
          onPress={() => Linking.openURL(`tel:${b.client.phone}`)}
          style={styles.squareBtn}
          accessibilityRole="button"
          accessibilityLabel={`Call ${b.client.name}`}>
          <Icon name="phone" size={20} />
        </Pressable>
      </View>
    </Pressable>
  );
}

const panel = { backgroundColor: '#11151B', borderWidth: 1, borderColor: colors.line } as const;

const styles = StyleSheet.create({
  round: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.gunmetal, borderWidth: 1, borderColor: '#262B35', alignItems: 'center', justifyContent: 'center' },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  // Same inset as the amount below it, clear of the card's 32 pt corner radius.
  earnHead: { paddingHorizontal: 20, minHeight: 26 },
  earnCard: { ...panel, borderRadius: 32, paddingTop: 20, paddingBottom: 14, gap: 6, overflow: 'hidden' },
  trend: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: 'rgba(91,227,164,0.12)' },
  bigMoney: { fontFamily: 'Sora_800ExtraBold', fontSize: 52, letterSpacing: -2.5, lineHeight: 56, color: colors.paint, paddingHorizontal: 20 },
  bigFraction: { fontSize: 30, color: '#5B6371' },
  days: { flexDirection: 'row', paddingHorizontal: 20 },
  dayLetter: { flex: 1, textAlign: 'center', fontSize: 11, fontFamily: 'Inter_600SemiBold', color: '#5B6371' },
  stats: { flexDirection: 'row', gap: 8 },
  stat: { ...panel, flex: 1, borderRadius: 20, paddingVertical: 12, paddingHorizontal: 14, gap: 2 },
  nextCard: {
    borderRadius: 28,
    padding: 18,
    gap: 14,
    backgroundColor: '#0F1A20',
    borderWidth: 1,
    borderColor: 'rgba(77,216,255,0.35)',
    shadowColor: colors.bead,
    shadowOpacity: 0.12,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
  },
  nextHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  carIcon: { width: 48, height: 48, borderRadius: 16, backgroundColor: 'rgba(77,216,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  track: { flex: 1, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.08)', overflow: 'hidden' },
  trackFill: { height: 4, borderRadius: 2, backgroundColor: colors.bead },
  routeBtn: { flex: 1, height: 48, borderRadius: 16, backgroundColor: colors.bead, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  squareBtn: { width: 48, height: 48, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', backgroundColor: 'rgba(255,255,255,0.05)', alignItems: 'center', justifyContent: 'center' },
  laterRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  stripe: { width: 3, height: 34, borderRadius: 2 },
});
