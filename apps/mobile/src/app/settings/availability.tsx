import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { BackButton } from '@/components/nav/BackButton';
import { Icon } from '@/components/ui/Icon';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { refreshBookingPage, useQuery } from '@/lib/data';
import { haptic } from '@/lib/haptics';
import { supabase } from '@/lib/supabase';
import { colors, fonts } from '@/theme/tokens';

// Weekly start times shown on the booking link (availability_slots).
const DAYS = [1, 2, 3, 4, 5, 6, 0]; // Monday first; 0 = Sunday in the database
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const CHOICES = Array.from({ length: 29 }, (_, i) => {
  const m = 6 * 60 + i * 30; // 6:00 AM to 8:00 PM, every 30 minutes
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
});
const to12h = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
};

type Slot = { id: string; weekday: number; time: string };

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
    <Screen title="Availability" tabs={false} right={<BackButton variant="back" />}>
      <Text variant="caption">Start times clients can pick each week, in your business timezone. Booked times are hidden automatically.</Text>
      {DAYS.map((wd) => {
        const daySlots = (slots.data ?? []).filter((s) => s.weekday === wd);
        const taken = new Set(daySlots.map((s) => s.time));
        return (
          <View key={wd} style={styles.day}>
            <View style={styles.dayHead}>
              <Text variant="bodyStrong">{DAY_NAMES[wd]}</Text>
              <Text variant="caption">{daySlots.length ? `${daySlots.length} start time${daySlots.length > 1 ? 's' : ''}` : 'Day off'}</Text>
            </View>
            <View style={styles.wrap}>
              {daySlots.map((s) => (
                <Pressable key={s.id} onPress={() => remove(s.id)} accessibilityRole="button" accessibilityLabel={`Remove ${to12h(s.time)} on ${DAY_NAMES[wd]}`} style={styles.slot}>
                  <Text variant="caption" style={{ color: colors.beadInk, fontFamily: fonts.bodySemi }}>
                    {to12h(s.time)}
                  </Text>
                  <Icon name="close" size={12} color={colors.beadInk} strokeWidth={2.4} />
                </Pressable>
              ))}
              <Pressable
                onPress={() => setOpen(open === wd ? null : wd)}
                accessibilityRole="button"
                accessibilityLabel={`Add a start time on ${DAY_NAMES[wd]}`}
                style={styles.addSlot}>
                <Icon name="plus" size={14} color={colors.bead} strokeWidth={2.4} />
              </Pressable>
            </View>
            {open === wd && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingTop: 10 }}>
                {CHOICES.filter((t) => !taken.has(t)).map((t) => (
                  <Pressable key={t} onPress={() => add(wd, t)} style={styles.choice} accessibilityRole="button" accessibilityLabel={`Add ${to12h(t)}`}>
                    <Text variant="caption" style={{ color: colors.paint }}>
                      {to12h(t)}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            )}
          </View>
        );
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  day: { padding: 16, borderRadius: 22, backgroundColor: '#11151B', borderWidth: 1, borderColor: colors.line },
  dayHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  slot: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 34, paddingHorizontal: 12, borderRadius: 17, backgroundColor: colors.bead },
  addSlot: { width: 34, height: 34, borderRadius: 17, borderWidth: 1, borderColor: 'rgba(77,216,255,0.5)', alignItems: 'center', justifyContent: 'center' },
  choice: { height: 34, paddingHorizontal: 12, borderRadius: 17, backgroundColor: colors.gunmetal, borderWidth: 1, borderColor: '#262B35', justifyContent: 'center' },
});
