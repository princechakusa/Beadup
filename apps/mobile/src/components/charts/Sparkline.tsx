import { BlurMask, Canvas, Circle, DashPathEffect, Group, LinearGradient, Path, Skia, vec } from '@shopify/react-native-skia';
import { useEffect, useMemo } from 'react';
import { Easing, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';

import { colors } from '@/theme/tokens';

type Props = {
  /** One value per day, Monday first. Days after `todayIndex` are the future. */
  values: number[];
  todayIndex: number;
  width: number;
  height?: number;
};

/**
 * The glowing earnings curve from the Today card: smooth line through the
 * days so far, soft fill, a glow, a dashed flat line for the days ahead and a
 * dot on today. Draws itself in on mount (instant under Reduce Motion).
 */
export function Sparkline({ values, todayIndex, width, height = 92 }: Props) {
  const reduce = useReducedMotion();
  const progress = useSharedValue(reduce ? 1 : 0);
  useEffect(() => {
    if (!reduce) progress.set(withTiming(1, { duration: 900, easing: Easing.out(Easing.cubic) }));
  }, [reduce, progress]);

  const { line, fill, future, dot } = useMemo(() => {
    const max = Math.max(1, ...values.slice(0, todayIndex + 1));
    const pad = 10;
    const step = width / (values.length - 1);
    const y = (v: number) => height - pad - (v / max) * (height - pad * 2);
    const pts = values.slice(0, todayIndex + 1).map((v, i) => vec(i * step, y(v)));

    const lb = Skia.PathBuilder.Make();
    pts.forEach((p, i) => {
      if (i === 0) return void lb.moveTo(p.x, p.y);
      const prev = pts[i - 1];
      const mid = (prev.x + p.x) / 2;
      lb.cubicTo(mid, prev.y, mid, p.y, p.x, p.y);
    });
    const l = lb.build();
    const last = pts.at(-1) ?? vec(0, height);
    const f = Skia.PathBuilder.MakeFromPath(l).lineTo(last.x, height).lineTo(0, height).close().detach();
    const fu = Skia.PathBuilder.Make().moveTo(last.x, last.y).lineTo(width, last.y).detach();
    return { line: l, fill: f, future: fu, dot: last };
  }, [values, todayIndex, width, height]);

  return (
    <Canvas style={{ width, height }} accessibilityLabel="Earnings this week">
      <Path path={fill} opacity={progress}>
        <LinearGradient start={vec(0, 0)} end={vec(0, height)} colors={['rgba(77,216,255,0.32)', 'rgba(77,216,255,0)']} />
      </Path>
      <Path path={line} style="stroke" strokeWidth={6} color="rgba(77,216,255,0.5)" end={progress}>
        <BlurMask blur={4} style="normal" />
      </Path>
      <Path path={line} style="stroke" strokeWidth={2.5} strokeCap="round" color={colors.bead} end={progress} />
      {todayIndex < values.length - 1 && (
        <Path path={future} style="stroke" strokeWidth={2} color="#3A4250" strokeCap="round" opacity={progress}>
          <DashPathEffect intervals={[3, 6]} />
        </Path>
      )}
      <Group opacity={progress}>
        <Circle cx={dot.x} cy={dot.y} r={11} color="rgba(77,216,255,0.18)" />
        <Circle cx={dot.x} cy={dot.y} r={5} color={colors.paint} />
        <Circle cx={dot.x} cy={dot.y} r={5} style="stroke" strokeWidth={3} color={colors.bead} />
      </Group>
    </Canvas>
  );
}

