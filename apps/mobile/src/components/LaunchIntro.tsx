import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import * as Updates from 'expo-updates';
import { useEffect } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { haptic } from '@/lib/haptics';
import { colors, fonts } from '@/theme/tokens';

/*
 * The app opening (cold start only). Two versions, same timeline as the
 * design preview (claude.ai artifact "Beadup Launch Animation"):
 *
 * A: starts on the exact frame of the native launch screen (the 3D bead
 *    render at 200 pt, centred), then Touch (wobble + ripple, light haptic),
 *    Shine, Name (bead slides aside, wordmark rises), Open (bead lifts into
 *    the glow, the app underneath is revealed, soft haptic).
 * B: the launch screen is plain Midnight; a drop falls, lands, throws
 *    droplets that roll back in, then the same sequence.
 *
 * B needs a plain launch screen, which only a store build can change, so the
 * version is chosen by the binary's runtime: 1.0.0 (launch screen = bead
 * image) plays A; later builds (plain launch screen, see docs/HANDOFF.md)
 * play B. The app is mounted underneath the whole time, so data loads in
 * parallel and nothing waits on the animation.
 */

const SPLASH = require('../../assets/images/splash-icon.png');
const IMG = 200; // expo-splash-screen imageWidth
// The main bead inside the 200 pt image (measured from the 512 px render).
const BEAD = { left: 20, top: 32, width: 133, height: 118 };
const ORIGIN_Y = '75%'; // the bead's contact line, so squashes spread along the paint
const BEAD_CX = BEAD.left + BEAD.width / 2; // 86.5: the bead sits left of the image centre
// Final lockup: the scaled bead's centre lines up with the wordmark's middle.
// Scaling 0.33 around (100, 150) puts the bead centre at (95.5, 130.5); these
// move it to 15.5 pt from the image's left edge and level with the letters.
const LOCK = { scale: 0.33, x: -80, y: -34.5 };

export const INTRO_VARIANT: 'A' | 'B' = Updates.runtimeVersion && Updates.runtimeVersion !== '1.0.0' ? 'B' : 'A';
const TOTAL = { A: 1750, B: 1930, R: 450 } as const;
const OFFSET_B = 180; // B's sequence time = t - 180 after the 380 ms fall

function clamp(x: number, a = 0, b = 1) {
  'worklet';
  return Math.min(b, Math.max(a, x));
}
function prog(t: number, a: number, d: number) {
  'worklet';
  return clamp((t - a) / d);
}
function easeOut(x: number) {
  'worklet';
  return 1 - Math.pow(1 - x, 3);
}
function easeInOut(x: number) {
  'worklet';
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}
function easeIn(x: number) {
  'worklet';
  return x * x;
}
/** Sequence time: A plays from 0; B's sequence starts at impact. */
function seq(t: number, b: boolean) {
  'worklet';
  return b ? t - OFFSET_B : t;
}

export function LaunchIntro({ onImageReady, onDone }: { onImageReady: () => void; onDone: () => void }) {
  const reduce = useReducedMotion();
  const { width: W, height: H } = useWindowDimensions();
  const b = INTRO_VARIANT === 'B' && !reduce;
  const total = reduce ? TOTAL.R : TOTAL[INTRO_VARIANT];
  const t = useSharedValue(0);
  const started = useSharedValue(0);

  const start = () => {
    if (started.get()) return;
    started.set(1);
    t.set(withTiming(total, { duration: total, easing: Easing.linear }, (fin) => fin && runOnJS(onDone)()));
    if (!reduce) {
      setTimeout(() => haptic.tap(), b ? 380 : 200);
      setTimeout(() => haptic.thud(), (b ? OFFSET_B : 0) + 1560);
    }
  };
  // Safety net: never hold the app if the image is slow to decode.
  useEffect(() => {
    const id = setTimeout(() => {
      onImageReady();
      start();
    }, 600);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Whole overlay: fades away during Open, revealing the app underneath.
  const overlay = useAnimatedStyle(() => {
    const tt = t.get();
    if (reduce) return { opacity: 1 - easeInOut(prog(tt, 0, 450)) };
    const s = seq(tt, b);
    return { opacity: 1 - easeInOut(prog(s, 1250, 450)) };
  });

  // The bead (the launch-screen render itself).
  const bead = useAnimatedStyle(() => {
    const tt = t.get();
    if (reduce) return { opacity: 1, transform: [] };
    if (b && tt < 380) {
      const f = easeIn(tt / 380);
      return {
        opacity: 1,
        transform: [{ translateY: (-H / 2 - 60) * (1 - f) }, { scaleX: 0.42 }, { scaleY: 0.42 * (1 + 0.6 * f) }],
      };
    }
    const s = seq(tt, b);
    const e = Math.max(0, s - 200);
    const amp = s >= 200 ? Math.exp(-e / (b ? 150 : 170)) : 0;
    const wob = Math.cos(e / 50);
    const k = b ? 1.75 : 1;
    const nm = easeInOut(prog(s, 650, 450));
    const open = easeInOut(prog(s, 1150, 600));
    // B: the drop spreads out to full size as it lands (no size jump).
    const grow = b ? 0.5 + 0.5 * easeOut(prog(s, 200, 160)) : 1;
    const scale = (1 - (1 - LOCK.scale) * nm) * grow;
    return {
      opacity: 1 - easeIn(open),
      transform: [
        { translateX: LOCK.x * nm * (1 - open) },
        { translateY: LOCK.y * nm * (1 - open) - (H / 2 - 110) * open },
        { scaleX: scale * (1 + 0.2 * k * amp * wob) * (1 + 0.4 * open) },
        { scaleY: scale * (1 - 0.18 * k * amp * wob) * (1 + 0.4 * open) },
      ],
    };
  });

  // Specular sweep across the bead.
  const sweep = useAnimatedStyle(() => {
    const s = seq(t.get(), b);
    const p = easeInOut(prog(s, 450, 450));
    const on = !reduce && s >= 450 && s <= 900;
    return {
      opacity: on ? Math.sin(Math.PI * p) : 0,
      transform: [{ translateX: -BEAD.width + p * BEAD.width * 2 }, { rotate: '20deg' }],
    };
  });

  const ripple1 = useRipple(t, b, reduce, 200, 0.55);
  const ripple2 = useRipple(t, b, reduce, 340, 0.3);

  // Today's ambient glow, which the bead becomes.
  const glow = useAnimatedStyle(() => {
    const tt = t.get();
    const s = reduce ? 0 : seq(tt, b);
    return { opacity: reduce ? 0 : 0.9 * easeInOut(prog(s, 1150, 400)) };
  });

  const letters = 'beadup'.split('');
  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, styles.root, overlay]}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      <Animated.View style={[styles.glow, glow]}>
        <LinearGradient colors={['rgba(77,216,255,0.32)', 'rgba(77,216,255,0)']} style={StyleSheet.absoluteFill} />
      </Animated.View>

      <View style={[styles.center, { top: H / 2 - IMG / 2, left: W / 2 - IMG / 2 }]}>
        <Animated.View style={[styles.ripple, ripple1]} />
        <Animated.View style={[styles.ripple, ripple2]} />
        <Animated.View style={[{ width: IMG, height: IMG, transformOrigin: ['50%', ORIGIN_Y, 0] }, bead]}>
          <Image
            source={SPLASH}
            style={{ width: IMG, height: IMG }}
            contentFit="contain"
            onLoad={() => {
              onImageReady();
              start();
            }}
          />
          <View style={styles.beadMask}>
            <Animated.View style={[styles.sweep, sweep]}>
              <LinearGradient
                colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.55)', 'rgba(255,255,255,0)']}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={StyleSheet.absoluteFill}
              />
            </Animated.View>
          </View>
        </Animated.View>
        {b && <Droplets t={t} />}
      </View>

      <View style={[styles.word, { top: H / 2 - 30, left: W / 2 - 52 }]}>
        <View style={{ flexDirection: 'row' }}>
          {letters.map((ch, i) => (
            <Letter key={i} ch={ch} i={i} t={t} b={b} reduce={reduce} />
          ))}
        </View>
        <Tagline t={t} b={b} reduce={reduce} />
      </View>
    </Animated.View>
  );
}

function useRipple(t: SharedValue<number>, b: boolean, reduce: boolean, at: number, strength: number) {
  return useAnimatedStyle(() => {
    const s = seq(t.get(), b);
    const q = prog(s, at, 820);
    const on = !reduce && s >= at && q < 1;
    const sc = 1.1 + 2.8 * easeOut(q);
    return {
      opacity: on ? strength * Math.pow(1 - q, 1.5) : 0,
      transform: [{ scaleX: sc }, { scaleY: sc * 0.26 }],
    };
  });
}

function Letter({ ch, i, t, b, reduce }: { ch: string; i: number; t: SharedValue<number>; b: boolean; reduce: boolean }) {
  const style = useAnimatedStyle(() => {
    if (reduce) return { opacity: 0 };
    const s = seq(t.get(), b);
    const o = easeOut(prog(s, 720 + i * 40, 380));
    const open = easeInOut(prog(s, 1150, 600));
    return {
      opacity: o * (1 - open),
      transform: [{ translateY: 14 * (1 - o) - 22 * open }, { scale: 0.92 + 0.08 * o }],
    };
  });
  return <Animated.Text style={[styles.letter, style]}>{ch}</Animated.Text>;
}

function Tagline({ t, b, reduce }: { t: SharedValue<number>; b: boolean; reduce: boolean }) {
  const style = useAnimatedStyle(() => {
    if (reduce) return { opacity: 0 };
    const s = seq(t.get(), b);
    const open = easeInOut(prog(s, 1150, 600));
    return {
      opacity: easeOut(prog(s, 950, 300)) * (1 - open),
      transform: [{ translateY: -22 * open }],
    };
  });
  return <Animated.Text style={[styles.tag, style]}>QUOTE · BOOK · GET PAID</Animated.Text>;
}

/** B: droplets thrown off at impact that roll back into the bead. */
function Droplets({ t }: { t: SharedValue<number> }) {
  const spots = [
    [-1, -0.55, 13],
    [1, -0.7, 15],
    [-0.62, -1.05, 10],
    [0.7, -1, 11],
  ] as const;
  return (
    <>
      {spots.map(([dx, dy, size], i) => (
        <Droplet key={i} t={t} dx={dx} dy={dy} size={size} />
      ))}
    </>
  );
}

function Droplet({ t, dx, dy, size }: { t: SharedValue<number>; dx: number; dy: number; size: number }) {
  const style = useAnimatedStyle(() => {
    const s = t.get() - OFFSET_B;
    const q = prog(s, 200, 520);
    const on = s >= 200 && q < 1;
    const out = Math.sin(Math.PI * Math.min(1, q * 1.15));
    return {
      opacity: on ? 1 - q * 0.5 : 0,
      transform: [{ translateX: dx * 82 * out }, { translateY: dy * 52 * out + 26 * q * q }, { scale: 1 - 0.4 * q }],
    };
  });
  return (
    <Animated.View
      style={[
        styles.droplet,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          left: BEAD_CX - size / 2,
          top: 150 - size,
        },
        style,
      ]}>
      <LinearGradient
        colors={['#E8FBFF', colors.bead, colors.beadDeep]}
        start={{ x: 0.3, y: 0.2 }}
        end={{ x: 0.8, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: colors.midnight, zIndex: 1000, elevation: 1000 },
  glow: { position: 'absolute', top: 0, left: 0, right: 0, height: 420 },
  center: { position: 'absolute', width: IMG, height: IMG },
  ripple: {
    position: 'absolute',
    left: BEAD_CX - 22,
    top: 150 - 22,
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: colors.bead,
  },
  beadMask: {
    position: 'absolute',
    left: BEAD.left,
    top: BEAD.top,
    width: BEAD.width,
    height: BEAD.height,
    borderRadius: BEAD.width / 2,
    overflow: 'hidden',
  },
  sweep: {
    position: 'absolute',
    top: -40,
    bottom: -40,
    width: 44,
    left: BEAD.width / 2 - 22,
  },
  droplet: { position: 'absolute', overflow: 'hidden' },
  word: { position: 'absolute', gap: 6 },
  letter: {
    fontFamily: fonts.displayHeavy,
    fontSize: 46,
    lineHeight: 52,
    letterSpacing: -2,
    color: colors.paint,
  },
  tag: {
    fontFamily: fonts.bodySemi,
    fontSize: 10.5,
    letterSpacing: 1.8,
    color: colors.steel,
  },
});
