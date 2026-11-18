import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

/**
 * Height of the on-screen keyboard on Android, 0 elsewhere.
 *
 * Why: the app draws edge to edge on Android 15+, so the system no longer
 * resizes the window when the keyboard opens and the keyboard covers the field
 * being typed in. iOS handles this itself (automaticallyAdjustKeyboardInsets).
 * Shrinking the scroll view by this height lets Android scroll the focused
 * field into view. Pure JS, so it ships over the air.
 */
export function useAndroidKeyboardHeight(): number {
  const [height, setHeight] = useState(0);
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const show = Keyboard.addListener('keyboardDidShow', (e) => setHeight(e.endCoordinates.height));
    const hide = Keyboard.addListener('keyboardDidHide', () => setHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return height;
}
