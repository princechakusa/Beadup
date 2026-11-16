import { LinearGradient } from 'expo-linear-gradient';

/** Expo web preview only: Skia needs extra loading on the web, so the glow is a plain gradient. */
export function GoldGlow() {
  return (
    <LinearGradient
      pointerEvents="none"
      colors={['rgba(255,181,71,0.16)', 'rgba(255,181,71,0)']}
      style={{ position: 'absolute', right: -110, top: -120, width: 280, height: 280, borderRadius: 140 }}
    />
  );
}
