import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated';

import { Badge, Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { fetchBookings, fetchProfile, useQuery, type Booking } from '@/lib/data';
import { addDaysKey, dateKey, initials, minutesOfDay, mondayOf, startOfDay, timeOf, usd } from '@/lib/format';
import { haptic } from '@/lib/haptics';
import { colors } from '@/theme/tokens';

const FIRST_HOUR = 7;
const LAST_HOUR = 20;
const HOUR_H = 62;
const SIZE_LABEL = { sedan: 'Sedan', suv: 'SUV', truck: 'Truck' } as const;

export default function Calendar() {
  const profile = useQuery(fetchProfile, [], 'profile');
  const tz = profile.data?.timezone ?? 'America/Chicago';
  const todayKey = dateKey(new Date(), tz);
  const [weekStart, setWeekStart] = useState(() => mondayOf(todayKey));
  const [selected, setSelected] = useState(todayKey);

  const week = useQuery(
    () => fetchBookings(startOfDay(weekStart, tz), startOfDay(addDaysKey(weekStart, 7), tz)),
    [weekStart, tz],
    `calendar-${weekStart}`,
  );
  const days = Array.from({ length: 7 }, (_, i) => addDaysKey(weekStart, i));
  const dayJobs = (week.data ?? []).filter((b) => dateKey(new Date(b.startsAt), tz) === selected);
  const count = (key: string) => (week.data ?? []).filter((b) => dateKey(new Date(b.startsAt), tz) === key).length;

  const nowMin = minutesOfDay(new Date().toISOString(), tz);
  const showNow = selected === todayKey && nowMin >= FIRST_HOUR * 60 && nowMin <= LAST_HOUR * 60;
  const month = new Date(`${selected}T12:00:00Z`).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });

  const shiftWeek = (n: number) => {
    haptic.select();
    const next = addDaysKey(weekStart, n * 7);
    setWeekStart(next);
    setSelected(n === 0 ? todayKey : next);
  };

  return (
    <Screen
      eyebrow={month}
      title="Calendar"
      offline={week.stale}
      refreshing={week.loading && !!week.data}
      onRefresh={week.refresh}
      right={
        <View style={{ flexDirection: 'row', gap: 6 }}>
          <WeekButton label="Previous week" text="‹" onPress={() => shiftWeek(-1)} />
          <WeekButton label="This week" text="Today" onPress={() => { setWeekStart(mondayOf(todayKey)); setSelected(todayKey); haptic.select(); }} />
          <WeekButton label="Next week" text="›" onPress={() => shiftWeek(1)} />
        </View>
      }>
      <View style={styles.strip}>
        {days.map((key) => {
          const active = key === selected;
          const d = new Date(`${key}T12:00:00Z`);
          const isSunday = d.getUTCDay() === 0;
          const n = count(key);
          return (
            <Pressable
              key={key}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`${d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' })}, ${n} jobs`}
              onPress={() => {
                haptic.select();
                setSelected(key);
              }}
              style={[styles.day, active ? styles.dayActive : isSunday && styles.dayQuiet]}>
              <Text variant="caption" style={{ fontSize: 11, color: active ? colors.beadInk : colors.steel }}>
                {d.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' })}
              </Text>
              <Text variant="heading" style={{ fontSize: 17, color: active ? colors.beadInk : colors.paint }}>
                {d.getUTCDate()}
              </Text>
              <View style={[styles.dot, { opacity: n ? 1 : 0, backgroundColor: active ? colors.beadInk : colors.bead }]} />
            </Pressable>
          );
        })}
      </View>

      <View style={styles.timeline}>
        {Array.from({ length: LAST_HOUR - FIRST_HOUR + 1 }, (_, i) => FIRST_HOUR + i).map((h) => (
          <View key={h} style={styles.hourRow}>
            <Text variant="caption" style={styles.hourLabel}>
              {h === 12 ? '12 PM' : h > 12 ? `${h - 12} PM` : `${h} AM`}
            </Text>
            <View style={styles.hourLine} />
          </View>
        ))}

        {dayJobs.map((b) => (
          <JobBlock key={b.id} booking={b} tz={tz} />
        ))}

        {showNow && (
          <View pointerEvents="none" style={[styles.nowWrap, { top: 8 + ((nowMin - FIRST_HOUR * 60) / 60) * HOUR_H }]}>
            <View style={styles.nowDot} />
            <View style={styles.nowLine} />
          </View>
        )}

        {!week.loading && dayJobs.length === 0 && (
          <View pointerEvents="none" style={styles.free}>
            <Text variant="caption">Nothing booked this day</Text>
          </View>
        )}
      </View>
    </Screen>
  );
}

function WeekButton({ label, text, onPress }: { label: string; text: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={styles.weekBtn}>
      <Text variant="bodyStrong" style={{ fontSize: text.length > 1 ? 13 : 18 }}>
        {text}
      </Text>
    </Pressable>
  );
}

const STATUS = {
  confirmed: { label: 'Deposit paid', tone: 'success' as const, color: colors.bead, tint: 'rgba(77,216,255,' },
  completed: { label: 'Paid in full', tone: 'success' as const, color: colors.success, tint: 'rgba(91,227,164,' },
  no_show: { label: 'No-show', tone: 'danger' as const, color: colors.danger, tint: 'rgba(255,138,138,' },
};

function JobBlock({ booking: b, tz }: { booking: Booking; tz: string }) {
  const start = minutesOfDay(b.startsAt, tz);
  const top = 8 + ((start - FIRST_HOUR * 60) / 60) * HOUR_H;
  const height = Math.max(56, (b.durationMin / 60) * HOUR_H - 6);
  const s = STATUS[b.status as keyof typeof STATUS] ?? STATUS.confirmed;
  const end = new Date(Date.parse(b.startsAt) + b.durationMin * 60_000).toISOString();
  const compact = height < 120;

  return (
    <Animated.View entering={FadeIn.duration(250)} layout={LinearTransition} style={[styles.block, { top, height, borderColor: `${s.tint}0.4)` }]}>
      <Pressable
        onPress={() => router.push(`/booking/${b.id}`)}
        accessibilityRole="button"
        accessibilityLabel={`${b.serviceName} for ${b.client.name} at ${timeOf(b.startsAt, tz)}`}
        style={{ flex: 1 }}>
        <LinearGradient
          colors={[`${s.tint}0.18)`, `${s.tint}0.05)`, 'rgba(17,21,27,0.9)']}
          locations={[0, 0.55, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={[styles.blockStripe, { backgroundColor: s.color, shadowColor: s.color }]} />
        <View style={[styles.blockBody, compact && { justifyContent: 'center', gap: 2 }]}>
          <View style={styles.rowBetween}>
            <Text variant="caption" style={{ fontSize: 12, color: '#DCEFF7' }}>
              {timeOf(b.startsAt, tz)} – {timeOf(end, tz)}
            </Text>
            {!compact && <Badge label={s.label} tone={s.tone} />}
          </View>
          <Text variant="heading" numberOfLines={1} style={{ fontSize: compact ? 15 : 20 }}>
            {b.serviceName}
            {compact ? ` · ${b.client.name}` : ''}
          </Text>
          {!compact && (
            <>
              <Text variant="caption" style={{ fontSize: 13, color: '#C9D0DC' }} numberOfLines={1}>
                {SIZE_LABEL[b.vehicleSize]}
                {b.addOns.length ? ` · ${b.addOns.map((a) => a.name.split(' (')[0].toLowerCase()).join(', ')}` : ''}
              </Text>
              <View style={[styles.rowBetween, { marginTop: 'auto' }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                  <View style={styles.avatar}>
                    <Text variant="caption" style={{ fontSize: 11, color: colors.paint, fontFamily: 'Inter_700Bold' }}>
                      {initials(b.client.name)}
                    </Text>
                  </View>
                  <Text variant="body" style={{ fontSize: 13 }} numberOfLines={1}>
                    {b.client.name}
                  </Text>
                </View>
                <Text variant="heading" tone="gold" style={{ fontSize: 18 }}>
                  {usd(b.subtotalCents)}
                </Text>
              </View>
            </>
          )}
        </View>
      </Pressable>
    </Animated.View>
  );
}

const panel = { backgroundColor: '#11151B', borderWidth: 1, borderColor: colors.line } as const;

const styles = StyleSheet.create({
  weekBtn: { minWidth: 40, height: 40, paddingHorizontal: 10, borderRadius: 20, backgroundColor: colors.gunmetal, borderWidth: 1, borderColor: '#262B35', alignItems: 'center', justifyContent: 'center' },
  strip: { flexDirection: 'row', gap: 6 },
  day: { ...panel, flex: 1, height: 72, borderRadius: 18, alignItems: 'center', justifyContent: 'center', gap: 2 },
  dayActive: { backgroundColor: colors.bead, borderColor: colors.bead, shadowColor: colors.bead, shadowOpacity: 0.35, shadowRadius: 12, shadowOffset: { width: 0, height: 6 } },
  dayQuiet: { backgroundColor: '#0F1217', borderColor: 'rgba(255,255,255,0.05)' },
  dot: { width: 5, height: 5, borderRadius: 3, marginTop: 2 },
  timeline: { ...panel, borderRadius: 28, paddingVertical: 8, paddingHorizontal: 16, position: 'relative', overflow: 'hidden' },
  hourRow: { flexDirection: 'row', gap: 12, height: HOUR_H },
  hourLabel: { width: 44, paddingTop: 6, fontSize: 12, color: '#5B6371' },
  hourLine: { flex: 1, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' },
  block: { position: 'absolute', left: 68, right: 12, borderRadius: 24, borderWidth: 1, overflow: 'hidden' },
  blockStripe: { position: 'absolute', left: 0, top: 14, bottom: 14, width: 4, borderTopRightRadius: 4, borderBottomRightRadius: 4, shadowOpacity: 0.9, shadowRadius: 8 },
  blockBody: { flex: 1, paddingVertical: 12, paddingLeft: 20, paddingRight: 16, gap: 4 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  avatar: { width: 30, height: 30, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  nowWrap: { position: 'absolute', left: 62, right: 16, flexDirection: 'row', alignItems: 'center' },
  nowDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#FF6B6B', shadowColor: '#FF6B6B', shadowOpacity: 0.9, shadowRadius: 6 },
  nowLine: { flex: 1, height: 2, backgroundColor: '#FF6B6B' },
  free: { position: 'absolute', left: 68, right: 12, top: 8 + 2 * HOUR_H, alignItems: 'center' },
});
