import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { BackButton } from '@/components/nav/BackButton';
import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { detailerBook, fetchBookings, fetchCatalog, fetchClientBookings, fetchClients, fetchProfile, fetchStaff, useQuery } from '@/lib/data';
import { addDaysKey, dateKey, dayLabel, localTime, money, startOfDay, timeOf } from '@/lib/format';
import { haptic } from '@/lib/haptics';
import { currentTrade } from '@/lib/trades';
import { useNow } from '@/lib/time';
import { colors, space } from '@/theme/tokens';
import { phrase } from '@/lib/i18n/phrases';
import { dateLocale, t } from '@/lib/i18n';

const TIMES = Array.from({ length: 31 }, (_, i) => {
  const m = 6 * 60 + i * 30;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
});
const REPEAT = [
  { weeks: 0, label: 'ba_once' as const },
  { weeks: 1, label: 'ba_w1' as const },
  { weeks: 2, label: 'ba_w2' as const },
  { weeks: 4, label: 'ba_w4' as const },
] as const;
const COUNTS = [4, 8, 12];
type Size = 'sedan' | 'suv' | 'truck';

/** The business books a regular client in: once or on a repeat. Clashes are skipped by the server and reported. */
export default function BookAgain() {
  const { clientId } = useLocalSearchParams<{ clientId: string }>();
  const now = useNow();
  const profile = useQuery(fetchProfile, [], 'profile');
  const tz = profile.data?.timezone ?? 'America/Chicago';
  const clients = useQuery(fetchClients, [], 'clients');
  const history = useQuery(() => fetchClientBookings(clientId), [clientId]);
  const catalog = useQuery(fetchCatalog);
  const client = clients.data?.find((c) => c.id === clientId);
  const last = history.data?.[0];
  const trade = currentTrade();
  const tiers = trade.pricing === 'tiers';
  const services = (catalog.data?.services ?? []).filter((s) => s.active);

  const team = useQuery(fetchStaff, [], 'staff');
  const people = (team.data ?? []).filter((m) => m.active);
  const [staffId, setStaffId] = useState<string | null>(null);
  const [serviceId, setServiceId] = useState<string | null>(null);
  const [size, setSize] = useState<Size | null>(null);
  const todayKey = dateKey(new Date(now), tz);
  const [day, setDay] = useState(addDaysKey(todayKey, 7));
  const [time, setTime] = useState<string | null>(null);
  const [weeks, setWeeks] = useState<0 | 1 | 2 | 4>(0);
  const [count, setCount] = useState(4);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  // Defaults from the client's last visit: same service and size.
  const defaultId = services.find((x) => x.name === last?.serviceName)?.id ?? services[0]?.id;
  const svc = services.find((s) => s.id === (serviceId ?? defaultId));
  const tier: Size = tiers ? (size ?? last?.vehicleSize ?? 'sedan') : 'sedan';
  const dayJobs = useQuery(() => fetchBookings(startOfDay(day, tz), startOfDay(addDaysKey(day, 1), tz)), [day, tz]);
  const blocked = (t: string) => {
    const start = localTime(day, t, tz).getTime();
    if (start < now || !svc) return true;
    const end = start + svc.durationMin * 60_000;
    const chosenName = people.find((m) => m.id === staffId)?.name ?? null;
    return (dayJobs.data ?? []).some(
      (o) =>
        o.status === 'confirmed' &&
        (!chosenName || !o.staffName || o.staffName === chosenName) &&
        start < Date.parse(o.startsAt) + o.durationMin * 60_000 &&
        Date.parse(o.startsAt) < end,
    );
  };
  const chosen = time ? localTime(day, time, tz) : null;

  const save = async () => {
    if (!svc || !chosen || !client) return;
    setBusy(true);
    try {
      const r = await detailerBook({
        clientId: client.id,
        serviceId: svc.id,
        size: tier,
        startsAt: chosen,
        address: last?.address ?? '',
        everyWeeks: weeks,
        count: weeks ? count : 1,
        staffId,
      });
      if (!r.ok) {
        haptic.error();
        setResult(t('ba_fail'));
        return;
      }
      haptic.success();
      const skipped = r.skipped.length ? t('ba_skipped', { n: r.skipped.length }) : '';
      setResult(`${t(r.made === 1 ? 'ba_made' : 'ba_made_many', { n: r.made })}${skipped}`);
    } catch {
      haptic.error();
      setResult(t('bd_fail'));
    } finally {
      setBusy(false);
    }
  };

  if (result) {
    return (
      <Screen title={t('ba_title')} tabs={false} right={<BackButton variant="back" />}>
        <Text variant="body">{result}</Text>
        <Text variant="caption">{t('ba_send', { name: client?.name.split(' ')[0] ?? t('ba_them') })}</Text>
        <Button label={t('done')} onPress={() => router.back()} />
      </Screen>
    );
  }

  return (
    <Screen eyebrow={client?.name ?? ' '} title={t('ba_title')} tabs={false} right={<BackButton variant="back" />}>
      <Text variant="eyebrow">{t('ba_service')}</Text>
      <View style={styles.wrap}>
        {services.map((s) => {
          const on = s.id === svc?.id;
          return (
            <Chip key={s.id} on={on} onPress={() => setServiceId(s.id)} label={`${s.name} · ${money(s.priceCents[tier])}`} />
          );
        })}
      </View>
      {tiers && (
        <>
          <Text variant="eyebrow">{phrase(trade.tierTitle)}</Text>
          <View style={styles.wrap}>
            {(['sedan', 'suv', 'truck'] as const).map((k) => (
              <Chip key={k} on={k === tier} onPress={() => setSize(k)} label={phrase(trade.tiers[k])} />
            ))}
          </View>
        </>
      )}

      {people.length > 0 && (
        <>
          <Text variant="eyebrow">{t('ba_with')}</Text>
          <View style={styles.wrap}>
            {people.map((m) => (
              <Chip key={m.id} on={m.id === staffId} onPress={() => setStaffId(m.id === staffId ? null : m.id)} label={m.name} />
            ))}
          </View>
        </>
      )}

      <Text variant="eyebrow">{t('ba_first')}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {Array.from({ length: 42 }, (_, i) => addDaysKey(todayKey, i)).map((k) => {
          const on = k === day;
          const d = new Date(`${k}T12:00:00Z`);
          return (
            <Pressable
              key={k}
              onPress={() => {
                haptic.select();
                setDay(k);
                setTime(null);
              }}
              style={[styles.day, on && styles.on]}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}>
              <Text variant="caption" style={{ fontSize: 11, color: on ? colors.beadInk : colors.steel }}>
                {d.toLocaleDateString(dateLocale(), { weekday: 'short', timeZone: 'UTC' })}
              </Text>
              <Text variant="bodyStrong" style={{ color: on ? colors.beadInk : colors.paint }}>
                {d.getUTCDate()}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
      <View style={styles.wrap}>
        {TIMES.map((slot) => {
          const off = dayJobs.loading || blocked(slot);
          return (
            <Chip
              key={slot}
              on={slot === time}
              disabled={off}
              onPress={() => setTime(slot)}
              label={timeOf(localTime(day, slot, tz).toISOString(), tz)}
            />
          );
        })}
      </View>

      <Text variant="eyebrow">{t('ba_repeat')}</Text>
      <View style={styles.wrap}>
        {REPEAT.map((r) => (
          <Chip key={r.weeks} on={r.weeks === weeks} onPress={() => setWeeks(r.weeks)} label={t(r.label)} />
        ))}
      </View>
      {weeks > 0 && (
        <View style={styles.wrap}>
          {COUNTS.map((n) => (
            <Chip key={n} on={n === count} onPress={() => setCount(n)} label={t('ba_visits', { n })} />
          ))}
        </View>
      )}

      <View style={{ gap: space.md }}>
        <Button
          label={chosen ? (weeks ? t('ba_book_series', { n: count, when: `${dayLabel(chosen.toISOString(), tz)} · ${timeOf(chosen.toISOString(), tz)}` }) : t('ba_book', { when: `${dayLabel(chosen.toISOString(), tz)} · ${timeOf(chosen.toISOString(), tz)}` })) : t('ba_pick')}
          onPress={save}
          loading={busy}
          disabled={!chosen || !svc}
        />
      </View>
    </Screen>
  );
}

function Chip({ label, on, disabled, onPress }: { label: string; on: boolean; disabled?: boolean; onPress: () => void }) {
  return (
    <Pressable
      disabled={disabled}
      onPress={() => {
        haptic.select();
        onPress();
      }}
      style={[styles.chip, on && styles.on, disabled && { opacity: 0.3 }]}
      accessibilityRole="button"
      accessibilityState={{ selected: on, disabled }}>
      <Text variant="caption" style={{ color: on ? colors.beadInk : colors.paint }}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { minHeight: 36, paddingHorizontal: 12, borderRadius: 18, justifyContent: 'center', backgroundColor: colors.gunmetal, borderWidth: 1, borderColor: '#262B35' },
  on: { backgroundColor: colors.bead, borderColor: colors.bead },
  day: { width: 52, height: 64, borderRadius: 18, alignItems: 'center', justifyContent: 'center', gap: 2, backgroundColor: colors.gunmetal, borderWidth: 1, borderColor: '#262B35' },
});
