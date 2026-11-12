import { View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { fetchReviewLink, useQuery } from '@/lib/data';
import { haptic } from '@/lib/haptics';
import { sendMessage, type Channel } from '@/lib/messaging';

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

  const first = clientName.split(' ')[0] || 'there';
  const reviewed = link.data.reviewed;
  const message = reviewed
    ? `Hi ${first}, here's your receipt from ${businessName}: ${link.data.url}`
    : `Hi ${first}, thanks for choosing ${businessName}! Here's your receipt, and if you have 30 seconds, a quick rating helps a lot: ${link.data.url}`;

  const send = (channel: Channel) => {
    haptic.select();
    return sendMessage(channel, clientPhone, message);
  };

  return (
    <View style={{ gap: 8 }}>
      <Text variant="eyebrow">{reviewed ? 'Receipt · review received, thank you' : 'Send receipt and ask for a rating'}</Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ flex: 1 }}>
          <Button label="WhatsApp" onPress={() => send('whatsapp')} />
        </View>
        <View style={{ flex: 1 }}>
          <Button label="Messages" variant="glass" onPress={() => send('sms')} />
        </View>
      </View>
    </View>
  );
}
