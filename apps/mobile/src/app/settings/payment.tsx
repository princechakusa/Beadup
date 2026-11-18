import { router } from 'expo-router';

import { BackButton } from '@/components/nav/BackButton';
import { DepositPercent } from '@/components/payments/DepositPercent';
import { PaymentDetailsForm } from '@/components/payments/PaymentDetailsForm';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { fetchPaymentDetails, useQuery } from '@/lib/data';
import { t } from '@/lib/i18n';

/** Settings: the detailer's own deposit link / instructions. */
export default function PaymentSettings() {
  const details = useQuery(fetchPaymentDetails, [], 'payment-details');
  return (
    <Screen title={t('pm_title')} tabs={false} right={<BackButton variant="back" />}>
      <Text variant="body" tone="steel">
        {t('pm_sub')}
      </Text>
      <DepositPercent />
      {details.data ? (
        <PaymentDetailsForm initial={details.data} onSaved={() => router.back()} />
      ) : (
        <Text variant="caption">{details.error ? t('bp_load_fail') : t('bp_loading')}</Text>
      )}
    </Screen>
  );
}
