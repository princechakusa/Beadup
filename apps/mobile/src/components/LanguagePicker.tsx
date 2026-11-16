import { useState } from 'react';
import { View } from 'react-native';

import { Dropdown } from '@/components/ui/Dropdown';
import { Text } from '@/components/ui/Text';
import { getLanguagePreference, saveLanguagePreference, t, type LanguagePreference } from '@/lib/i18n';

const NAMES = { en: 'English', es: 'Español', fr: 'Français', pt: 'Português' } as const;

/**
 * Settings > Language. "Automatic" follows the phone (the default, and what
 * Apple and Google expect); the other choices override it for this app only.
 * Applies at once: the whole app re-renders in the new language.
 */
export function LanguagePicker() {
  const [value, setValue] = useState<LanguagePreference>(getLanguagePreference());
  const options = [
    { value: 'auto' as const, label: t('lang_auto') },
    ...(Object.keys(NAMES) as (keyof typeof NAMES)[]).map((k) => ({ value: k, label: NAMES[k] })),
  ];
  return (
    <View style={{ gap: 8 }}>
      <Dropdown
        label={t('lang_label')}
        title={t('lang_title')}
        value={value}
        options={options}
        onChange={(v) => {
          setValue(v);
          saveLanguagePreference(v); // every screen re-renders in the new language at once
        }}
      />
      <Text variant="caption" style={{ fontSize: 12 }}>
        {t('lang_note')}
      </Text>
    </View>
  );
}
