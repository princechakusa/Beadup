import { Platform, Share } from 'react-native';

/**
 * Shares a message with a link. On iOS the link goes in `url`, so Messages,
 * WhatsApp and the share sheet show a rich preview card (the page's Open
 * Graph image with the Beadup logo) instead of a plain block of text. Android
 * has no `url` field, so the link is appended to the message there.
 */
export function shareLink(message: string, url: string) {
  const p = Platform.OS === 'ios' ? Share.share({ message, url }) : Share.share({ message: `${message} ${url}` });
  return p.catch(() => undefined);
}
