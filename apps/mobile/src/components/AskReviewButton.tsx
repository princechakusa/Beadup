import { View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { fetchReviewLink, useQuery } from '@/lib/data';
import { haptic } from '@/lib/haptics';
import { sendMessage, type Channel } from '@/lib/messaging';
import { t } from '@/lib/i18n';

/**
 * "Send receipt" on a completed job: one private link with the client's
 * receipt (printable, or save as PDF) and a 30-second rating. Opens WhatsApp
 * or Messages with the text written in, from the detailer's own number (Beadup
 * sends no texts itself). Once rated, it says so and still lets you resend the receipt.
 */
export function AskReviewButton({
  bookingId,
  clientName,
  clientPhone,
  businessName,
}: {
  bookingId: string;
  clientName: string;
  clientPhone: string;
  businessName: string;
}) {
  const link = useQuery(() => fetchReviewLink(bookingId), [bookingId], `review-link:${bookingId}`);
  if (!link.data) return null;

  const first = clientName.split(' ')[0] || t('mc_there');
  const reviewed = link.data.reviewed;
  const message = reviewed
    ? t('ar_msg_done', { name: first, business: businessName, url: link.data.url })
    : t('ar_msg_ask', { name: first, business: businessName, url: link.data.url });

  const send = (channel: Channel) => {
    haptic.select();
    return sendMessage(channel, clientPhone, message);
  };

  return (
    <View style={{ gap: 8 }}>
      <Text variant="eyebrow">{reviewed ? t('ar_receipt_done') : t('ar_receipt_ask')}</Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ flex: 1 }}>
          <Button label={t('whatsapp')} onPress={() => send('whatsapp')} />
        </View>
        <View style={{ flex: 1 }}>
          <Button label={t('mc_messages')} variant="glass" onPress={() => send('sms')} />
        </View>
      </View>
    </View>
  );
}
