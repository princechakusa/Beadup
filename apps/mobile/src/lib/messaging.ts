// Messages to clients go from the detailer's own phone, in the app the client
// already uses: WhatsApp or Messages. Beadup writes the text (time, price,
// links); the detailer taps send. Free, no WhatsApp Business API, no SMS fees,
// and the client sees a number they know.
import { Linking, Share } from 'react-native';

export type Channel = 'whatsapp' | 'sms';

/** WhatsApp's click-to-chat link: digits only, message prefilled and editable. */
export function whatsappUrl(e164: string, text: string): string {
  return `https://wa.me/${e164.replace(/\D/g, '')}?text=${encodeURIComponent(text)}`;
}

/** iOS Messages: sms:<number>&body=<text>. */
export function smsUrl(e164: string, text: string): string {
  return `sms:${e164}&body=${encodeURIComponent(text)}`;
}

/** Opens the chat with the text written in. Falls back to the share sheet. */
export async function sendMessage(channel: Channel, phone: string, text: string): Promise<void> {
  const url = channel === 'whatsapp' ? whatsappUrl(phone, text) : smsUrl(phone, text);
  try {
    if (phone && (channel === 'whatsapp' || (await Linking.canOpenURL(url)))) {
      await Linking.openURL(url);
      return;
    }
  } catch {
    // fall through to the share sheet
  }
  await Share.share({ message: text }).catch(() => undefined);
}
