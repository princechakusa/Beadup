// Ask for an App Store rating at a happy moment (a job just got paid), at most
// once every 120 days. Apple also rate-limits the prompt itself, and it may not
// show at all; that's fine. Never blocks or throws.
import * as SecureStore from 'expo-secure-store';
import * as StoreReview from 'expo-store-review';

const KEY = 'rating-asked-at';
const GAP_MS = 120 * 24 * 60 * 60 * 1000;

export async function maybeAskForRating(): Promise<void> {
  try {
    const last = Number((await SecureStore.getItemAsync(KEY)) ?? 0);
    if (Date.now() - last < GAP_MS) return;
    if (!(await StoreReview.hasAction())) return;
    await SecureStore.setItemAsync(KEY, String(Date.now()));
    // Let the paid celebration play first.
    setTimeout(() => {
      StoreReview.requestReview().catch(() => {});
    }, 2500);
  } catch {
    // Rating prompts are optional.
  }
}
