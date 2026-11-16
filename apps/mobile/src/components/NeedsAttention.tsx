import { router, type Href } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/ui/Icon';
import { Badge, ListCard } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import type { Attention, Booking } from '@/lib/data';
import { dayLabel, money, timeOf } from '@/lib/format';
import { haptic } from '@/lib/haptics';
import { colors } from '@/theme/tokens';
import { t } from '@/lib/i18n';

const MAX_ROWS = 3;

/**
 * Today: what needs the detailer, from real bookings and settings only.
 * Renders nothing when there's nothing to do.
 */
export function NeedsAttention({ data, tz }: { data: Attention | null | undefined; tz: string }) {
  if (!data) return null;
  // Defaults guard against older cached data that lacks newer lists.
  const { depositsToConfirm: deposits = [], toCloseOut = [], missingPayment, missingPhone, missingPhoto, requests = [], tomorrow = [], dueBack = [] } = data;
  const rows = [
    ...requests.slice(0, MAX_ROWS).map(({ request: r, booking: b }) => (
      <BookingRow
        key={`r-${r.id}`}
        b={b}
        tz={tz}
        tone={r.kind === 'cancel' ? 'danger' : 'bead'}
        badge={r.kind === 'cancel' ? t('na_cancel') : t('na_newtime')}
        detail={`${b.client.name}${r.note ? ` · “${r.note}”` : r.preferred.length ? ` · ${t(r.preferred.length > 1 ? 'na_times_many' : 'na_times', { n: r.preferred.length })}` : ''}`}
      />
    )),
    ...tomorrow.slice(0, MAX_ROWS).map((b) => (
      <BookingRow key={`t-${b.id}`} b={b} tz={tz} tone="bead" badge={t('na_remind')} detail={t('na_remind_detail', { name: b.client.name })} />
    )),
    ...toCloseOut.slice(0, MAX_ROWS).map((b) => (
      <BookingRow key={`c-${b.id}`} b={b} tz={tz} tone="steel" badge={t('na_close')} detail={t('na_close_detail', { name: b.client.name })} />
    )),
    ...deposits.slice(0, MAX_ROWS).map((b) => (
      <BookingRow
        key={`d-${b.id}`}
        b={b}
        tz={tz}
        tone="gold"
        badge={b.depositReported ? t('na_says_paid') : t('na_deposit_due')}
        detail={t('na_deposit_detail', { name: b.client.name, amount: money(b.depositCents) }) + (b.depositReported ? t('na_check_arrived') : '')}
      />
    )),
    ...dueBack.slice(0, MAX_ROWS).map((c) => (
      <Pressable
        key={`due-${c.id}`}
        onPress={() => {
          haptic.select();
          router.push(`/client/${c.id}`);
        }}
        style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
        accessibilityRole="button"
        accessibilityLabel={t('na_due_back_a11y', { name: c.name })}>
        <View style={[styles.stripe, { backgroundColor: colors.success }]} />
        <View style={{ flex: 1, gap: 1 }}>
          <Text variant="bodyStrong" style={{ fontSize: 14 }}>
            {c.name}
          </Text>
          <Text variant="caption" style={{ fontSize: 12 }}>
            {t('na_last_visit', { day: dayLabel(c.lastVisit!, tz) })}
          </Text>
        </View>
        <Badge label={t('na_due_back')} tone="success" />
      </Pressable>
    )),
    missingPayment && (
      <SetupRow key="pay" icon="money" title={t('na_pay_title')} detail={t('na_pay_detail')} href="/settings/payment" />
    ),
    missingPhoto && (
      <SetupRow key="photo" icon="camera" title={t('na_photo_title')} detail={t('na_photo_detail')} href="/settings/media" />
    ),
    missingPhone && (
      <SetupRow key="phone" icon="phone" title={t('na_phone_title')} detail={t('na_phone_detail')} href="/settings/profile" />
    ),
  ].filter(Boolean);
  if (rows.length === 0) return null;
  const more = Math.max(0, dueBack.length - MAX_ROWS) + Math.max(0, tomorrow.length - MAX_ROWS) + Math.max(0, requests.length - MAX_ROWS) + Math.max(0, toCloseOut.length - MAX_ROWS) + Math.max(0, deposits.length - MAX_ROWS);

  return (
    <View style={{ gap: 10 }}>
      <Text variant="heading" style={{ fontSize: 18 }}>
        {t('na_title')}
      </Text>
      <ListCard>{rows}</ListCard>
      {more > 0 && (
        <Pressable onPress={() => router.navigate('/calendar')} hitSlop={8}>
          <Text variant="caption" tone="bead">
            {t('na_more', { n: more })}
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

function SetupRow({ icon, title, detail, href }: { icon: 'money' | 'phone' | 'camera'; title: string; detail: string; href: Href }) {
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
      <Badge label={t('na_setup')} tone="bead" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  stripe: { width: 3, alignSelf: 'stretch', borderRadius: 2 },
  iconTile: { width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(77,216,255,0.1)' },
});
