import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { fetchClientLink, type Booking } from '@/lib/data';
import { dayLabel, money, timeOf } from '@/lib/format';
import { haptic } from '@/lib/haptics';
import { sendMessage, type Channel } from '@/lib/messaging';
import { colors, space } from '@/theme/tokens';

type Template = 'confirm' | 'reminder' | 'onway';
const LABEL: Record<Template, string> = { confirm: 'Confirm', reminder: 'Reminder', onway: 'On my way' };

/**
 * Ready-written messages for an upcoming job, sent from the detailer's own
 * WhatsApp or Messages. The confirmation carries the client's private booking
 * page (pay the deposit, add to calendar, ask to change), which is what makes a
 * Beadup booking better than a chat thread: the details never get lost.
 */
export function MessageClient({ b, tz, businessName }: { b: Booking; tz: string; businessName: string }) {
  const [t, setT] = useState<Template>('confirm');
  const [busy, setBusy] = useState<Channel | null>(null);
  const first = b.client.name.split(' ')[0] || 'there';
  const longDate = new Date(b.startsAt).toLocaleDateString('en-US', { timeZone: tz, weekday: 'long', month: 'short', day: 'numeric' });
  const when = `${longDate} at ${timeOf(b.startsAt, tz)}`;

  const text = async (): Promise<string> => {
    if (t === 'onway') return `Hi ${first}, it's ${businessName}. I'm on my way for your ${b.serviceName}. See you soon!`;
    if (t === 'reminder') {
      const day = dayLabel(b.startsAt, tz) === 'Tomorrow' ? 'tomorrow' : `on ${longDate}`;
      return `Hi ${first}, a reminder from ${businessName}: your ${b.serviceName} is ${day} at ${timeOf(b.startsAt, tz)}, at ${b.address}. Reply here if anything changes.`;
    }
    const link = await fetchClientLink(b.id).catch(() => null);
    const deposit = b.depositCents > 0 && !b.depositReceived ? ` Deposit: ${money(b.depositCents)}.` : '';
    return `Hi ${first}, it's ${businessName}. You're booked for ${b.serviceName} on ${when}.${deposit}${link ? ` Your booking (pay, add to calendar, changes): ${link}` : ''}`;
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
      <Text variant="eyebrow">Message {first}</Text>
      <View style={styles.tabs} accessibilityRole="tablist">
        {(Object.keys(LABEL) as Template[]).map((k) => (
          <Pressable
            key={k}
            onPress={() => {
              haptic.select();
              setT(k);
            }}
            style={[styles.tab, t === k && styles.tabOn]}
            accessibilityRole="tab"
            accessibilityState={{ selected: t === k }}>
            <Text variant="caption" style={{ color: t === k ? colors.beadInk : colors.paint }}>
              {LABEL[k]}
            </Text>
          </Pressable>
        ))}
      </View>
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <View style={{ flex: 1 }}>
          <Button label="WhatsApp" loading={busy === 'whatsapp'} onPress={() => send('whatsapp')} />
        </View>
        <View style={{ flex: 1 }}>
          <Button label="Messages" variant="glass" loading={busy === 'sms'} onPress={() => send('sms')} />
        </View>
      </View>
      <Text variant="caption" style={{ fontSize: 12 }}>
        Opens with the message written in. You can edit it before sending.
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
