import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Linking, Share, StyleSheet, View } from 'react-native';

import { BackButton } from '@/components/nav/BackButton';
import { AskReviewButton } from '@/components/AskReviewButton';
import { Button } from '@/components/ui/Button';
import { Badge, ListCard, Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import {
  cancelBooking,
  dismissBookingRequest,
  fetchBooking,
  fetchBookingRequest,
  fetchProfile,
  markDepositReceived,
  requestBalanceLink,
  setBookingStatus,
  usePaymentsMode,
  useQuery,
  type BookingRequest,
} from '@/lib/data';
import { dayLabel, timeOf, money } from '@/lib/format';
import { haptic } from '@/lib/haptics';
import { shareLink } from '@/lib/share';
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
  const request = useQuery(() => fetchBookingRequest(id), [id]);
  const profile = useQuery(fetchProfile);
  const tz = profile.data?.timezone ?? 'America/Chicago';
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [justCancelled, setJustCancelled] = useState(false);
  const now = useNow();
  // Launch mode: deposits and balances are paid to the detailer directly.
  const external = usePaymentsMode() === 'external';

  const b = booking.data;
  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    setNotice(null);
    try {
      await fn();
      booking.refresh();
      request.refresh();
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
  const s =
    external && b.status === 'confirmed'
      ? b.depositReceived
        ? { label: 'Deposit paid', tone: 'success' as const }
        : b.depositReported
          ? { label: 'Client says paid', tone: 'gold' as const }
          : { label: 'Deposit due', tone: 'gold' as const }
      : STATUS[b.status];

  return (
    <Screen eyebrow={`${dayLabel(b.startsAt, tz)} · ${timeOf(b.startsAt, tz)}`} title={b.serviceName} tabs={false} right={<BackButton />}>
      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
        <Badge label={s.label} tone={s.tone} />
        <Text variant="caption">
          {SIZE_LABEL[b.vehicleSize]} · {Math.round((b.durationMin / 60) * 10) / 10} h
        </Text>
      </View>

      {request.data && (b.status === 'confirmed' || b.status === 'pending_payment') && (
        <RequestCard
          r={request.data}
          first={b.client.name.split(' ')[0] || 'The client'}
          busy={busy === 'dismiss'}
          onReschedule={() => router.push(`/reschedule/${b.id}`)}
          onCancel={() => setConfirmCancel(true)}
          onDismiss={() => run('dismiss', () => dismissBookingRequest(request.data!.id))}
        />
      )}

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
        <Line label={b.serviceName} value={money(b.subtotalCents - b.addOns.reduce((n, a) => n + (a.priceCents ?? 0), 0))} />
        {b.addOns.map((a) => (
          <Line key={a.name} label={a.name} value={a.priceCents != null ? money(a.priceCents) : ''} muted />
        ))}
        <Line label="Total" value={money(b.subtotalCents)} strong />
        {external ? (
          <Line
            label={
              b.depositReceived
                ? 'Deposit received'
                : b.depositReported
                  ? 'Deposit (30%): client says it’s sent. Check it arrived.'
                  : 'Deposit (30%), not marked paid yet'
            }
            value={money(b.depositCents)}
            muted={b.depositReceived}
            gold={!b.depositReceived}
          />
        ) : (
          <>
            <Line label="Paid so far" value={money(b.paidCents)} muted />
            {balance > 0 && b.status !== 'cancelled' && <Line label="Balance due after the job" value={money(balance)} gold />}
          </>
        )}
      </ListCard>

      {notice && (
        <Text variant="caption" tone="danger" accessibilityLiveRegion="polite">
          {notice}
        </Text>
      )}

      {external && b.status !== 'cancelled' && b.status !== 'pending_payment' && (
        <Button
          label={
            b.depositReceived
              ? 'Undo: deposit not received'
              : b.depositReported
                ? `Confirm deposit received (${money(b.depositCents)})`
                : `Deposit received (${money(b.depositCents)})`
          }
          variant={b.depositReceived ? 'ghost' : 'primary'}
          loading={busy === 'deposit'}
          onPress={() =>
            run('deposit', async () => {
              await markDepositReceived(b.id, !b.depositReceived);
              if (b.depositReceived) haptic.select();
              else haptic.success();
            })
          }
        />
      )}

      {b.status === 'completed' && (
        <AskReviewButton bookingId={b.id} clientName={b.client.name} clientPhone={b.client.phone} businessName={profile.data?.businessName ?? 'us'} />
      )}

      {b.status === 'confirmed' && (
        <View style={{ gap: space.md }}>
          {!external && started && balance > 0 && (
            <Button
              label="Send balance payment link"
              loading={busy === 'balance'}
              onPress={() =>
                run('balance', async () => {
                  const link = await requestBalanceLink(b.id);
                  haptic.success();
                  setNotice(null);
                  await shareLink('Thanks for choosing us! Pay your balance here:', link.url);
                })
              }
            />
          )}
          {started && (
            <Button
              label={external ? 'Mark job done' : balance > 0 ? 'Mark job done (paid another way)' : 'Mark job done'}
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
          {!started && <Button label="Reschedule" variant="glass" onPress={() => router.push(`/reschedule/${b.id}`)} />}
          {!confirmCancel ? (
            <Button label="Cancel booking" variant="danger" onPress={() => setConfirmCancel(true)} />
          ) : (
            <View style={styles.confirm}>
              <Text variant="body">
                {external
                  ? `Cancel ${b.client.name.split(' ')[0]}’s booking? If they paid you a deposit, refund it to them directly.`
                  : `Cancel and refund ${b.client.name.split(' ')[0]} ${money(b.paidCents + b.bookingFeeCents)} in full? They’ll get it back on their card.`}
              </Text>
              <Button
                label={external ? 'Yes, cancel booking' : 'Yes, cancel and refund'}
                variant="danger"
                loading={busy === 'cancel'}
                onPress={() =>
                  run('cancel', async () => {
                    await cancelBooking(b.id);
                    haptic.warning();
                    setConfirmCancel(false);
                    setJustCancelled(true);
                  })
                }
              />
              <Button label="Keep booking" variant="ghost" onPress={() => setConfirmCancel(false)} />
            </View>
          )}
        </View>
      )}

      {justCancelled && b.status === 'cancelled' && (
        <TellClientCancelled
          phone={b.client.phone}
          first={b.client.name.split(' ')[0] || 'there'}
          what={`${b.serviceName} on ${new Date(b.startsAt).toLocaleDateString('en-US', { timeZone: tz, weekday: 'long', month: 'short', day: 'numeric' })}`}
          refundNote={external ? (b.depositReceived || b.depositReported ? ' I’ll refund your deposit.' : '') : ' Your refund is on its way to your card.'}
          businessName={profile.data?.businessName ?? ''}
        />
      )}
    </Screen>
  );
}

const to12h = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
};
/** "YYYY-MM-DD HH:MM" (business timezone) as "Tue, Nov 18 · 10:00 AM". */
const localLabel = (s: string) => {
  const [date, time] = s.split(' ');
  return `${new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' })} · ${to12h(time)}`;
};

/** A request the client sent from their booking page. Moving or cancelling closes it by itself. */
function RequestCard({
  r,
  first,
  busy,
  onReschedule,
  onCancel,
  onDismiss,
}: {
  r: BookingRequest;
  first: string;
  busy: boolean;
  onReschedule: () => void;
  onCancel: () => void;
  onDismiss: () => void;
}) {
  const cancel = r.kind === 'cancel';
  return (
    <View style={[styles.request, cancel && { borderColor: 'rgba(255,138,138,0.35)', backgroundColor: 'rgba(255,138,138,0.06)' }]}>
      <Text variant="bodyStrong">{cancel ? `${first} asks to cancel` : `${first} asks for a new time`}</Text>
      {r.preferred.map((p) => (
        <Text key={p} variant="body">
          {localLabel(p)}
        </Text>
      ))}
      {!!r.note && <Text variant="caption">“{r.note}”</Text>}
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
        <View style={{ flex: 1 }}>
          <Button label={cancel ? 'Cancel booking' : 'Reschedule'} variant={cancel ? 'danger' : 'primary'} onPress={cancel ? onCancel : onReschedule} />
        </View>
        <View style={{ flex: 1 }}>
          <Button label="Dismiss" variant="ghost" loading={busy} onPress={onDismiss} />
        </View>
      </View>
      <Text variant="caption" style={{ fontSize: 12 }}>
        Dismiss if you sorted it out another way. {first} sees the request until then.
      </Text>
    </View>
  );
}

/** Beadup doesn't text clients yet, so after cancelling the detailer sends the message from their own phone. */
function TellClientCancelled({ phone, first, what, refundNote, businessName }: { phone: string; first: string; what: string; refundNote: string; businessName: string }) {
  const message = `Hi ${first}, I’m sorry, I have to cancel your ${what}.${refundNote} ${businessName}`.trim();
  const tell = async () => {
    haptic.select();
    const sms = `sms:${phone}&body=${encodeURIComponent(message)}`;
    try {
      if (phone && (await Linking.canOpenURL(sms))) return await Linking.openURL(sms);
    } catch {
      // fall through to the share sheet
    }
    await Share.share({ message }).catch(() => undefined);
  };
  return (
    <View style={{ gap: space.md }}>
      <Text variant="caption">Cancelled. {first} isn’t told automatically.</Text>
      <Button label={`Let ${first} know`} onPress={tell} />
    </View>
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
  request: { gap: 4, padding: 16, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(77,216,255,0.35)', backgroundColor: 'rgba(77,216,255,0.06)' },
  confirm: { gap: space.md, padding: 16, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,138,138,0.35)', backgroundColor: 'rgba(255,138,138,0.06)' },
});

