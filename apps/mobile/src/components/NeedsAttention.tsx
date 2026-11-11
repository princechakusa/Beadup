import { router, type Href } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/ui/Icon';
import { Badge, ListCard } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import type { Attention, Booking } from '@/lib/data';
import { dayLabel, money, timeOf } from '@/lib/format';
import { haptic } from '@/lib/haptics';
import { colors } from '@/theme/tokens';

const MAX_ROWS = 3;

/**
 * Today: what needs the detailer, from real bookings and settings only.
 * Renders nothing when there's nothing to do.
 */
export function NeedsAttention({ data, tz }: { data: Attention | null | undefined; tz: string }) {
  if (!data) return null;
  const { depositsToConfirm: deposits, toCloseOut, missingPayment, missingPhone, requests } = data;
  const rows = [
    ...requests.slice(0, MAX_ROWS).map(({ request: r, booking: b }) => (
      <BookingRow
        key={`r-${r.id}`}
        b={b}
        tz={tz}
        tone={r.kind === 'cancel' ? 'danger' : 'bead'}
        badge={r.kind === 'cancel' ? 'Wants to cancel' : 'Wants new time'}
        detail={`${b.client.name}${r.note ? ` · “${r.note}”` : r.preferred.length ? ` · ${r.preferred.length} time${r.preferred.length > 1 ? 's' : ''} suggested` : ''}`}
      />
    )),
    ...toCloseOut.slice(0, MAX_ROWS).map((b) => (
      <BookingRow key={`c-${b.id}`} b={b} tz={tz} tone="steel" badge="Close out" detail={`${b.client.name} · ended, not marked done`} />
    )),
    ...deposits.slice(0, MAX_ROWS).map((b) => (
      <BookingRow
        key={`d-${b.id}`}
        b={b}
        tz={tz}
        tone="gold"
        badge={b.depositReported ? 'Says paid' : 'Deposit due'}
        detail={`${b.client.name} · ${money(b.depositCents)} deposit${b.depositReported ? ', check it arrived' : ''}`}
      />
    )),
    missingPayment && (
      <SetupRow key="pay" icon="money" title="Add how clients pay your deposit" detail="A payment link or note shows after they book." href="/settings/payment" />
    ),
    missingPhone && (
      <SetupRow key="phone" icon="phone" title="Add a phone number for clients" detail="So they can text or call you about a booking." href="/settings/profile" />
    ),
  ].filter(Boolean);
  if (rows.length === 0) return null;
  const more = Math.max(0, requests.length - MAX_ROWS) + Math.max(0, toCloseOut.length - MAX_ROWS) + Math.max(0, deposits.length - MAX_ROWS);

  return (
    <View style={{ gap: 10 }}>
      <Text variant="heading" style={{ fontSize: 18 }}>
        Needs attention
      </Text>
      <ListCard>{rows}</ListCard>
      {more > 0 && (
        <Pressable onPress={() => router.navigate('/calendar')} hitSlop={8}>
          <Text variant="caption" tone="bead">
            {more} more in your calendar
          </Text>
        </Pressable>
      )}
    </View>
  );
}

const STRIPE = { gold: colors.gold, steel: colors.steel, bead: colors.bead, danger: colors.danger } as const;

function BookingRow({ b, tz, tone, badge, detail }: { b: Booking; tz: string; tone: keyof typeof STRIPE; badge: string; detail: string }) {
  return (
    <Pressable
      onPress={() => {
        haptic.select();
        router.push(`/booking/${b.id}`);
      }}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
      accessibilityRole="button"
      accessibilityLabel={`${badge}: ${b.serviceName}, ${dayLabel(b.startsAt, tz)} ${timeOf(b.startsAt, tz)}, ${detail}`}>
      <View style={[styles.stripe, { backgroundColor: STRIPE[tone] }]} />
      <View style={{ flex: 1, gap: 1 }}>
        <Text variant="bodyStrong" style={{ fontSize: 14 }} numberOfLines={1}>
          {b.serviceName} · {dayLabel(b.startsAt, tz)} {timeOf(b.startsAt, tz)}
        </Text>
        <Text variant="caption" style={{ fontSize: 12 }} numberOfLines={1}>
          {detail}
        </Text>
      </View>
      <Badge label={badge} tone={tone} />
    </Pressable>
  );
}

function SetupRow({ icon, title, detail, href }: { icon: 'money' | 'phone'; title: string; detail: string; href: Href }) {
  return (
    <Pressable
      onPress={() => {
        haptic.select();
        router.push(href);
      }}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${detail}`}>
      <View style={styles.iconTile}>
        <Icon name={icon} size={16} color={colors.bead} />
      </View>
      <View style={{ flex: 1, gap: 1 }}>
        <Text variant="bodyStrong" style={{ fontSize: 14 }}>
          {title}
        </Text>
        <Text variant="caption" style={{ fontSize: 12 }}>
          {detail}
        </Text>
      </View>
      <Badge label="Set up" tone="bead" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  stripe: { width: 3, alignSelf: 'stretch', borderRadius: 2 },
  iconTile: { width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(77,216,255,0.1)' },
});
