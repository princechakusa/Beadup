import { useState } from 'react';
import { View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Dropdown } from '@/components/ui/Dropdown';
import { Field } from '@/components/ui/Field';
import { Text } from '@/components/ui/Text';
import { normalizePaymentLink, savePaymentDetails, type PaymentDetails } from '@/lib/data';
import { moneyCountry } from '@/lib/format';
import { haptic } from '@/lib/haptics';
import { detailFromNote, guessMethod, methodsFor } from '@/lib/payment-methods';
import { space } from '@/theme/tokens';
import { t } from '@/lib/i18n';

/**
 * Where clients pay this detailer's deposit (launch mode: Beadup never touches
 * the money). Shown to the client on the "You're booked" screen.
 */
export function PaymentDetailsForm({
  initial,
  saveLabel,
  onSaved,
}: {
  initial: PaymentDetails;
  saveLabel?: string;
  onSaved?: () => void;
}) {
  const methods = methodsFor(moneyCountry());
  const first = guessMethod(moneyCountry(), initial.link, initial.note);
  const [methodId, setMethodId] = useState(first.id);
  const method = methods.find((m) => m.id === methodId) ?? methods[0];
  // 'detail' is the one thing a method asks for (a ShapID, a Zelle number, a link).
  const [detail, setDetail] = useState(first.kind === 'link' ? (initial.link ?? '') : detailFromNote(first, initial.note));
  const [link, setLink] = useState(initial.link ?? '');
  const [note, setNote] = useState(initial.note ?? '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    let out: { link: string | null; note: string | null };
    if (method.id === 'custom') {
      const parsed = normalizePaymentLink(link);
      if (!parsed.ok) {
        haptic.error();
        return setError(parsed.error);
      }
      out = { link: parsed.link, note };
    } else if (method.kind === 'link') {
      const parsed = normalizePaymentLink(detail);
      if (!parsed.ok || !parsed.link) {
        haptic.error();
        return setError(parsed.ok ? t('pm_add_link', { method: method.label }) : parsed.error);
      }
      out = { link: parsed.link, note: null };
    } else if (method.kind === 'note') {
      if (!detail.trim()) {
        haptic.error();
        return setError(t('pm_add_detail', { what: method.detailLabel?.toLowerCase() ?? '' }));
      }
      out = { link: null, note: method.note!(detail.trim()) };
    } else {
      out = { link: null, note: method.fixed ?? null };
    }
    setBusy(true);
    setError(null);
    try {
      await savePaymentDetails(out);
      haptic.success();
      onSaved?.();
    } catch {
      haptic.error();
      setError(t('bp_save_fail'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ gap: space.lg }}>
      <Dropdown
        label={t('pm_how')}
        title={t('pm_sheet')}
        value={methodId}
        options={methods.map((m) => ({ value: m.id, label: m.label, hint: m.hint }))}
        onChange={(id) => {
          setMethodId(id);
          setDetail('');
          setError(null);
        }}
      />
      {method.id === 'custom' ? (
        <>
          <Field
            label={t('pm_link')}
            value={link}
            onChangeText={(t) => {
              setLink(t);
              setError(null);
            }}
            placeholder="square.link/u/yourname or paypal.me/yourname"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            textContentType="URL"
            maxLength={300}
            error={error}
          />
          <Field
            label={t('pm_note')}
            value={note}
            onChangeText={setNote}
            placeholder="e.g. Zelle: (512) 555-0101"
            maxLength={200}
            multiline
            style={{ minHeight: 76, paddingTop: 14, textAlignVertical: 'top' }}
          />
        </>
      ) : method.kind === 'fixed' ? (
        <Text variant="body" tone="steel">
          {t('pm_clients_see', { text: method.fixed ?? '' })}
        </Text>
      ) : (
        <Field
          label={method.detailLabel ?? t('pm_details')}
          value={detail}
          onChangeText={(t) => {
            setDetail(t);
            setError(null);
          }}
          placeholder={method.placeholder}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType={method.kind === 'link' ? 'url' : 'default'}
          maxLength={method.kind === 'link' ? 300 : 160}
          error={error}
        />
      )}
      {method.id !== 'custom' && method.kind === 'fixed' && error ? <Text variant="caption" style={{ color: '#FF8A8A' }}>{error}</Text> : null}
      <Text variant="caption" style={{ fontSize: 13, lineHeight: 19 }}>
        {t('pm_footer')}
      </Text>
      <Button label={saveLabel ?? t('save')} onPress={save} loading={busy} />
    </View>
  );
}
