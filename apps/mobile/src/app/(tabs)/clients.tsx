import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Icon } from '@/components/ui/Icon';
import { EmptyState, ListCard, Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { fetchClients, fetchProfile, useQuery, type ClientSummary } from '@/lib/data';
import { dayLabel, initials, timeOf, money } from '@/lib/format';
import { haptic } from '@/lib/haptics';
import { useNow } from '@/lib/time';
import { colors, fonts } from '@/theme/tokens';

type Filter = 'all' | 'regulars' | 'due';
const DUE_AFTER_DAYS = 60;
const AVATAR = [colors.bead, colors.gold, colors.success, '#C9D0DC'];

export default function Clients() {
  const clients = useQuery(fetchClients, [], 'clients');
  const profile = useQuery(fetchProfile);
  const tz = profile.data?.timezone ?? 'America/Chicago';
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const now = useNow();

  const isDue = (c: ClientSummary) =>
    !c.nextBooking && !!c.lastVisit && now - Date.parse(c.lastVisit) > DUE_AFTER_DAYS * 86_400_000;
  const needle = q.trim().toLowerCase();
  const digits = needle.replace(/\D/g, '');
  const list = (clients.data ?? [])
    .filter((c) => (filter === 'regulars' ? c.visits >= 3 : filter === 'due' ? isDue(c) : true))
    .filter((c) => !needle || c.name.toLowerCase().includes(needle) || (digits.length >= 3 && c.phone.includes(digits)))
    .sort((a, b) => b.spentCents - a.spentCents);

  const status = (c: ClientSummary): { text: string; color: string } => {
    if (c.nextBooking) return { text: `Booked ${dayLabel(c.nextBooking, tz) === 'Today' ? timeOf(c.nextBooking, tz) : dayLabel(c.nextBooking, tz)}`, color: colors.steel };
    if (isDue(c)) {
      const months = Math.floor((now - Date.parse(c.lastVisit!)) / (30 * 86_400_000));
      return { text: `Last visit ${months} mo ago`, color: colors.danger };
    }
    if (c.visits >= 3) return { text: 'Regular', color: colors.success };
    return { text: c.visits ? `${c.visits} visit${c.visits > 1 ? 's' : ''}` : 'New', color: colors.steel };
  };

  return (
    <Screen
      eyebrow={clients.data ? `${clients.data.length} client${clients.data.length === 1 ? '' : 's'}` : ' '}
      title="Clients"
      offline={clients.stale}
      refreshing={clients.loading && !!clients.data}
      onRefresh={clients.refresh}>
      <View style={styles.search}>
        <Icon name="search" size={20} color={colors.steel} />
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Search name or phone"
          placeholderTextColor="rgba(154,163,178,0.7)"
          accessibilityLabel="Search clients"
          selectionColor={colors.bead}
          autoCorrect={false}
          style={styles.searchInput}
        />
      </View>

      <View style={{ flexDirection: 'row', gap: 8 }}>
        {(
          [
            ['all', 'All'],
            ['regulars', 'Regulars'],
            ['due', 'Due for a detail'],
          ] as const
        ).map(([key, label]) => {
          const on = filter === key;
          return (
            <Pressable
              key={key}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              onPress={() => {
                haptic.select();
                setFilter(key);
              }}
              style={[styles.chip, on && styles.chipOn]}>
              <Text variant="caption" style={{ fontSize: 13, fontFamily: on ? fonts.bodyBold : fonts.bodySemi, color: on ? colors.beadInk : colors.paint }}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {list.length ? (
        <ListCard>
          {list.map((c, i) => {
            const s = status(c);
            const tint = AVATAR[i % AVATAR.length];
            return (
              <Pressable
                key={c.id}
                onPress={() => router.push(`/client/${c.id}`)}
                accessibilityRole="button"
                accessibilityLabel={`${c.name}, ${c.visits} visits, ${money(c.spentCents)} spent`}
                style={styles.row}>
                <View style={[styles.avatar, { backgroundColor: `${tint}1F` }]}>
                  <Text variant="bodyStrong" style={{ color: tint, fontFamily: fonts.display }}>
                    {initials(c.name)}
                  </Text>
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text variant="bodyStrong" style={{ fontSize: 15 }}>
                    {c.name}
                  </Text>
                  <Text variant="caption" style={{ fontSize: 13 }}>
                    {c.visits} visit{c.visits === 1 ? '' : 's'}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 2 }}>
                  <Text variant="bodyStrong" tone="gold" style={{ fontFamily: fonts.display, fontSize: 15 }}>
                    {money(c.spentCents, { cents: false })}
                  </Text>
                  <Text variant="caption" style={{ fontSize: 11, color: s.color }}>
                    {s.text}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </ListCard>
      ) : (
        <ListCard>
          <EmptyState
            title={clients.loading ? 'Loading clients…' : needle || filter !== 'all' ? 'No matches' : 'No clients yet'}
            body={clients.loading ? '' : needle || filter !== 'all' ? 'Try a different search or filter.' : 'Clients appear here after their first booking.'}
          />
        </ListCard>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  search: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 52, paddingHorizontal: 16, borderRadius: 18, backgroundColor: colors.gunmetal, borderWidth: 1, borderColor: '#262B35' },
  searchInput: { flex: 1, color: colors.paint, fontFamily: fonts.body, fontSize: 15 },
  chip: { height: 38, paddingHorizontal: 16, borderRadius: 19, borderWidth: 1, borderColor: '#262B35', backgroundColor: colors.gunmetal, justifyContent: 'center' },
  chipOn: { backgroundColor: colors.bead, borderColor: colors.bead },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 14 },
  avatar: { width: 46, height: 46, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
});
