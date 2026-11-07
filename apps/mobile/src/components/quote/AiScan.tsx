import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import { LiquidBead } from '@/components/bead/LiquidBead';
import { Button } from '@/components/ui/Button';
import { GlassCard } from '@/components/ui/GlassCard';
import { Icon } from '@/components/ui/Icon';
import { Badge } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { hasAiConsent, MAX_PHOTOS, pickPhotos, suggestFromPhotos, takePhoto, uploadPhotos, type AiSuggestion } from '@/lib/ai';
import { ApiError } from '@/lib/data';
import { haptic } from '@/lib/haptics';
import { colors, space } from '@/theme/tokens';

const ERRORS: Record<string, string> = {
  not_a_vehicle: 'Those photos don’t look like a vehicle. Try photos of the car itself.',
  ai_declined: 'The AI couldn’t help with these photos. Build the quote by hand below.',
  rate_limited: 'You’ve used a lot of AI scans this hour. Try again later or build the quote by hand.',
  consent_required: 'Turn on AI photo quotes first.',
};

/** "AI scan": photos in, suggested service and add-ons out (an estimate the detailer reviews). */
export function AiScan({ onSuggestion }: { onSuggestion: (s: AiSuggestion) => void }) {
  const [consent, setConsent] = useState<boolean | null>(null);
  const [uris, setUris] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AiSuggestion | null>(null);

  // Re-check after returning from the consent screen.
  useFocusEffect(
    useCallback(() => {
      hasAiConsent().then(setConsent).catch(() => setConsent(false));
    }, []),
  );

  const add = async (source: 'library' | 'camera') => {
    haptic.select();
    const picked = source === 'library' ? await pickPhotos(MAX_PHOTOS - uris.length) : [await takePhoto()].filter((u): u is string => !!u);
    setUris((xs) => [...xs, ...picked].slice(0, MAX_PHOTOS));
    setResult(null);
  };

  const scan = async () => {
    setBusy(true);
    setError(null);
    try {
      const paths = await uploadPhotos(uris);
      const s = await suggestFromPhotos(paths, '');
      haptic.success();
      setResult(s);
      onSuggestion(s);
    } catch (e) {
      haptic.error();
      const code = e instanceof ApiError ? (e.body as { error?: string } | null)?.error : undefined;
      setError((code && ERRORS[code]) ?? 'The AI scan didn’t go through. Check your connection or build the quote by hand.');
    } finally {
      setBusy(false);
    }
  };

  if (consent === false) {
    return (
      <GlassCard>
        <View style={{ gap: space.md }}>
          <View style={styles.row}>
            <Icon name="sparkle" size={20} color={colors.bead} />
            <Text variant="bodyStrong">Quote from photos</Text>
          </View>
          <Text variant="caption">Snap the car and get a suggested quote from your own prices. You review it before it’s sent.</Text>
          <Button label="Turn on AI photo quotes" variant="glass" onPress={() => router.push('/ai-consent')} />
        </View>
      </GlassCard>
    );
  }
  if (consent === null) return null;

  return (
    <GlassCard glowing={!!result}>
      <View style={{ gap: space.md }}>
        <View style={[styles.row, { justifyContent: 'space-between' }]}>
          <View style={styles.row}>
            <Icon name="sparkle" size={20} color={colors.bead} />
            <Text variant="bodyStrong">AI scan</Text>
          </View>
          <Text variant="caption">
            {uris.length}/{MAX_PHOTOS} photos
          </Text>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {uris.map((u, i) => (
            <Animated.View key={u} entering={FadeIn}>
              <Image source={{ uri: u }} style={styles.thumb} contentFit="cover" accessibilityLabel={`Photo ${i + 1}`} />
              <Pressable
                onPress={() => setUris((xs) => xs.filter((x) => x !== u))}
                accessibilityRole="button"
                accessibilityLabel={`Remove photo ${i + 1}`}
                hitSlop={6}
                style={styles.remove}>
                <Icon name="close" size={12} strokeWidth={2.6} />
              </Pressable>
            </Animated.View>
          ))}
          {uris.length < MAX_PHOTOS && (
            <>
              <Pressable onPress={() => add('camera')} style={styles.add} accessibilityRole="button" accessibilityLabel="Take a photo">
                <Icon name="camera" size={22} color={colors.bead} />
              </Pressable>
              <Pressable onPress={() => add('library')} style={styles.add} accessibilityRole="button" accessibilityLabel="Choose photos">
                <Icon name="plus" size={22} color={colors.bead} />
              </Pressable>
            </>
          )}
        </ScrollView>

        {busy ? (
          <View style={styles.scanning} accessibilityLiveRegion="polite">
            <LiquidBead size={56} interactive={false} dropIn={false} />
            <Text variant="caption">Looking at the photos…</Text>
          </View>
        ) : (
          uris.length > 0 && !result && <Button label="Suggest a quote" onPress={scan} />
        )}

        {error && (
          <Text variant="caption" tone="danger" accessibilityLiveRegion="polite">
            {error}
          </Text>
        )}

        {result && (
          <Animated.View entering={FadeInDown.springify()} style={{ gap: space.sm }}>
            <View style={[styles.row, { flexWrap: 'wrap', gap: 6 }]}>
              <Badge label={result.mock ? 'Sample estimate' : 'AI estimate'} tone="bead" />
              <Badge label={`${result.confidence} confidence`} tone={result.confidence === 'high' ? 'success' : 'steel'} />
            </View>
            <Text variant="bodyStrong">{result.vehicleDescription}</Text>
            <View style={[styles.row, { flexWrap: 'wrap', gap: 6 }]}>
              {result.conditions.map((c) => (
                <View key={`${c.label}-${c.area}`} style={styles.condition}>
                  <Text variant="caption" style={{ color: colors.paint }}>
                    {c.label} · {c.area}
                  </Text>
                </View>
              ))}
            </View>
            {!!result.note && <Text variant="caption">{result.note}</Text>}
            <Text variant="caption" tone="bead">
              Filled in below from your prices. Check everything before you send it.
            </Text>
          </Animated.View>
        )}
      </View>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  thumb: { width: 76, height: 76, borderRadius: 16, backgroundColor: colors.gunmetal },
  remove: { position: 'absolute', top: 4, right: 4, width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(10,12,16,0.8)', alignItems: 'center', justifyContent: 'center' },
  add: { width: 76, height: 76, borderRadius: 16, borderWidth: 1, borderStyle: 'dashed', borderColor: 'rgba(77,216,255,0.5)', alignItems: 'center', justifyContent: 'center' },
  scanning: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  condition: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: colors.line },
});
