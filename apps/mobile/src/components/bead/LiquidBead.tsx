import {
  BlurMask,
  Canvas,
  Group,
  LinearGradient,
  Oval,
  Path,
  RadialGradient,
  Skia,
  vec,
} from '@shopify/react-native-skia';
import { useEffect, useMemo } from 'react';
import { Pressable } from 'react-native';
import {
  Easing,
  SensorType,
  useAnimatedReaction,
  useAnimatedSensor,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { haptic } from '@/lib/haptics';
import { colors } from '@/theme/tokens';

type Props = {
  size?: number;
  /** Drop in from above on mount, squash on landing. */
  dropIn?: boolean;
  /** Tap to make it splash. */
  interactive?: boolean;
};

// Drawn in a 120x120 box: a sessile water drop, flattened where it sits.
const DROP = 'M60 8 C88 8 110 30 110 60 C110 86 92 104 60 104 C28 104 10 86 10 60 C10 30 32 8 60 8Z';

/**
 * The Beadup water bead, like water beading on fresh ceramic coating:
 * refracted interior, a caustic where light focuses through the drop, a rim
 * light, and a highlight that follows the phone's tilt (gravity sensor).
 * Breathes gently at rest; respects Reduce Motion.
 */
export function LiquidBead({ size = 140, dropIn = true, interactive = true }: Props) {
  const reduce = useReducedMotion();
  const live = !reduce;
  const k = size / 120;

  const drop = useMemo(() => Skia.Path.MakeFromSVGString(DROP)!, []);
  const band1 = useMemo(() => Skia.Path.MakeFromSVGString('M8 74 Q60 58 112 74')!, []);
  const band2 = useMemo(() => Skia.Path.MakeFromSVGString('M14 86 Q60 74 106 86')!, []);

  const sensor = useAnimatedSensor(SensorType.GRAVITY, { interval: 32 });
  const breathe = useSharedValue(0);
  const squish = useSharedValue(0); // >0 flattens, <0 stretches
  const fall = useSharedValue(dropIn && live ? -70 : 0);

  useEffect(() => {
    if (!live) return;
    breathe.set(withRepeat(withTiming(Math.PI * 2, { duration: 3400, easing: Easing.linear }), -1, false));
    if (dropIn) {
      squish.set(-0.18);
      fall.set(withSpring(0, { damping: 13, stiffness: 320, mass: 0.8 }, (done) => {
        if (!done) return;
        scheduleOnRN(haptic.thud);
        squish.set(
          withSequence(withTiming(0.22, { duration: 90 }), withSpring(0, { damping: 6, stiffness: 300, mass: 0.6 })),
        );
      }));
    }
  }, [live, dropIn, breathe, squish, fall]);

  // Tilt in -1..1, chased by a spring so the light glides like liquid.
  // Gravity is ~9.81 m/s^2 along whichever axis points down; +0.6 centres the
  // highlight for a phone held at a normal reading angle.
  const tiltX = useSharedValue(0);
  const tiltY = useSharedValue(0);
  useAnimatedReaction(
    () => sensor.sensor.get(),
    (g) => {
      if (!live) return;
      const clamp = (v: number) => Math.max(-1, Math.min(1, v));
      const cfg = { damping: 14, stiffness: 90 };
      tiltX.set(withSpring(clamp(g.x / 9.81), cfg));
      tiltY.set(withSpring(clamp(g.y / 9.81 + 0.6), cfg));
    },
  );

  const body = useDerivedValue(() => {
    const wobble = live ? Math.sin(breathe.get()) * 0.022 : 0;
    const s = squish.get();
    return [
      { translateY: fall.get() * k },
      { scaleX: 1 + wobble + s * 0.9 },
      { scaleY: 1 - wobble - s },
    ];
  });
  const highlight = useDerivedValue(() => [{ translateX: tiltX.get() * 9 }, { translateY: -tiltY.get() * 7 }]);
  const caustic = useDerivedValue(() => [{ translateX: -tiltX.get() * 7 }, { translateY: tiltY.get() * 3 }]);

  const splash = () => {
    if (!interactive) return;
    haptic.thud();
    if (!live) return;
    squish.set(withSequence(
      withTiming(0.26, { duration: 80 }),
      withSpring(-0.08, { damping: 5, stiffness: 340 }),
      withDelay(40, withSpring(0, { damping: 8, stiffness: 220 })),
    ));
  };

  return (
    <Pressable
      onPress={splash}
      disabled={!interactive}
      accessibilityRole={interactive ? 'button' : 'image'}
      accessibilityLabel="Beadup water bead"
      hitSlop={8}>
      <Canvas style={{ width: size, height: size * 1.04 }}>
        <Group transform={[{ scale: k }]}>
          {/* Contact shadow and the glow the bead throws on the paint */}
          <Oval x={20} y={102} width={80} height={12} color="rgba(0,0,0,0.5)">
            <BlurMask blur={4} style="normal" />
          </Oval>
          <Oval x={30} y={101} width={60} height={8} color="rgba(77,216,255,0.22)">
            <BlurMask blur={3} style="normal" />
          </Oval>

          <Group transform={body} origin={vec(60, 104)}>
            <Path path={drop}>
              <RadialGradient c={vec(54, 46)} r={84} colors={['#1B4A5C', '#0E2730', '#061318']} positions={[0, 0.6, 1]} />
            </Path>

            {/* Refracted world: bent, flipped bands of light inside the drop */}
            <Group clip={drop} opacity={0.5}>
              <Path path={band1} style="stroke" strokeWidth={2} color="#9AE9FF" opacity={0.6} />
              <Path path={band2} style="stroke" strokeWidth={1.5} color={colors.bead} opacity={0.5} />
            </Group>

            {/* Caustic: light focused through the bead lands low, opposite the highlight */}
            <Group clip={drop} transform={caustic}>
              <Oval x={34} y={77} width={52} height={22}>
                <RadialGradient
                  c={vec(60, 88)}
                  r={26}
                  colors={['rgba(185,242,255,0.9)', 'rgba(77,216,255,0.35)', 'rgba(77,216,255,0)']}
                />
              </Oval>
            </Group>

            {/* Rim light */}
            <Path path={drop} style="stroke" strokeWidth={1.6}>
              <LinearGradient
                start={vec(60, 8)}
                end={vec(60, 104)}
                colors={['rgba(232,251,255,0.9)', 'rgba(77,216,255,0.3)', 'rgba(77,216,255,0.85)']}
              />
            </Path>

            {/* Specular highlight */}
            <Group transform={highlight}>
              <Group transform={[{ rotate: -0.49 }]} origin={vec(42, 32)}>
                <Oval x={29} y={24} width={26} height={16} color="rgba(255,255,255,0.85)">
                  <BlurMask blur={1.6} style="normal" />
                </Oval>
              </Group>
              <Oval x={75.6} y={23.6} width={4.8} height={4.8} color="rgba(255,255,255,0.7)" />
            </Group>
          </Group>
        </Group>
      </Canvas>
    </Pressable>
  );
}
