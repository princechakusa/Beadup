import { router, useLocalSearchParams } from 'expo-router';
import { Linking, Pressable, StyleSheet, View } from 'react-native';

import { BackButton } from '@/components/nav/BackButton';
import { Button } from '@/components/ui/Button';
import { Badge, EmptyState, ListCard, Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { sendMessage, whatsappUrl } from '@/lib/messaging';
import { apiBaseUrl } from '@/lib/supabase';
import { haptic } from '@/lib/haptics';
import { fetchClientBookings, fetchClients, fetchProfile, useQuery } from '@/lib/data';
import { dayLabel, timeOf, money } from '@/lib/format';
import { colors, fonts } from '@/theme/tokens';
import { t } from '@/lib/i18n';

const STATUS = {
  confirmed: { label: 'cd_booked' as const, tone: 'bead' as const },
  completed: { label: 'done' as const, tone: 'success' as const },
  cancelled: { label: 'bd_cancelled' as const, tone: 'steel' as const },
  no_show: { label: 'st_no_show' as const, tone: 'danger' as const },
  pending_payment: { label: 'cd_unpaid' as const, tone: 'gold' as const },
};

export default function ClientDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const clients = useQuery(fetchClients);
  const history = useQuery(() => fetchClientBookings(id), [id]);
  const profile = useQuery(fetchProfile);
  const tz = profile.data?.timezone ?? 'America/Chicago';
  const c = clients.data?.find((x) => x.id === id);

  const pretty = (e164: string) => e164.replace(/^\+1(\d{3})(\d{3})(\d{4})$/, '($1) $2-$3');

  return (
    <Screen eyebrow={c ? pretty(c.phone) : ' '} title={c?.name ?? (clients.loading ? t('loading') : t('cd_client'))} tabs={false} right={<BackButton variant="back" />}>
      {c && (
        <>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={styles.tile}>
              <Text variant="caption" style={{ fontSize: 12 }}>
                {t('cd_visits')}
              </Text>
              <Text variant="heading" style={{ fontSize: 22 }}>
                {c.visits}
              </Text>
            </View>
            <View style={styles.tile}>
              <Text variant="caption" style={{ fontSize: 12 }}>
                {t('cd_spent')}
              </Text>
              <Text variant="heading" tone="gold" style={{ fontSize: 22 }}>
                {money(c.spentCents, { cents: false })}
              </Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 1 }}>
              <Button label={t('whatsapp')} variant="glass" onPress={() => Linking.openURL(whatsappUrl(c.phone, `${c.name.split(' ')[0]}, `))} />
            </View>
            <View style={{ flex: 1 }}>
              <Button label={t('text')} variant="glass" onPress={() => Linking.openURL(`sms:${c.phone}`)} />
            </View>
            <View style={{ flex: 1 }}>
              <Button label={t('call')} variant="glass" onPress={() => Linking.openURL(`tel:${c.phone}`)} />
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 1 }}>
              <Button label={t('cd_book_again')} onPress={() => router.push(`/book/${c.id}`)} />
            </View>
            <View style={{ flex: 1 }}>
              <Button
                label={t('cd_invite')}
                variant="glass"
                onPress={() => {
                  if (!profile.data) return;
                  haptic.select();
                  sendMessage(
                    'whatsapp',
                    c.phone,
                    t('cd_invite_msg', { name: c.name.split(' ')[0], business: profile.data.businessName, url: `${apiBaseUrl}/${profile.data.handle}` }),
                  );
                }}
              />
            </View>
          </View>
          {c.email && (
            <Text variant="caption" onPress={() => Linking.openURL(`mailto:${c.email}`)} tone="bead">
              {c.email}
            </Text>
          )}
        </>
      )}

      <Text variant="heading" style={{ fontSize: 18 }}>
        {t('cd_history')}
      </Text>
      {history.data?.length ? (
        <ListCard>
          {history.data.map((b) => {
            const s = STATUS[b.status];
            return (
              <Pressable key={b.id} style={styles.row} onPress={() => router.push(`/booking/${b.id}`)} accessibilityRole="button">
                <View style={{ flex: 1, gap: 2 }}>
                  <Text variant="bodyStrong" style={{ fontSize: 14 }}>
                    {b.serviceName}
                  </Text>
                  <Text variant="caption" style={{ fontSize: 12 }}>
                    {dayLabel(b.startsAt, tz)} · {timeOf(b.startsAt, tz)}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  <Text variant="bodyStrong" style={{ fontFamily: fonts.display, fontSize: 15, color: colors.gold }}>
                    {money(b.subtotalCents)}
                  </Text>
                  <Badge label={t(s.label)} tone={s.tone} />
                </View>
              </Pressable>
            );
          })}
        </ListCard>
      ) : (
        <ListCard>
          <EmptyState title={history.loading ? t('loading') : t('cd_none')} body="" />
        </ListCard>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  tile: { flex: 1, padding: 16, borderRadius: 22, gap: 4, backgroundColor: '#11151B', borderWidth: 1, borderColor: colors.line },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
});
