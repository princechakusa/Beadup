import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { fetchClientLink, type Booking } from '@/lib/data';
import { dayLabel, money, timeOf } from '@/lib/format';
import { haptic } from '@/lib/haptics';
import { sendMessage, type Channel } from '@/lib/messaging';
import { colors, space } from '@/theme/tokens';
import { dateLocale, t, type MessageKey } from '@/lib/i18n';

type Template = 'confirm' | 'reminder' | 'onway';
const LABEL: Record<Template, MessageKey> = { confirm: 'mc_confirm', reminder: 'mc_reminder', onway: 'mc_onway' };

/**
 * Ready-written messages for an upcoming job, sent from the detailer's own
 * WhatsApp or Messages. The confirmation carries the client's private booking
 * page (pay the deposit, add to calendar, ask to change), which is what makes a
 * Beadup booking better than a chat thread: the details never get lost.
 */
export function MessageClient({ b, tz, businessName }: { b: Booking; tz: string; businessName: string }) {
  const [tpl, setTpl] = useState<Template>('confirm');
  const [busy, setBusy] = useState<Channel | null>(null);
  const first = b.client.name.split(' ')[0] || t('mc_there');
  const longDate = new Date(b.startsAt).toLocaleDateString(dateLocale(), { timeZone: tz, weekday: 'long', month: 'short', day: 'numeric' });
  const when = t('mc_at', { date: longDate, time: timeOf(b.startsAt, tz) });

  const text = async (): Promise<string> => {
    if (tpl === 'onway') return t('mc_msg_onway', { name: first, business: businessName, service: b.serviceName });
    if (tpl === 'reminder') {
      const day = dayLabel(b.startsAt, tz) === t('day_tomorrow') ? t('mc_tomorrow') : t('mc_on', { date: longDate });
      return t('mc_msg_reminder', { name: first, business: businessName, service: b.serviceName, day, time: timeOf(b.startsAt, tz), address: b.address });
    }
    const link = await fetchClientLink(b.id).catch(() => null);
    const deposit = b.depositCents > 0 && !b.depositReceived ? t('mc_deposit', { amount: money(b.depositCents) }) : '';
    return t('mc_msg_confirm', { name: first, business: businessName, service: b.serviceName, when, deposit, link: link ? t('mc_link', { link }) : '' });
  };

  const send = async (channel: Channel) => {
    haptic.select();
    setBusy(channel);
    try {
      await sendMessage(channel, b.client.phone, await text());
    } finally {
      setBusy(null);
    }
  };

  return (
    <View style={styles.card}>
      <Text variant="eyebrow">{t('mc_title', { name: first })}</Text>
      <View style={styles.tabs} accessibilityRole="tablist">
        {(Object.keys(LABEL) as Template[]).map((k) => (
          <Pressable
            key={k}
            onPress={() => {
              haptic.select();
              setTpl(k);
            }}
            style={[styles.tab, tpl === k && styles.tabOn]}
            accessibilityRole="tab"
            accessibilityState={{ selected: tpl === k }}>
            <Text variant="caption" style={{ color: tpl === k ? colors.beadInk : colors.paint }}>
              {t(LABEL[k])}
            </Text>
          </Pressable>
        ))}
      </View>
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <View style={{ flex: 1 }}>
          <Button label={t('whatsapp')} loading={busy === 'whatsapp'} onPress={() => send('whatsapp')} />
        </View>
        <View style={{ flex: 1 }}>
          <Button label={t('mc_messages')} variant="glass" loading={busy === 'sms'} onPress={() => send('sms')} />
        </View>
      </View>
      <Text variant="caption" style={{ fontSize: 12 }}>
        {t('mc_hint')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: space.md, padding: 16, borderRadius: 20, backgroundColor: '#11151B', borderWidth: 1, borderColor: colors.line },
  tabs: { flexDirection: 'row', gap: 6 },
  tab: { height: 34, paddingHorizontal: 14, borderRadius: 17, justifyContent: 'center', backgroundColor: colors.gunmetal, borderWidth: 1, borderColor: '#262B35' },
  tabOn: { backgroundColor: colors.bead, borderColor: colors.bead },
});
