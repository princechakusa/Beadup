import { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { haptic } from '@/lib/haptics';
import { colors, radius, space } from '@/theme/tokens';
import { t } from '@/lib/i18n';

export type DropdownOption<T extends string> = {
  value: T;
  label: string;
  /** Second line, e.g. what the option means. */
  hint?: string;
  /** Right-aligned small text, e.g. a currency. */
  meta?: string;
};

type Props<T extends string> = {
  label: string;
  value: T;
  options: readonly DropdownOption<T>[];
  onChange: (v: T) => void;
  /** Sheet title; defaults to the label. */
  title?: string;
  /** Show a search box (use for lists longer than about 8). */
  searchable?: boolean;
};

/**
 * Premium dropdown: a glass field that opens a bottom sheet with one row per
 * option, a check on the selected one and optional search. Replaces walls of
 * chips where there are more than a handful of choices.
 */
export function Dropdown<T extends string>({ label, value, options, onChange, title, searchable = false }: Props<T>) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const selected = options.find((o) => o.value === value);
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return needle ? options.filter((o) => `${o.label} ${o.hint ?? ''}`.toLowerCase().includes(needle)) : options;
  }, [options, q]);

  const close = () => {
    setOpen(false);
    setQ('');
  };

  return (
    <View style={{ gap: space.sm }}>
      <Text variant="caption">{label}</Text>
      <Pressable
        onPress={() => {
          haptic.select();
          setOpen(true);
        }}
        style={({ pressed }) => [styles.field, pressed && { opacity: 0.75 }]}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${selected?.label ?? ''}`}>
        <View style={{ flex: 1 }}>
          <Text variant="bodyStrong" numberOfLines={1}>
            {selected?.label ?? t('dd_choose')}
          </Text>
          {selected?.hint ? (
            <Text variant="caption" style={{ fontSize: 12 }} numberOfLines={1}>
              {selected.hint}
            </Text>
          ) : null}
        </View>
        {selected?.meta ? (
          <Text variant="caption" style={{ color: colors.bead }}>
            {selected.meta}
          </Text>
        ) : null}
        <View style={{ transform: [{ rotate: '90deg' }] }}>
          <Icon name="chevronRight" size={18} color={colors.steel} />
        </View>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={close} statusBarTranslucent>
        <Pressable style={styles.scrim} onPress={close} accessibilityLabel={t('dd_close')} />
        <View style={styles.sheet} accessibilityViewIsModal>
          <View style={styles.grab} />
          <View style={styles.head}>
            <Text variant="title" style={{ flex: 1, fontSize: 20 }}>
              {title ?? label}
            </Text>
            <Pressable onPress={close} hitSlop={12} accessibilityRole="button" accessibilityLabel={t('dd_close')}>
              <Icon name="close" size={20} color={colors.steel} />
            </Pressable>
          </View>
          {searchable ? (
            <View style={styles.search}>
              <Icon name="search" size={16} color={colors.steel} />
              <TextInput
                value={q}
                onChangeText={setQ}
                placeholder={t('dd_search')}
                placeholderTextColor={colors.steel}
                style={styles.input}
                autoCorrect={false}
                accessibilityLabel={t('dd_search_a11y')}
              />
            </View>
          ) : null}
          <FlatList
            data={shown}
            keyExtractor={(o) => o.value}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              <Text variant="caption" style={{ padding: space.lg }}>
                {t('dd_none')}
              </Text>
            }
            renderItem={({ item: o, index }) => {
              const on = o.value === value;
              return (
                <Pressable
                  onPress={() => {
                    haptic.select();
                    onChange(o.value);
                    close();
                  }}
                  style={({ pressed }) => [styles.row, index > 0 && styles.divider, on && styles.rowOn, pressed && { opacity: 0.7 }]}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: on }}
                  accessibilityLabel={o.label}>
                  <View style={{ flex: 1 }}>
                    <Text variant="bodyStrong" style={{ fontSize: 15, color: on ? colors.bead : colors.paint }} numberOfLines={1}>
                      {o.label}
                    </Text>
                    {o.hint ? (
                      <Text variant="caption" style={{ fontSize: 12 }} numberOfLines={2}>
                        {o.hint}
                      </Text>
                    ) : null}
                  </View>
                  {o.meta ? (
                    <Text variant="caption" style={{ fontSize: 13 }}>
                      {o.meta}
                    </Text>
                  ) : null}
                  <View style={[styles.radio, on && styles.radioOn]}>{on && <Icon name="check" size={13} strokeWidth={2.8} color={colors.beadInk} />}</View>
                </Pressable>
              );
            }}
          />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    borderRadius: radius.md,
    backgroundColor: colors.gunmetal,
    borderWidth: 1,
    borderColor: colors.lineStrong,
  },
  scrim: { ...StyleSheet.absoluteFill as object, backgroundColor: 'rgba(4,6,9,0.72)' },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: '78%',
    paddingBottom: space.xl,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    backgroundColor: colors.gunmetal,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: colors.lineStrong,
    shadowColor: colors.bead,
    shadowOpacity: 0.18,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: -8 },
  },
  grab: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, marginTop: 10, backgroundColor: colors.lineStrong },
  head: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.xl, paddingTop: space.md, paddingBottom: space.sm },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginHorizontal: space.xl,
    marginBottom: space.sm,
    paddingHorizontal: space.md,
    height: 42,
    borderRadius: radius.md,
    backgroundColor: colors.midnight,
    borderWidth: 1,
    borderColor: colors.line,
  },
  input: { flex: 1, color: colors.paint, fontSize: 15, height: 42 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.xl, paddingVertical: 13 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  rowOn: { backgroundColor: 'rgba(77,216,255,0.07)' },
  radio: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: colors.lineStrong },
  radioOn: { backgroundColor: colors.bead, borderColor: colors.bead },
});
