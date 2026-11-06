import * as Haptics from 'expo-haptics';

/**
 * Named haptics so every screen feels the same. Fire-and-forget: haptics are
 * decoration and must never throw or block (some devices have no motor).
 */
const safe = (p: Promise<void>) => {
  p.catch(() => {});
};

export const haptic = {
  /** Selecting a chip, toggle or list item. */
  select: () => safe(Haptics.selectionAsync()),
  /** Pressing a button. */
  tap: () => safe(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  /** A heavier physical moment, like the bead landing. */
  thud: () => safe(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft)),
  /** Money received, booking confirmed. */
  success: () => safe(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  warning: () => safe(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
  error: () => safe(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)),
};
