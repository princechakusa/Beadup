import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Linking, Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';

import { BackButton } from '@/components/nav/BackButton';
import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { fetchBooking, fetchBookings, fetchBufferMin, fetchProfile, rescheduleBooking, useQuery, type RescheduleError } from '@/lib/data';
import { addDaysKey, dateKey, dayLabel, localTime, startOfDay, timeOf } from '@/lib/format';
import { haptic } from '@/lib/haptics';
import { useNow } from '@/lib/time';
import { colors, fonts, space } from '@/theme/tokens';

// Any half hour from 6:00 AM to 9:00 PM: the detailer can move a job outside
// their public start times (the server still refuses overlaps and the past).
const TIMES = Array.from({ length: 31 }, (_, i) => {
  const m = 6 * 60 + i * 30;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
});
const to12h = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
};
const ERRORS: Record<RescheduleError, string> = {
  overlap: 'That time overlaps another job or its travel time. Pick another.',
  time: 'That time has passed. Pick a later one.',
  status: 'Only upcoming bookings can be moved.',
  not_found: 'This booking could not be found.',
};

/** Move a booking to another day or time, then tell the client. */
export default function Reschedule() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const booking = useQuery(() => fetchBooking(id), [id]);
  const profile = useQuery(fetchProfile, [], 'profile');
  const buffer = useQuery(fetchBufferMin, [], 'buffer-min');
  const now = useNow();
  const tz = profile.data?.timezone ?? 'America/Chicago';
  const todayKey = dateKey(new Date(now), tz);
  const b = booking.data;

  const [day, setDay] = useState<string | null>(null);
  const dayKey = day ?? (b ? dateKey(new Date(b.startsAt), tz) : todayKey);
  const [time, setTime] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [moved, setMoved] = useState<Date | null>(null);

  const dayJobs = useQuery(
    () => fetchBookings(startOfDay(dayKey, tz), startOfDay(addDaysKey(dayKey, 1), tz)),
    [dayKey, tz],
  );

  if (!b) {
    return (
      <Screen title={booking.loading ? 'Loading…' : 'Booking not found'} tabs={false} right={<BackButton variant="back" />}>
        <View />
      </Screen>
    );
  }

  const first = b.client.name.split(' ')[0] || 'there';
  const gap = buffer.data ?? 0;
  const others = (dayJobs.data ?? []).filter((x) => x.id !== b.id && x.status === 'confirmed');
  const blocked = (t: string) => {
    const start = localTime(dayKey, t, tz).getTime();
    if (start < now) return true;
    const end = start + b.durationMin * 60_000;
    return others.some((o) => {
      const s = Date.parse(o.startsAt);
      const e = s + o.durationMin * 60_000;
      return start < e + gap * 60_000 && s < end + gap * 60_000;
    });
  };
  const days = Array.from({ length: 28 }, (_, i) => addDaysKey(todayKey, i));
  const chosen = time ? localTime(dayKey, time, tz) : null;

  const save = async () => {
    if (!chosen) return;
    setBusy(true);
    setError(null);
    try {
      const r = await rescheduleBooking(b.id, chosen);
      if (r.ok) {
        haptic.success();
        setMoved(chosen);
      } else {
        haptic.error();
        setError(ERRORS[r.error]);
        dayJobs.refresh();
      }
    } catch {
      haptic.error();
      setError('That didn’t go through. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  };

  if (moved) {
    const when = `${dayLabel(moved.toISOString(), tz)} at ${timeOf(moved.toISOString(), tz)}`;
    const longDate = moved.toLocaleDateString('en-US', { timeZone: tz, weekday: 'long', month: 'short', day: 'numeric' });
    const message = `Hi ${first}, your ${b.serviceName} is now ${longDate} at ${timeOf(moved.toISOString(), tz)}. Reply if that doesn't work for you. ${profile.data?.businessName ?? ''}`.trim();
    const tell = async () => {
      haptic.select();
      const sms = `sms:${b.client.phone}&body=${encodeURIComponent(message)}`;
      try {
        if (b.client.phone && (await Linking.canOpenURL(sms))) return await Linking.openURL(sms);
      } catch {
        // fall through to the share sheet
      }
      await Share.share({ message }).catch(() => undefined);
    };
    return (
      <Screen eyebrow="Moved" title={when} tabs={false} right={<BackButton variant="back" />}>
        <Text variant="body">
          {first} isn’t told automatically. Send them the new time from your Messages app.
        </Text>
        <Button label={`Text ${first} the new time`} onPress={tell} />
        <Button label="Done" variant="ghost" onPress={() => router.back()} />
      </Screen>
    );
  }

  return (
    <Screen eyebrow={`Now ${dayLabel(b.startsAt, tz)} · ${timeOf(b.startsAt, tz)}`} title="Reschedule" tabs={false} right={<BackButton variant="back" />}>
      <Text variant="caption">
        {b.serviceName} with {b.client.name}, {Math.round((b.durationMin / 60) * 10) / 10} h. Times that clash with another job
        {gap ? ` or your ${gap} min travel time` : ''} are greyed out.
      </Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {days.map((k) => {
          const on = k === dayKey;
          const d = new Date(`${k}T12:00:00Z`);
          return (
            <Pressable
              key={k}
              onPress={() => {
                haptic.select();
                setDay(k);
                setTime(null);
                setError(null);
              }}
              style={[styles.day, on && styles.dayOn]}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              accessibilityLabel={d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' })}>
              <Text variant="caption" style={{ fontSize: 11, color: on ? colors.beadInk : colors.steel }}>
                {d.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' })}
              </Text>
              <Text variant="bodyStrong" style={{ color: on ? colors.beadInk : colors.paint }}>
                {d.getUTCDate()}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.grid}>
        {TIMES.map((t) => {
          const off = dayJobs.loading || blocked(t);
          const on = t === time;
          return (
            <Pressable
              key={t}
              disabled={off}
              onPress={() => {
                haptic.select();
                setTime(t);
                setError(null);
              }}
              style={[styles.time, on && styles.timeOn, off && { opacity: 0.3 }]}
              accessibilityRole="button"
              accessibilityState={{ selected: on, disabled: off }}
              accessibilityLabel={`${to12h(t)}${off ? ', not available' : ''}`}>
              <Text variant="caption" style={{ color: on ? colors.beadInk : colors.paint, fontFamily: on ? fonts.bodySemi : undefined }}>
                {to12h(t)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {error && (
        <Text variant="caption" tone="danger" accessibilityLiveRegion="polite">
          {error}
        </Text>
      )}
      <View style={{ gap: space.md }}>
        <Button
          label={chosen ? `Move to ${dayLabel(chosen.toISOString(), tz)} · ${timeOf(chosen.toISOString(), tz)}` : 'Pick a new time'}
          onPress={save}
          loading={busy}
          disabled={!chosen}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  day: { width: 52, height: 64, borderRadius: 18, alignItems: 'center', justifyContent: 'center', gap: 2, backgroundColor: colors.gunmetal, borderWidth: 1, borderColor: '#262B35' },
  dayOn: { backgroundColor: colors.bead, borderColor: colors.bead },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  time: { width: '31%', height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.gunmetal, borderWidth: 1, borderColor: '#262B35' },
  timeOn: { backgroundColor: colors.bead, borderColor: colors.bead },
});
