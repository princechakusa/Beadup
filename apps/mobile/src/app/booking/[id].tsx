import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Linking, Share, StyleSheet, View } from 'react-native';

import { BackButton } from '@/components/nav/BackButton';
import { AskReviewButton } from '@/components/AskReviewButton';
import { MessageClient } from '@/components/MessageClient';
import { whatsappUrl } from '@/lib/messaging';
import { Button } from '@/components/ui/Button';
import { Badge, ListCard, Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import {
  cancelBooking,
  dismissBookingRequest,
  fetchBooking,
  fetchBookingRequest,
  fetchProfile,
  fetchArchivedIds,
  setArchived,
  markDepositReceived,
  requestBalanceLink,
  setBookingStatus,
  usePaymentsMode,
  useQuery,
  type BookingRequest,
} from '@/lib/data';
import { dayLabel, timeOf, money } from '@/lib/format';
import { sizeLabel } from '@/lib/trades';
import { haptic } from '@/lib/haptics';
import { shareLink } from '@/lib/share';
import { useNow } from '@/lib/time';
import { space } from '@/theme/tokens';
import { dateLocale, t } from '@/lib/i18n';

const STATUS = {
  pending_payment: { label: 'bd_awaiting' as const, tone: 'gold' as const },
  confirmed: { label: 'st_deposit_paid' as const, tone: 'success' as const },
  completed: { label: 'st_paid_full' as const, tone: 'success' as const },
  cancelled: { label: 'bd_cancelled' as const, tone: 'steel' as const },
  no_show: { label: 'st_no_show' as const, tone: 'danger' as const },
};

export default function BookingDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const booking = useQuery(() => fetchBooking(id), [id]);
  const request = useQuery(() => fetchBookingRequest(id), [id]);
  const archivedIds = useQuery(fetchArchivedIds, [], 'archived-ids');
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
      setNotice(t('bd_fail'));
    } finally {
      setBusy(null);
    }
  };

  if (!b) {
    return (
      <Screen title={booking.loading ? t('loading') : t('bd_notfound')} tabs={false} right={<BackButton />}>
        <View />
      </Screen>
    );
  }

  const started = now >= Date.parse(b.startsAt);
  const balance = b.subtotalCents - b.paidCents;
  const s =
    external && b.status === 'confirmed'
      ? b.depositReceived
        ? { label: 'st_deposit_paid' as const, tone: 'success' as const }
        : b.depositReported
          ? { label: 'bd_says_paid' as const, tone: 'gold' as const }
          : { label: 'st_deposit_due' as const, tone: 'gold' as const }
      : STATUS[b.status];

  return (
    <Screen eyebrow={`${dayLabel(b.startsAt, tz)} · ${timeOf(b.startsAt, tz)}`} title={b.serviceName} tabs={false} right={<BackButton />}>
      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
        <Badge label={t(s.label)} tone={s.tone} />
        <Text variant="caption">
          {[sizeLabel(b.vehicleSize), t('hours_short', { n: Math.round((b.durationMin / 60) * 10) / 10 }), b.staffName && t('bd_with', { name: b.staffName })].filter(Boolean).join(' · ')}
        </Text>
      </View>

      {request.data && (b.status === 'confirmed' || b.status === 'pending_payment') && (
        <RequestCard
          r={request.data}
          first={b.client.name.split(' ')[0] || t('bd_the_client')}
          busy={busy === 'dismiss'}
          onReschedule={() => router.push(`/reschedule/${b.id}`)}
          onCancel={() => setConfirmCancel(true)}
          onDismiss={() => run('dismiss', () => dismissBookingRequest(request.data!.id))}
        />
      )}

      <ListCard>
        <View style={styles.block}>
          <Text variant="eyebrow">{t('bd_client')}</Text>
          <Text variant="heading" style={{ fontSize: 18 }} onPress={() => router.push(`/client/${b.client.id}`)}>
            {b.client.name}
          </Text>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
            <View style={{ flex: 1 }}>
              <Button label={t('whatsapp')} variant="glass" onPress={() => Linking.openURL(whatsappUrl(b.client.phone, `${b.client.name.split(' ')[0]}, `))} />
            </View>
            <View style={{ flex: 1 }}>
              <Button label={t('text')} variant="glass" onPress={() => Linking.openURL(`sms:${b.client.phone}`)} />
            </View>
            <View style={{ flex: 1 }}>
              <Button label={t('call')} variant="glass" onPress={() => Linking.openURL(`tel:${b.client.phone}`)} />
            </View>
          </View>
        </View>
        <View style={styles.block}>
          <Text variant="eyebrow">{t('bd_where')}</Text>
          <Text variant="body">{b.address}</Text>
        </View>
        {!!b.notes && (
          <View style={styles.block}>
            <Text variant="eyebrow">{t('bd_notes')}</Text>
            <Text variant="body">{b.notes}</Text>
          </View>
        )}
      </ListCard>

      <ListCard>
        <Line label={b.serviceName} value={money(b.subtotalCents - b.addOns.reduce((n, a) => n + (a.priceCents ?? 0), 0))} />
        {b.addOns.map((a) => (
          <Line key={a.name} label={a.name} value={a.priceCents != null ? money(a.priceCents) : ''} muted />
        ))}
        <Line label={t('bd_total')} value={money(b.subtotalCents)} strong />
        {external ? (
          <Line
            label={
              b.depositReceived
                ? t('bd_dep_received')
                : b.depositReported
                  ? t('bd_dep_check')
                  : t('bd_dep_unpaid')
            }
            value={money(b.depositCents)}
            muted={b.depositReceived}
            gold={!b.depositReceived}
          />
        ) : (
          <>
            <Line label={t('bd_paid_so_far')} value={money(b.paidCents)} muted />
            {balance > 0 && b.status !== 'cancelled' && <Line label={t('bd_balance')} value={money(balance)} gold />}
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
              ? t('bd_undo_dep')
              : b.depositReported
                ? t('bd_confirm_dep', { amount: money(b.depositCents) })
                : t('bd_dep_btn', { amount: money(b.depositCents) })
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
        <AskReviewButton bookingId={b.id} clientName={b.client.name} clientPhone={b.client.phone} businessName={profile.data?.businessName ?? t('bd_us')} />
      )}

      {b.status === 'confirmed' && (
        <View style={{ gap: space.md }}>
          {!external && started && balance > 0 && (
            <Button
              label={t('bd_send_balance')}
              loading={busy === 'balance'}
              onPress={() =>
                run('balance', async () => {
                  const link = await requestBalanceLink(b.id);
                  haptic.success();
                  setNotice(null);
                  await shareLink(t('bd_balance_msg'), link.url);
                })
              }
            />
          )}
          {started && (
            <Button
              label={external ? t('bd_done') : balance > 0 ? t('bd_done_other') : t('bd_done')}
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
            <Button label={t('bd_noshow')} variant="ghost" loading={busy === 'noshow'} onPress={() => run('noshow', () => setBookingStatus(b.id, 'no_show'))} />
          )}
          {!started && <MessageClient b={b} tz={tz} businessName={profile.data?.businessName ?? t('bd_your_pro')} />}
          {!started && <Button label={t('bd_reschedule')} variant="glass" onPress={() => router.push(`/reschedule/${b.id}`)} />}
          {!confirmCancel ? (
            <Button label={t('bd_cancel_btn')} variant="danger" onPress={() => setConfirmCancel(true)} />
          ) : (
            <View style={styles.confirm}>
              <Text variant="body">
                {external
                  ? t('bd_cancel_ext', { name: b.client.name.split(' ')[0] })
                  : t('bd_cancel_refund', { name: b.client.name.split(' ')[0], amount: money(b.paidCents + b.bookingFeeCents) })}
              </Text>
              <Button
                label={external ? t('bd_yes_cancel') : t('bd_yes_refund')}
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
              <Button label={t('bd_keep')} variant="ghost" onPress={() => setConfirmCancel(false)} />
            </View>
          )}
        </View>
      )}

      {(b.status === 'completed' || b.status === 'no_show') && (
        <Button
          label={(archivedIds.data ?? []).includes(b.id) ? t('ach_restore') : t('ach_job')}
          variant="ghost"
          loading={busy === 'archive'}
          onPress={() =>
            run('archive', async () => {
              await setArchived([b.id], !(archivedIds.data ?? []).includes(b.id));
              archivedIds.refresh();
            })
          }
        />
      )}

      {justCancelled && b.status === 'cancelled' && (
        <TellClientCancelled
          phone={b.client.phone}
          first={b.client.name.split(' ')[0] || t('bd_there')}
          what={t('bd_what', { service: b.serviceName, date: new Date(b.startsAt).toLocaleDateString(dateLocale(), { timeZone: tz, weekday: 'long', month: 'short', day: 'numeric' }) })}
          refundNote={external ? (b.depositReceived || b.depositReported ? t('bd_refund_dep') : '') : t('bd_refund_card')}
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
  return `${new Date(`${date}T12:00:00Z`).toLocaleDateString(dateLocale(), { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' })} · ${to12h(time)}`;
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
      <Text variant="bodyStrong">{cancel ? t('bd_rq_cancel', { name: first }) : t('bd_rq_new', { name: first })}</Text>
      {r.preferred.map((p) => (
        <Text key={p} variant="body">
          {localLabel(p)}
        </Text>
      ))}
      {!!r.note && <Text variant="caption">“{r.note}”</Text>}
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
        <View style={{ flex: 1 }}>
          <Button label={cancel ? t('bd_cancel_btn') : t('bd_reschedule')} variant={cancel ? 'danger' : 'primary'} onPress={cancel ? onCancel : onReschedule} />
        </View>
        <View style={{ flex: 1 }}>
          <Button label={t('bd_dismiss')} variant="ghost" loading={busy} onPress={onDismiss} />
        </View>
      </View>
      <Text variant="caption" style={{ fontSize: 12 }}>
        {t('bd_dismiss_d', { name: first })}
      </Text>
    </View>
  );
}

/** Beadup doesn't text clients yet, so after cancelling the detailer sends the message from their own phone. */
function TellClientCancelled({ phone, first, what, refundNote, businessName }: { phone: string; first: string; what: string; refundNote: string; businessName: string }) {
  const message = t('bd_tell_msg', { name: first, what, refund: refundNote, business: businessName }).trim();
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
      <Text variant="caption">{t('bd_cancelled_note', { name: first })}</Text>
      <Button label={t('bd_let_know', { name: first })} onPress={tell} />
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

