import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Linking, Share, StyleSheet, View } from 'react-native';

import { BackButton } from '@/components/nav/BackButton';
import { Button } from '@/components/ui/Button';
import { Badge, ListCard, Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { cancelBooking, fetchBooking, fetchProfile, requestBalanceLink, setBookingStatus, useQuery } from '@/lib/data';
import { dayLabel, timeOf, usd } from '@/lib/format';
import { haptic } from '@/lib/haptics';
import { useNow } from '@/lib/time';
import { space } from '@/theme/tokens';

const SIZE_LABEL = { sedan: 'Sedan', suv: 'SUV', truck: 'Truck' } as const;
const STATUS = {
  pending_payment: { label: 'Awaiting deposit', tone: 'gold' as const },
  confirmed: { label: 'Deposit paid', tone: 'success' as const },
  completed: { label: 'Paid in full', tone: 'success' as const },
  cancelled: { label: 'Cancelled', tone: 'steel' as const },
  no_show: { label: 'No-show', tone: 'danger' as const },
};

export default function BookingDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const booking = useQuery(() => fetchBooking(id), [id]);
  const profile = useQuery(fetchProfile);
  const tz = profile.data?.timezone ?? 'America/Chicago';
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const now = useNow();

  const b = booking.data;
  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    setNotice(null);
    try {
      await fn();
      booking.refresh();
    } catch {
      haptic.error();
      setNotice('That didn’t go through. Check your connection and try again.');
    } finally {
      setBusy(null);
    }
  };

  if (!b) {
    return (
      <Screen title={booking.loading ? 'Loading…' : 'Booking not found'} tabs={false} right={<BackButton />}>
        <View />
      </Screen>
    );
  }

  const started = now >= Date.parse(b.startsAt);
  const balance = b.subtotalCents - b.paidCents;
  const s = STATUS[b.status];

  return (
    <Screen eyebrow={`${dayLabel(b.startsAt, tz)} · ${timeOf(b.startsAt, tz)}`} title={b.serviceName} tabs={false} right={<BackButton />}>
      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
        <Badge label={s.label} tone={s.tone} />
        <Text variant="caption">
          {SIZE_LABEL[b.vehicleSize]} · {Math.round((b.durationMin / 60) * 10) / 10} h
        </Text>
      </View>

      <ListCard>
        <View style={styles.block}>
          <Text variant="eyebrow">Client</Text>
          <Text variant="heading" style={{ fontSize: 18 }} onPress={() => router.push(`/client/${b.client.id}`)}>
            {b.client.name}
          </Text>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
            <View style={{ flex: 1 }}>
              <Button label="Text" variant="glass" onPress={() => Linking.openURL(`sms:${b.client.phone}`)} />
            </View>
            <View style={{ flex: 1 }}>
              <Button label="Call" variant="glass" onPress={() => Linking.openURL(`tel:${b.client.phone}`)} />
            </View>
          </View>
        </View>
        <View style={styles.block}>
          <Text variant="eyebrow">Where</Text>
          <Text variant="body">{b.address}</Text>
        </View>
        {!!b.notes && (
          <View style={styles.block}>
            <Text variant="eyebrow">Notes</Text>
            <Text variant="body">{b.notes}</Text>
          </View>
        )}
      </ListCard>

      <ListCard>
        <Line label={b.serviceName} value={usd(b.subtotalCents - b.addOns.reduce((n, a) => n + (a.priceCents ?? 0), 0))} />
        {b.addOns.map((a) => (
          <Line key={a.name} label={a.name} value={a.priceCents != null ? usd(a.priceCents) : ''} muted />
        ))}
        <Line label="Total" value={usd(b.subtotalCents)} strong />
        <Line label="Paid so far" value={usd(b.paidCents)} muted />
        {balance > 0 && b.status !== 'cancelled' && <Line label="Balance due after the job" value={usd(balance)} gold />}
      </ListCard>

      {notice && (
        <Text variant="caption" tone="danger" accessibilityLiveRegion="polite">
          {notice}
        </Text>
      )}

      {b.status === 'confirmed' && (
        <View style={{ gap: space.md }}>
          {started && balance > 0 && (
            <Button
              label="Send balance payment link"
              loading={busy === 'balance'}
              onPress={() =>
                run('balance', async () => {
                  const link = await requestBalanceLink(b.id);
                  haptic.success();
                  setNotice(null);
                  await Share.share({ message: `Thanks for choosing us! Pay your balance here: ${link.url}` });
                })
              }
            />
          )}
          {started && (
            <Button
              label={balance > 0 ? 'Mark job done (paid another way)' : 'Mark job done'}
              variant="glass"
              loading={busy === 'done'}
              onPress={() =>
                run('done', async () => {
                  await setBookingStatus(b.id, 'completed');
                  router.push(`/paid/${b.id}`);
                })
              }
            />
          )}
          {started && (
            <Button label="Client didn’t show" variant="ghost" loading={busy === 'noshow'} onPress={() => run('noshow', () => setBookingStatus(b.id, 'no_show'))} />
          )}
          {!confirmCancel ? (
            <Button label="Cancel booking" variant="danger" onPress={() => setConfirmCancel(true)} />
          ) : (
            <View style={styles.confirm}>
              <Text variant="body">
                Cancel and refund {b.client.name.split(' ')[0]} {usd(b.paidCents + b.bookingFeeCents)} in full? They&apos;ll get it back on their card.
              </Text>
              <Button
                label="Yes, cancel and refund"
                variant="danger"
                loading={busy === 'cancel'}
                onPress={() =>
                  run('cancel', async () => {
                    await cancelBooking(b.id);
                    haptic.warning();
                    setConfirmCancel(false);
                  })
                }
              />
              <Button label="Keep booking" variant="ghost" onPress={() => setConfirmCancel(false)} />
            </View>
          )}
        </View>
      )}
    </Screen>
  );
}

function Line({ label, value, strong, muted, gold }: { label: string; value: string; strong?: boolean; muted?: boolean; gold?: boolean }) {
  return (
    <View style={styles.line}>
      <Text variant={strong ? 'bodyStrong' : 'body'} tone={muted ? 'steel' : 'paint'} style={{ flex: 1 }}>
        {label}
      </Text>
      <Text variant={strong || gold ? 'bodyStrong' : 'body'} tone={gold || strong ? 'gold' : muted ? 'steel' : 'paint'}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { padding: 16, gap: 4 },
  line: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 12, gap: 12 },
  confirm: { gap: space.md, padding: 16, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,138,138,0.35)', backgroundColor: 'rgba(255,138,138,0.06)' },
});

