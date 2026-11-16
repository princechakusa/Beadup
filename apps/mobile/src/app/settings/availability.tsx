import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { BackButton } from '@/components/nav/BackButton';
import { Icon } from '@/components/ui/Icon';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { fetchBufferMin, fetchDaysOff, fetchProfile, refreshBookingPage, saveBufferMin, setDayOff, useQuery } from '@/lib/data';
import { addDaysKey, dateKey, mondayOf } from '@/lib/format';
import { haptic } from '@/lib/haptics';
import { supabase } from '@/lib/supabase';
import { colors, fonts, space } from '@/theme/tokens';
import { dateLocale, t } from '@/lib/i18n';

// Weekly start times shown on the booking link (availability_slots).
const DAYS = [1, 2, 3, 4, 5, 6, 0]; // Monday first; 0 = Sunday in the database
// 2023-01-01 was a Sunday, so index 0 is Sunday (the database's weekday 0).
const dayName = (wd: number) => new Date(Date.UTC(2023, 0, 1 + wd)).toLocaleDateString(dateLocale(), { weekday: 'long', timeZone: 'UTC' });
const CHOICES = Array.from({ length: 29 }, (_, i) => {
  const m = 6 * 60 + i * 30; // 6:00 AM to 8:00 PM, every 30 minutes
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
});
const to12h = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
};

type Slot = { id: string; weekday: number; time: string };

// Travel time kept free between jobs (detailers.buffer_min).
const BUFFERS = [0, 15, 30, 45, 60, 90];
const bufferLabel = (m: number) => (m === 0 ? t('av_none') : m < 60 ? `${m} min` : `${m / 60} h`.replace('1.5 h', '1 h 30'));

async function fetchSlots(): Promise<Slot[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from('availability_slots').select('id, weekday, start_time').order('start_time');
  if (error) throw error;
  return data.map((r) => ({ id: r.id, weekday: r.weekday, time: String(r.start_time).slice(0, 5) }));
}

export default function Availability() {
  const slots = useQuery(fetchSlots);
  const [open, setOpen] = useState<number | null>(null);

  const add = async (weekday: number, time: string) => {
    if (!supabase) return;
    haptic.select();
    const { data: user } = await supabase.auth.getUser();
    await supabase.from('availability_slots').insert({ detailer_id: user.user?.id, weekday, start_time: time });
    slots.refresh();
    refreshBookingPage();
  };
  const remove = async (id: string) => {
    if (!supabase) return;
    haptic.select();
    await supabase.from('availability_slots').delete().eq('id', id);
    slots.refresh();
    refreshBookingPage();
  };

  return (
    <Screen title={t('av_title')} tabs={false} right={<BackButton variant="back" />}>
      <TravelTime />
      <Text variant="caption">{t('av_intro')}</Text>
      {DAYS.map((wd) => {
        const daySlots = (slots.data ?? []).filter((s) => s.weekday === wd);
        const taken = new Set(daySlots.map((s) => s.time));
        return (
          <View key={wd} style={styles.day}>
            <View style={styles.dayHead}>
              <Text variant="bodyStrong">{dayName(wd)}</Text>
              <Text variant="caption">{daySlots.length ? t(daySlots.length > 1 ? 'av_starts' : 'av_start', { n: daySlots.length }) : t('av_day_off')}</Text>
            </View>
            <View style={styles.wrap}>
              {daySlots.map((s) => (
                <Pressable key={s.id} onPress={() => remove(s.id)} accessibilityRole="button" accessibilityLabel={t('av_remove', { time: to12h(s.time), day: dayName(wd) })} style={styles.slot}>
                  <Text variant="caption" style={{ color: colors.beadInk, fontFamily: fonts.bodySemi }}>
                    {to12h(s.time)}
                  </Text>
                  <Icon name="close" size={12} color={colors.beadInk} strokeWidth={2.4} />
                </Pressable>
              ))}
              <Pressable
                onPress={() => setOpen(open === wd ? null : wd)}
                accessibilityRole="button"
                accessibilityLabel={t('av_add_a11y', { day: dayName(wd) })}
                style={styles.addSlot}>
                <Icon name="plus" size={14} color={colors.bead} strokeWidth={2.4} />
              </Pressable>
            </View>
            {open === wd && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingTop: 10 }}>
                {CHOICES.filter((c) => !taken.has(c)).map((c) => (
                  <Pressable key={c} onPress={() => add(wd, c)} style={styles.choice} accessibilityRole="button" accessibilityLabel={t('av_add', { time: to12h(c) })}>
                    <Text variant="caption" style={{ color: colors.paint }}>
                      {to12h(c)}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            )}
          </View>
        );
      })}
      <DaysOff />
    </Screen>
  );
}

/** Minutes kept free before and after every job, so there's time to drive to the next one. */
function TravelTime() {
  const buffer = useQuery(fetchBufferMin, [], 'buffer-min');
  const [picked, setPicked] = useState<number | null>(null);
  const [error, setError] = useState(false);
  const value = picked ?? buffer.data ?? 0;
  const pick = async (m: number) => {
    haptic.select();
    const before = value;
    setPicked(m);
    setError(false);
    try {
      await saveBufferMin(m);
    } catch {
      haptic.error();
      setPicked(before);
      setError(true);
    }
  };
  return (
    <View style={styles.day}>
      <View style={styles.dayHead}>
        <Text variant="bodyStrong">{t('av_travel')}</Text>
        <Text variant="caption">{bufferLabel(value)}</Text>
      </View>
      <View style={styles.wrap} accessibilityRole="radiogroup">
        {BUFFERS.map((m) => {
          const on = m === value;
          return (
            <Pressable
              key={m}
              onPress={() => pick(m)}
              style={on ? styles.slot : styles.choice}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              accessibilityLabel={t('av_travel_a11y', { value: bufferLabel(m) })}>
              <Text variant="caption" style={{ color: on ? colors.beadInk : colors.paint, fontFamily: on ? fonts.bodySemi : undefined }}>
                {bufferLabel(m)}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Text variant="caption" style={{ marginTop: space.sm, fontSize: 13, lineHeight: 19 }}>
        {error ? t('av_save_fail') : t('av_buffer_d')}
      </Text>
    </View>
  );
}

/** Whole days you aren't working. Clients can't book them; your weekly times stay as they are. */
function DaysOff() {
  const profile = useQuery(fetchProfile, [], 'profile');
  const tz = profile.data?.timezone ?? 'America/Chicago';
  const todayKey = dateKey(new Date(), tz);
  const daysOff = useQuery(() => fetchDaysOff(todayKey), [todayKey], 'days-off');
  const [pending, setPending] = useState<Record<string, boolean>>({});
  const [error, setError] = useState(false);
  const off = new Set(daysOff.data ?? []);
  const isOff = (k: string) => pending[k] ?? off.has(k);

  const toggle = async (k: string) => {
    const next = !isOff(k);
    haptic.select();
    setError(false);
    setPending((p) => ({ ...p, [k]: next }));
    try {
      await setDayOff(k, next);
      await daysOff.refresh();
    } catch {
      haptic.error();
      setError(true);
    } finally {
      setPending((p) => {
        const { [k]: _done, ...rest } = p;
        return rest;
      });
    }
  };

  const start = mondayOf(todayKey);
  const weeks = Array.from({ length: 6 }, (_, w) => Array.from({ length: 7 }, (_, d) => addDaysKey(start, w * 7 + d)));
  const monthOf = (k: string) => new Date(`${k}T12:00:00Z`).toLocaleDateString(dateLocale(), { month: 'short', timeZone: 'UTC' });
  const count = [...off].length;

  return (
    <View style={styles.day}>
      <View style={styles.dayHead}>
        <Text variant="bodyStrong">{t('av_days_off')}</Text>
        <Text variant="caption">{count ? t('av_coming', { n: count }) : t('av_none')}</Text>
      </View>
      <View style={styles.weekRow}>
        {t('week_letters').split(',').map((l, i) => (
          <Text key={i} variant="caption" style={styles.weekLetter}>
            {l}
          </Text>
        ))}
      </View>
      {weeks.map((week) => (
        <View key={week[0]} style={styles.weekRow}>
          {week.map((k) => {
            const past = k < todayKey;
            const on = !past && isOff(k);
            const dayNum = Number(k.slice(8));
            return (
              <Pressable
                key={k}
                disabled={past}
                onPress={() => toggle(k)}
                style={[styles.cell, on && styles.cellOff, past && { opacity: 0.25 }]}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on, disabled: past }}
                accessibilityLabel={`${monthOf(k)} ${dayNum}${on ? t('av_off_a11y') : ''}`}>
                <Text variant="caption" style={{ color: on ? colors.danger : k === todayKey ? colors.bead : colors.paint, fontFamily: on ? fonts.bodySemi : undefined }}>
                  {dayNum === 1 ? monthOf(k) : dayNum}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ))}
      <Text variant="caption" style={{ marginTop: space.sm, fontSize: 13, lineHeight: 19 }}>
        {error ? t('av_save_fail') : t('av_off_d')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  day: { padding: 16, borderRadius: 22, backgroundColor: '#11151B', borderWidth: 1, borderColor: colors.line },
  dayHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  slot: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 34, paddingHorizontal: 12, borderRadius: 17, backgroundColor: colors.bead },
  addSlot: { width: 34, height: 34, borderRadius: 17, borderWidth: 1, borderColor: 'rgba(77,216,255,0.5)', alignItems: 'center', justifyContent: 'center' },
  weekRow: { flexDirection: 'row', gap: 4, marginBottom: 4 },
  weekLetter: { flex: 1, textAlign: 'center', fontSize: 11 },
  cell: { flex: 1, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.gunmetal },
  cellOff: { backgroundColor: 'rgba(255,138,138,0.16)', borderWidth: 1, borderColor: colors.danger },
  choice: { height: 34, paddingHorizontal: 12, borderRadius: 17, backgroundColor: colors.gunmetal, borderWidth: 1, borderColor: '#262B35', justifyContent: 'center' },
});
