// Tactile and audio feedback for the booking flow. Everything here is a no-op
// on the server, on unsupported browsers and when the visitor prefers
// reduced motion.

function reducedMotion(): boolean {
  return typeof window === "undefined" || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

type HapticKind = "select" | "step" | "success";
const PATTERNS: Record<HapticKind, number | number[]> = {
  select: 8,
  step: 12,
  success: [14, 60, 22],
};

/** Short vibration where supported (Android browsers). iOS Safari has no web vibration API. */
export function haptic(kind: HapticKind = "select") {
  if (reducedMotion() || typeof navigator === "undefined" || !("vibrate" in navigator)) return;
  try {
    navigator.vibrate(PATTERNS[kind]);
  } catch {
    // Some browsers throw when called without a recent user gesture.
  }
}

let ctx: AudioContext | null = null;

function audioContext(): AudioContext | null {
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  ctx ??= new AC();
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

/**
 * Call inside a click handler. Browsers (Safari especially) only start audio
 * from a user gesture, and the chime plays later, when the booking confirms.
 */
export function primeAudio() {
  if (reducedMotion()) return;
  try {
    audioContext();
  } catch {
    // ignore
  }
}

/**
 * Two soft water-drop "plinks" rising a fifth, synthesized with WebAudio so no
 * audio file ships. Call from a user gesture (the pay button) so browsers allow it.
 */
export function playBookedChime() {
  if (reducedMotion()) return;
  try {
    const ctx = audioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const master = ctx.createGain();
    master.gain.value = 0.18;
    master.connect(ctx.destination);

    [
      { at: 0, from: 880, to: 1320 },
      { at: 0.14, from: 1320, to: 1980 },
    ].forEach(({ at, from, to }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      // A quick upward pitch glide is what makes a sine read as a water drop.
      osc.frequency.setValueAtTime(from, now + at);
      osc.frequency.exponentialRampToValueAtTime(to, now + at + 0.06);
      gain.gain.setValueAtTime(0.0001, now + at);
      gain.gain.exponentialRampToValueAtTime(1, now + at + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + at + 0.45);
      osc.connect(gain).connect(master);
      osc.start(now + at);
      osc.stop(now + at + 0.5);
    });
  } catch {
    // Audio is decoration; never let it break booking.
  }
}
