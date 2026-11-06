import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

/**
 * The current time as state, so renders stay pure (React Compiler). Updates
 * when the screen gains focus and every `intervalMs` while it is focused.
 */
export function useNow(intervalMs = 60_000): number {
  const [now, setNow] = useState(() => Date.now());
  useFocusEffect(
    useCallback(() => {
      setNow(Date.now());
      const t = setInterval(() => setNow(Date.now()), intervalMs);
      return () => clearInterval(t);
    }, [intervalMs]),
  );
  return now;
}
