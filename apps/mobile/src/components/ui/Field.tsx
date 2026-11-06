import { useState } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { colors, fonts, radius, space } from '@/theme/tokens';

import { Text } from './Text';

type Props = TextInputProps & { label: string; error?: string | null };

/** Glass text field with a bead-blue focus ring and an inline error. */
export function Field({ label, error, style, ...input }: Props) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ gap: space.xs + 2 }}>
      <Text variant="caption">{label}</Text>
      <TextInput
        {...input}
        accessibilityLabel={label}
        placeholderTextColor="rgba(154,163,178,0.6)"
        selectionColor={colors.bead}
        onFocus={(e) => {
          setFocused(true);
          input.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          input.onBlur?.(e);
        }}
        style={[
          styles.input,
          focused && styles.focused,
          !!error && styles.invalid,
          style,
        ]}
      />
      {!!error && (
        <Text variant="caption" tone="danger" accessibilityLiveRegion="polite">
          {error}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  input: {
    minHeight: 52,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: colors.line,
    color: colors.paint,
    fontFamily: fonts.body,
    fontSize: 16,
  },
  focused: { borderColor: 'rgba(77,216,255,0.6)', backgroundColor: 'rgba(77,216,255,0.06)' },
  invalid: { borderColor: 'rgba(255,138,138,0.6)' },
});
