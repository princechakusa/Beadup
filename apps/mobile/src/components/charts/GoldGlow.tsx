import { Canvas, Circle, RadialGradient, vec } from '@shopify/react-native-skia';

export function GoldGlow() {
  const size = 280;
  return (
    <Canvas pointerEvents="none" style={{ position: 'absolute', right: -size / 2 + 30, top: -size / 2 + 20, width: size, height: size }}>
      <Circle cx={size / 2} cy={size / 2} r={size / 2}>
        <RadialGradient c={vec(size / 2, size / 2)} r={size / 2} colors={['rgba(255,181,71,0.20)', 'rgba(255,181,71,0.07)', 'rgba(255,181,71,0)']} positions={[0, 0.45, 1]} />
      </Circle>
    </Canvas>
  );
}
