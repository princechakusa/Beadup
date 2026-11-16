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
import { t } from '@/lib/i18n';

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
      setError(t('tm_fail'));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Screen title={t('md_title')} tabs={false} right={<BackButton variant="back" />} onRefresh={media.refresh} refreshing={media.loading && !!media.data}>
      <Text variant="caption" style={styles.lead}>
        {t('md_lead')}
      </Text>

      <View style={styles.card}>
        <Text variant="bodyStrong">{t('md_photo')}</Text>
        <View style={styles.photoRow}>
          {media.data?.photoUrl ? (
            <Image source={{ uri: media.data.photoUrl }} style={styles.avatar} contentFit="cover" accessibilityLabel={t('md_photo_a11y')} />
          ) : (
            <View style={[styles.avatar, styles.avatarEmpty]}>
              <Icon name="camera" size={22} color={colors.steel} />
            </View>
          )}
          <View style={{ flex: 1, gap: space.sm }}>
            <Button
              label={media.data?.photoUrl ? t('md_change') : t('md_add_photo')}
              variant="glass"
              loading={busy === 'photo'}
              onPress={async () => {
                const uri = await pickPhoto([1, 1]);
                if (uri) await run('photo', () => setProfilePhoto(uri, media.data?.photoPath ?? null));
              }}
            />
            {!!media.data?.photoPath && (
              <Button label={t('md_remove')} variant="ghost" loading={busy === 'photo-off'} onPress={() => run('photo-off', () => setProfilePhoto(null, media.data?.photoPath ?? null))} />
            )}
          </View>
        </View>
        <Text variant="caption" style={{ fontSize: 13 }}>
          {t('md_photo_d')}
        </Text>
      </View>

      <View style={styles.card}>
        <View style={styles.head}>
          <Text variant="bodyStrong">{t('md_work')}</Text>
          <Text variant="caption">
            {t('md_of', { n: work.length, max: MAX_WORK })}
          </Text>
        </View>
        {work.map((item) => (
          <WorkRow key={item.id} item={item} busy={busy === item.id} onRemove={() => run(item.id, () => removeWork(item))} onCaption={(c) => run(item.id, () => setWorkCaption(item.id, c))} />
        ))}
        {work.length < MAX_WORK && (
          <Button
            label={t('md_add_work')}
            loading={busy === 'add'}
            onPress={async () => {
              const uri = await pickPhoto([4, 3]);
              if (uri) await run('add', () => addWork(uri, ''));
            }}
          />
        )}
        <Text variant="caption" style={{ fontSize: 13 }}>
          {t('md_work_d')}
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
        placeholder={t('md_caption_ph')}
        placeholderTextColor={colors.steel}
        maxLength={80}
        style={styles.caption}
        accessibilityLabel={t('md_caption')}
      />
      <Pressable onPress={onRemove} disabled={busy} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('md_remove_photo')} style={styles.remove}>
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
