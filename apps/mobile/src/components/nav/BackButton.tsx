import { router } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';

import { Icon } from '@/components/ui/Icon';
import { haptic } from '@/lib/haptics';
import { colors } from '@/theme/tokens';

/** Round glass back / close button for pushed and modal screens. */
export function BackButton({ variant = 'close' }: { variant?: 'close' | 'back' }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={variant === 'close' ? 'Close' : 'Back'}
      hitSlop={8}
      onPress={() => {
        haptic.select();
        if (router.canGoBack()) router.back();
        else router.replace('/');
      }}
      style={styles.btn}>
      <Icon name={variant === 'close' ? 'close' : 'chevronLeft'} size={20} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.gunmetal, borderWidth: 1, borderColor: '#262B35', alignItems: 'center', justifyContent: 'center' },
});
