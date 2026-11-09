import { Linking } from 'react-native';

import { Button } from '@/components/ui/Button';
import { fetchReviewLink, useQuery } from '@/lib/data';
import { haptic } from '@/lib/haptics';
import { shareLink } from '@/lib/share';

/**
 * "Ask for a review" on a completed job. Opens the detailer's own Messages app
 * with the client's private review link written in, so it comes from a number
 * the client knows (Beadup itself sends no texts yet). Falls back to the share
 * sheet. Shows "Review received" once the client has rated the job.
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
  if (link.data.reviewed) return <Button label="Review received · thank you" variant="ghost" disabled onPress={() => {}} />;

  const first = clientName.split(' ')[0] || 'there';
  const message = `Hi ${first}, thanks for choosing ${businessName}! If you have 30 seconds, a quick rating helps a lot: ${link.data.url}`;

  const ask = async () => {
    haptic.select();
    // iOS: sms:<number>&body=<text> opens a new message to the client.
    const sms = `sms:${clientPhone}&body=${encodeURIComponent(message)}`;
    try {
      if (clientPhone && (await Linking.canOpenURL(sms))) return await Linking.openURL(sms);
    } catch {
      // fall through to the share sheet
    }
    shareLink(`Hi ${first}, thanks for choosing ${businessName}! If you have 30 seconds, a quick rating helps a lot:`, link.data!.url);
  };

  return <Button label="Ask for a review" variant="glass" onPress={ask} />;
}
