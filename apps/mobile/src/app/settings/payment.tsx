import { router } from 'expo-router';

import { BackButton } from '@/components/nav/BackButton';
import { PaymentDetailsForm } from '@/components/payments/PaymentDetailsForm';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { fetchPaymentDetails, useQuery } from '@/lib/data';

/** Settings: the detailer's own deposit link / instructions. */
export default function PaymentSettings() {
  const details = useQuery(fetchPaymentDetails, [], 'payment-details');
  return (
    <Screen title="Payment link" tabs={false} right={<BackButton variant="back" />}>
      <Text variant="body" tone="steel">
        How clients pay your deposit after booking.
      </Text>
      {details.data ? (
        <PaymentDetailsForm initial={details.data} onSaved={() => router.back()} />
      ) : (
        <Text variant="caption">{details.error ? 'Could not load. Pull down to retry.' : 'Loading…'}</Text>
      )}
    </Screen>
  );
}
