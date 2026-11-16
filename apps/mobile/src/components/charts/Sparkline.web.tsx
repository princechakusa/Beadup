import Svg, { Circle, Path } from 'react-native-svg';

import { colors } from '@/theme/tokens';

type Props = { values: number[]; todayIndex: number; width: number; height?: number };

/** Expo web preview only: the same curve drawn with SVG (the native version uses Skia). */
export function Sparkline({ values, todayIndex, width, height = 92 }: Props) {
  const max = Math.max(1, ...values.slice(0, todayIndex + 1));
  const pad = 10;
  const step = width / (values.length - 1);
  const y = (v: number) => height - pad - (v / max) * (height - pad * 2);
  const pts = values.slice(0, todayIndex + 1).map((v, i) => [i * step, y(v)] as const);
  const d = pts
    .map(([x, py], i) => {
      if (i === 0) return `M${x} ${py}`;
      const [px, ppy] = pts[i - 1];
      const mid = (px + x) / 2;
      return `C${mid} ${ppy} ${mid} ${py} ${x} ${py}`;
    })
    .join(' ');
  const last = pts[pts.length - 1];
  return (
    <Svg width={width} height={height}>
      <Path d={d} stroke={colors.gold} strokeWidth={2.5} fill="none" strokeLinecap="round" />
      {last ? <Circle cx={last[0]} cy={last[1]} r={4} fill={colors.gold} /> : null}
    </Svg>
  );
}
