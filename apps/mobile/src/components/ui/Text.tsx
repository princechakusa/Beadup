import { Text as RNText, type TextProps } from 'react-native';

import { colors, type as typeScale } from '@/theme/tokens';

type Variant = keyof typeof typeScale;
type Tone = 'paint' | 'steel' | 'bead' | 'gold' | 'danger' | 'beadInk';

export type AppTextProps = TextProps & { variant?: Variant; tone?: Tone };

/** All text in the app goes through this, so the type scale stays consistent. */
export function Text({ variant = 'body', tone, style, ...rest }: AppTextProps) {
  const defaultTone: Tone = variant === 'money' ? 'gold' : variant === 'caption' || variant === 'eyebrow' ? 'steel' : 'paint';
  return (
    <RNText
      {...rest}
      style={[
        typeScale[variant],
        { color: colors[tone ?? defaultTone] },
        variant === 'eyebrow' && { textTransform: 'uppercase' },
        style,
      ]}
    />
  );
}
