import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { EmptyState, ListCard, Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { fetchBalance, fetchBookings, fetchPayments, fetchProfile, usePaymentsMode, useQuery, type Booking } from '@/lib/data';
import { dateKey, dayLabel, startOfDay, timeOf, usd, usdParts } from '@/lib/format';
import { colors, fonts } from '@/theme/tokens';

export default function Money() {
  const external = usePaymentsMode() === 'external';
  if (external) return <MoneyDirect />;
  return <MoneyStripe />;
}

/**
 * Launch mode: clients pay the detailer directly, so Beadup shows what the
 * detailer's jobs are worth (from bookings), not payments it never handled.
 */
function MoneyDirect() {
  const profile = useQuery(fetchProfile);
  const tz = profile.data?.timezone ?? 'America/Chicago';
  const monthKey = `${dateKey(new Date(), tz).slice(0, 7)}-01`;
  const [y, m] = monthKey.split('-').map(Number);
  const nextKey = `${m === 12 ? y + 1 : y}-${String(m === 12 ? 1 : m + 1).padStart(2, '0')}-01`;
  const month = useQuery(
    () => fetchBookings(startOfDay(monthKey, tz), startOfDay(nextKey, tz)),
    [monthKey, tz],
    `money-direct-${monthKey}`,
  );
  const jobs = month.data ?? [];
  const done = jobs.filter((b) => b.status === 'completed');
  const ahead = jobs.filter((b) => b.status === 'confirmed');
  const earned = done.reduce((n, b) => n + b.subtotalCents, 0);
  const booked = ahead.reduce((n, b) => n + b.subtotalCents, 0);
  const noShows = jobs.filter((b) => b.status === 'no_show').length;
  const depositsIn = jobs.filter((b) => b.depositReceived && b.status !== 'cancelled').reduce((n, b) => n + b.depositCents, 0);
  const depositsDue = ahead.filter((b) => !b.depositReceived).length;
  const { whole, fraction } = usdParts(earned);
  const monthName = new Date(`${monthKey}T12:00:00Z`).toLocaleDateString('en-US', { month: 'long', timeZone: 'UTC' });
  const recent = [...jobs].sort((a, b) => Date.parse(b.startsAt) - Date.parse(a.startsAt)).slice(0, 20);
  const STATUS_TEXT: Partial<Record<Booking['status'], string>> = { completed: 'done', confirmed: 'booked', no_show: 'no-show' };

  return (
    <Screen eyebrow="This month" title="Money" offline={month.stale} refreshing={month.loading && !!month.data} onRefresh={month.refresh}>
      <View style={styles.hero}>
        <View pointerEvents="none" style={styles.goldGlow} />
        <Text variant="caption" style={{ fontSize: 13 }}>
          Earned in {monthName}
        </Text>
        <Text style={styles.bigMoney} accessibilityLabel={`Earned ${usd(earned)}`}>
          {whole}
          <Text style={styles.fraction}>{fraction}</Text>
        </Text>
        <View style={styles.payoutRow}>
          <View style={styles.liveDot} />
          <Text variant="caption" style={{ fontSize: 13, color: '#C9D0DC' }}>
            From {done.length} finished job{done.length === 1 ? '' : 's'} · clients pay you directly
          </Text>
        </View>
      </View>

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={styles.tile}>
          <Text variant="caption" style={{ fontSize: 12 }}>
            Still booked this month
          </Text>
          <Text variant="heading" style={{ fontSize: 22 }}>
            {usd(booked, { cents: false })}
          </Text>
        </View>
        <View style={styles.tile}>
          <Text variant="caption" style={{ fontSize: 12 }}>
            Deposits received
          </Text>
          <Text variant="heading" style={{ fontSize: 22 }}>
            {usd(depositsIn, { cents: false })}
          </Text>
          <Text variant="caption" style={{ fontSize: 11, color: depositsDue ? colors.gold : colors.steel }}>
            {depositsDue ? `${depositsDue} still due` : noShows ? `${noShows} no-show${noShows === 1 ? '' : 's'}` : 'All paid'}
          </Text>
        </View>
      </View>

      <Text variant="heading" style={{ fontSize: 18 }}>
        Jobs this month
      </Text>
      {recent.length ? (
        <ListCard>
          {recent.map((b) => (
            <Pressable key={b.id} style={styles.row} onPress={() => router.push(`/booking/${b.id}`)} accessibilityRole="button">
              <View style={[styles.icon, { backgroundColor: b.status === 'completed' ? 'rgba(91,227,164,0.12)' : 'rgba(77,216,255,0.10)' }]}>
                <Icon name={b.status === 'completed' ? 'arrowUp' : 'calendar'} size={18} strokeWidth={2.2} color={b.status === 'completed' ? colors.success : colors.bead} />
              </View>
              <View style={{ flex: 1, gap: 1 }}>
                <Text variant="bodyStrong" style={{ fontSize: 14 }} numberOfLines={1}>
                  {b.client.name.split(' ')[0]} · {b.serviceName}
                </Text>
                <Text variant="caption" style={{ fontSize: 12 }}>
                  {dayLabel(b.startsAt, tz)} · {STATUS_TEXT[b.status] ?? b.status}
                </Text>
              </View>
              <Text variant="bodyStrong" style={{ fontFamily: fonts.display, fontSize: 15, color: b.status === 'completed' ? colors.paint : colors.steel }}>
                {usd(b.subtotalCents)}
              </Text>
            </Pressable>
          ))}
        </ListCard>
      ) : (
        <ListCard>
          <EmptyState title={month.loading ? 'Loading…' : 'No jobs yet this month'} body={month.loading ? '' : 'Bookings from your link show up here.'} />
        </ListCard>
      )}
    </Screen>
  );
}

function MoneyStripe() {
  const profile = useQuery(fetchProfile);
  const tz = profile.data?.timezone ?? 'America/Chicago';
  const monthKey = `${dateKey(new Date(), tz).slice(0, 7)}-01`;
  const monthStart = startOfDay(monthKey, tz);

  const balance = useQuery(fetchBalance, [], 'balance');
  const month = useQuery(async () => {
    const [payments, bookings] = await Promise.all([fetchPayments(monthStart), fetchBookings(monthStart, new Date())]);
    return { payments, bookings };
  }, [monthKey, tz], `money-${monthKey}`);

  const earned = (month.data?.payments ?? []).filter((p) => p.status === 'succeeded').reduce((n, p) => n + p.amountCents, 0);
  const noShows = (month.data?.bookings ?? []).filter((b) => b.status === 'no_show').length;
  const b = balance.data;
  const { whole, fraction } = usdParts(b?.availableCents ?? 0);
  const monthName = new Date(`${monthKey}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' });

  return (
    <Screen
      eyebrow="This month"
      title="Money"
      offline={month.stale}
      refreshing={(balance.loading || month.loading) && !!month.data}
      onRefresh={() => {
        balance.refresh();
        month.refresh();
      }}>
      <View style={styles.hero}>
        <View pointerEvents="none" style={styles.goldGlow} />
        <Text variant="caption" style={{ fontSize: 13 }}>
          Available to pay out
        </Text>
        {b && !b.connected ? (
          <View style={{ gap: 12, marginTop: 6 }}>
            <Text variant="body" tone="steel">
              Connect Stripe to take deposits and get paid out to your bank.
            </Text>
            <Button label="Set up payouts" onPress={() => router.push('/settings')} />
          </View>
        ) : (
          <>
            <Text style={styles.bigMoney} accessibilityLabel={`Available ${usd(b?.availableCents ?? 0)}`}>
              {whole}
              <Text style={styles.fraction}>{fraction}</Text>
            </Text>
            <View style={styles.payoutRow}>
              <View style={styles.liveDot} />
              <Text variant="caption" style={{ fontSize: 13, color: '#C9D0DC' }}>
                {b?.nextPayout
                  ? `Next payout ${dayLabel(b.nextPayout.arrivalDate, tz).toLowerCase()}${b.bankLast4 ? ` to ••${b.bankLast4}` : ''}`
                  : b?.pendingCents
                    ? `${usd(b.pendingCents)} on its way from recent payments`
                    : 'Payouts go to your bank automatically'}
              </Text>
            </View>
          </>
        )}
      </View>

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={styles.tile}>
          <Text variant="caption" style={{ fontSize: 12 }}>
            Earned in {monthName}
          </Text>
          <Text variant="heading" style={{ fontSize: 22 }}>
            {usd(earned, { cents: false })}
          </Text>
        </View>
        <View style={styles.tile}>
          <Text variant="caption" style={{ fontSize: 12 }}>
            Deposits kept
          </Text>
          <Text variant="heading" style={{ fontSize: 22, color: noShows ? colors.success : colors.paint }}>
            {noShows} no-show{noShows === 1 ? '' : 's'}
          </Text>
        </View>
      </View>

      <Text variant="heading" style={{ fontSize: 18 }}>
        Recent payments
      </Text>

      {month.data?.payments.length ? (
        <ListCard>
          {month.data.payments.slice(0, 20).map((p) => {
            const refunded = p.status === 'refunded';
            return (
              <Pressable
                key={p.id}
                style={styles.row}
                onPress={() => router.push(refunded ? `/booking/${p.bookingId}` : `/paid/${p.bookingId}`)}
                accessibilityRole="button">
                <View style={[styles.icon, { backgroundColor: refunded ? 'rgba(255,138,138,0.12)' : 'rgba(91,227,164,0.12)' }]}>
                  <Icon name={refunded ? 'arrowDown' : 'arrowUp'} size={18} strokeWidth={2.2} color={refunded ? colors.danger : colors.success} />
                </View>
                <View style={{ flex: 1, gap: 1 }}>
                  <Text variant="bodyStrong" style={{ fontSize: 14 }}>
                    {p.clientName.split(' ')[0]} {p.clientName.split(' ')[1]?.[0] ? `${p.clientName.split(' ')[1][0]}.` : ''} · {refunded ? 'refunded' : p.kind}
                  </Text>
                  <Text variant="caption" style={{ fontSize: 12 }}>
                    {dayLabel(p.createdAt, tz)}
                    {dayLabel(p.createdAt, tz) === 'Today' ? `, ${timeOf(p.createdAt, tz)}` : ''}
                  </Text>
                </View>
                <Text variant="bodyStrong" style={{ fontFamily: fonts.display, fontSize: 15, color: refunded ? colors.steel : colors.paint }}>
                  {refunded ? '-' : '+'}
                  {usd(p.amountCents)}
                </Text>
              </Pressable>
            );
          })}
        </ListCard>
      ) : (
        <ListCard>
          <EmptyState
            title={month.loading ? 'Loading payments…' : 'No payments yet this month'}
            body={month.loading ? '' : 'Deposits and balances paid by clients show up here.'}
          />
        </ListCard>
      )}
    </Screen>
  );
}

const panel = { backgroundColor: '#11151B', borderWidth: 1, borderColor: colors.line } as const;

const styles = StyleSheet.create({
  hero: { ...panel, borderRadius: 32, padding: 22, gap: 6, overflow: 'hidden' },
  goldGlow: { position: 'absolute', right: -60, top: -60, width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(255,181,71,0.12)' },
  bigMoney: { fontFamily: 'Sora_800ExtraBold', fontSize: 52, letterSpacing: -2.5, lineHeight: 56, color: colors.gold },
  fraction: { fontSize: 30, color: '#5B6371' },
  payoutRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.success, shadowColor: colors.success, shadowOpacity: 0.9, shadowRadius: 4 },
  tile: { ...panel, flex: 1, padding: 16, borderRadius: 22, gap: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  icon: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
});
