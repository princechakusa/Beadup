import { useState } from 'react';
import { View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Text } from '@/components/ui/Text';
import { normalizePaymentLink, savePaymentDetails, type PaymentDetails } from '@/lib/data';
import { haptic } from '@/lib/haptics';
import { space } from '@/theme/tokens';

/**
 * Where clients pay this detailer's deposit (launch mode: Beadup never touches
 * the money). Shown to the client on the "You're booked" screen.
 */
export function PaymentDetailsForm({
  initial,
  saveLabel = 'Save',
  onSaved,
}: {
  initial: PaymentDetails;
  saveLabel?: string;
  onSaved?: () => void;
}) {
  const [link, setLink] = useState(initial.link ?? '');
  const [note, setNote] = useState(initial.note ?? '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    const parsed = normalizePaymentLink(link);
    if (!parsed.ok) {
      haptic.error();
      return setError(parsed.error);
    }
    setBusy(true);
    setError(null);
    try {
      await savePaymentDetails({ link: parsed.link, note });
      if (parsed.link) setLink(parsed.link);
      haptic.success();
      onSaved?.();
    } catch {
      haptic.error();
      setError('Could not save. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ gap: space.lg }}>
      <Field
        label="Payment link"
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
        label="Or how to pay you (optional)"
        value={note}
        onChangeText={setNote}
        placeholder="e.g. Zelle: (512) 555-0101"
        maxLength={200}
        multiline
        style={{ minHeight: 76, paddingTop: 14, textAlignVertical: 'top' }}
      />
      <Text variant="caption" style={{ fontSize: 13, lineHeight: 19 }}>
        Clients see this right after they book, with the 30% deposit amount. Square, PayPal, Venmo and Cash App links all
        work. Money goes straight to you; Beadup never touches it.
      </Text>
      <Button label={saveLabel} onPress={save} loading={busy} />
    </View>
  );
}
