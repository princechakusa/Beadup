import { Image } from 'expo-image';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { BackButton } from '@/components/nav/BackButton';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { useQuery } from '@/lib/data';
import { haptic } from '@/lib/haptics';
import { addWork, fetchMedia, MAX_WORK, pickPhoto, removeWork, setProfilePhoto, setWorkCaption, type WorkItem } from '@/lib/media';
import { colors, fonts, space } from '@/theme/tokens';

/**
 * Settings: your photo and photos of your work, shown on your booking page.
 * Clients book a stranger to come to their home; a face and real results are
 * what make them trust a link over a phone call.
 */
export default function MediaSettings() {
  const media = useQuery(fetchMedia, [], 'profile-media');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const work = media.data?.work ?? [];

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    setError(null);
    try {
      await fn();
      haptic.success();
      await media.refresh();
    } catch {
      haptic.error();
      setError('That didn’t save. Check your connection and try again.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <Screen title="Photo and your work" tabs={false} right={<BackButton variant="back" />} onRefresh={media.refresh} refreshing={media.loading && !!media.data}>
      <Text variant="caption" style={styles.lead}>
        Clients see these on your booking page. A friendly photo of you and a few before-and-afters help a new client say yes.
      </Text>

      <View style={styles.card}>
        <Text variant="bodyStrong">Your photo</Text>
        <View style={styles.photoRow}>
          {media.data?.photoUrl ? (
            <Image source={{ uri: media.data.photoUrl }} style={styles.avatar} contentFit="cover" accessibilityLabel="Your photo" />
          ) : (
            <View style={[styles.avatar, styles.avatarEmpty]}>
              <Icon name="camera" size={22} color={colors.steel} />
            </View>
          )}
          <View style={{ flex: 1, gap: space.sm }}>
            <Button
              label={media.data?.photoUrl ? 'Change photo' : 'Add your photo'}
              variant="glass"
              loading={busy === 'photo'}
              onPress={async () => {
                const uri = await pickPhoto([1, 1]);
                if (uri) await run('photo', () => setProfilePhoto(uri, media.data?.photoPath ?? null));
              }}
            />
            {!!media.data?.photoPath && (
              <Button label="Remove" variant="ghost" loading={busy === 'photo-off'} onPress={() => run('photo-off', () => setProfilePhoto(null, media.data?.photoPath ?? null))} />
            )}
          </View>
        </View>
        <Text variant="caption" style={{ fontSize: 13 }}>
          Your face or your logo, clear and well lit. Square photos work best.
        </Text>
      </View>

      <View style={styles.card}>
        <View style={styles.head}>
          <Text variant="bodyStrong">Your work</Text>
          <Text variant="caption">
            {work.length} of {MAX_WORK}
          </Text>
        </View>
        {work.map((item) => (
          <WorkRow key={item.id} item={item} busy={busy === item.id} onRemove={() => run(item.id, () => removeWork(item))} onCaption={(c) => run(item.id, () => setWorkCaption(item.id, c))} />
        ))}
        {work.length < MAX_WORK && (
          <Button
            label="Add a photo of your work"
            loading={busy === 'add'}
            onPress={async () => {
              const uri = await pickPhoto([4, 3]);
              if (uri) await run('add', () => addWork(uri, ''));
            }}
          />
        )}
        <Text variant="caption" style={{ fontSize: 13 }}>
          Real jobs you did: a shiny finish, a clean interior, before and after. No people’s faces or number plates.
        </Text>
      </View>

      {error && (
        <Text variant="caption" tone="danger" accessibilityLiveRegion="polite">
          {error}
        </Text>
      )}
    </Screen>
  );
}

function WorkRow({ item, busy, onRemove, onCaption }: { item: WorkItem; busy: boolean; onRemove: () => void; onCaption: (c: string) => void }) {
  const [caption, setCaption] = useState(item.caption);
  return (
    <View style={styles.workRow}>
      {item.url ? <Image source={{ uri: item.url }} style={styles.thumb} contentFit="cover" accessibilityLabel={caption || 'Photo of your work'} /> : <View style={styles.thumb} />}
      <TextInput
        value={caption}
        onChangeText={setCaption}
        onEndEditing={() => caption !== item.caption && onCaption(caption)}
        placeholder="Caption, e.g. Ceramic coat, black Hilux"
        placeholderTextColor={colors.steel}
        maxLength={80}
        style={styles.caption}
        accessibilityLabel="Caption"
      />
      <Pressable onPress={onRemove} disabled={busy} hitSlop={8} accessibilityRole="button" accessibilityLabel="Remove this photo" style={styles.remove}>
        <Icon name="trash" size={18} color={busy ? colors.steel : colors.danger} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  lead: { fontSize: 14, lineHeight: 20 },
  card: { gap: space.md, padding: 16, borderRadius: 22, backgroundColor: '#11151B', borderWidth: 1, borderColor: colors.line },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  photoRow: { flexDirection: 'row', gap: space.lg, alignItems: 'center' },
  avatar: { width: 88, height: 88, borderRadius: 26 },
  avatarEmpty: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.gunmetal, borderWidth: 1, borderColor: '#262B35' },
  workRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  thumb: { width: 76, height: 57, borderRadius: 12, backgroundColor: colors.gunmetal },
  caption: { flex: 1, minHeight: 40, color: colors.paint, fontFamily: fonts.body, fontSize: 14, borderBottomWidth: 1, borderBottomColor: colors.line },
  remove: { padding: 6 },
});
