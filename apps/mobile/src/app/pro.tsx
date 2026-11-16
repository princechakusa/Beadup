import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { Linking, Platform, StyleSheet, View } from 'react-native';

import { LiquidBead } from '@/components/bead/LiquidBead';
import { BackButton } from '@/components/nav/BackButton';
import { Button } from '@/components/ui/Button';
import { GlassCard } from '@/components/ui/GlassCard';
import { Icon } from '@/components/ui/Icon';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { useAuth } from '@/lib/auth';
import { fetchPlanUsage, useQuery } from '@/lib/data';
import { haptic } from '@/lib/haptics';
import { buyPro, ensurePurchases, loadProOffer, managementUrl, purchasesAvailable, restorePro, type ProOffer } from '@/lib/purchases';
import { apiBaseUrl } from '@/lib/supabase';
import { colors, space } from '@/theme/tokens';
import { t } from '@/lib/i18n';

// Paywall (Apple 3.1.2): price and period from the store, what's included,
// renewal and how to cancel, Restore Purchases, Terms and Privacy. No web
// purchase links (owner decision 2026-11-07).
export default function Pro() {
  const { session } = useAuth();
  const usage = useQuery(fetchPlanUsage);
  const [offer, setOffer] = useState<ProOffer | null>(null);
  const [loaded, setState] = useState<'loading' | 'ready' | 'unavailable'>('loading');
  const canSell = purchasesAvailable && !!session?.user.id;
  const state = canSell ? loaded : 'unavailable';
  const [busy, setBusy] = useState<'buy' | 'restore' | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const isPro = usage.data?.plan === 'pro';

  useEffect(() => {
    const uid = session?.user.id;
    if (!purchasesAvailable || !uid) return;
    let alive = true;
    ensurePurchases(uid)
      .then((ok) => (ok ? loadProOffer() : null))
      .then((o) => {
        if (!alive) return;
        setOffer(o);
        setState(o ? 'ready' : 'unavailable');
      })
      .catch(() => alive && setState('unavailable'));
    return () => {
      alive = false;
    };
  }, [session?.user.id]);

  const buy = async () => {
    if (!offer) return;
    setBusy('buy');
    setMessage(null);
    const outcome = await buyPro(offer);
    setBusy(null);
    if (outcome === 'purchased') {
      haptic.success();
      setMessage(t('pro_thanks'));
      setTimeout(() => usage.refresh(), 2500); // the server confirms via the store webhook
    } else if (outcome === 'failed') {
      haptic.error();
      setMessage(t('pro_failed'));
    }
  };

  const restore = async () => {
    setBusy('restore');
    setMessage(null);
    const ok = await restorePro().catch(() => false);
    setBusy(null);
    setMessage(ok ? t('pro_restored') : t('pro_none'));
    if (ok) usage.refresh();
  };

  const manage = async () => {
    const url = (await managementUrl().catch(() => null)) ??
      (Platform.OS === 'ios' ? 'https://apps.apple.com/account/subscriptions' : 'https://play.google.com/store/account/subscriptions');
    Linking.openURL(url);
  };

  const store = Platform.OS === 'ios' ? t('pro_apple') : t('pro_google');

  return (
      <Screen title={t('pro_title')} tabs={false} right={<BackButton />}>
        <View style={{ alignItems: 'center', marginBottom: space.sm }}>
          <LiquidBead size={96} />
        </View>

        {usage.data && !isPro && (
          <Text variant="body" tone="steel" style={{ textAlign: 'center' }}>
            {t('pro_used', { used: usage.data.used, limit: usage.data.limit })}
          </Text>
        )}

        <GlassCard glowing>
          <View style={{ gap: space.md }}>
            {[
              t('pro_f1'),
              t('pro_f2'),
            ].map((f) => (
              <View key={f} style={styles.feature}>
                <Icon name="check" size={18} color={colors.bead} strokeWidth={2.6} />
                <Text variant="body" style={{ flex: 1 }}>
                  {f}
                </Text>
              </View>
            ))}
          </View>
        </GlassCard>

        {isPro ? (
          <>
            <Text variant="heading" style={{ textAlign: 'center' }}>
              {t('pro_on')}
            </Text>
            <Button label={t('pro_manage')} variant="glass" onPress={manage} />
          </>
        ) : state === 'ready' && offer ? (
          <>
            <View style={{ alignItems: 'center', gap: 2 }}>
              <Text variant="money" tone="paint">
                {offer.price}
                <Text variant="body" tone="steel">
                  {' '}
                  / {offer.period}
                </Text>
              </Text>
            </View>
            <Button label={t('pro_subscribe', { price: offer.price, period: offer.period })} onPress={buy} loading={busy === 'buy'} />
          </>
        ) : (
          <Text variant="caption" style={{ textAlign: 'center' }}>
            {state === 'loading' ? t('loading') : t('pro_unavail')}
          </Text>
        )}

        {message && (
          <Text variant="caption" tone="bead" style={{ textAlign: 'center' }} accessibilityLiveRegion="polite">
            {message}
          </Text>
        )}

        <Text variant="caption" style={{ textAlign: 'center', lineHeight: 18 }}>
          {t('pro_terms_text', { store, period: offer?.period ?? t('pro_period') })}
        </Text>
        <Button label={t('pro_restore')} variant="ghost" onPress={restore} loading={busy === 'restore'} disabled={state === 'unavailable'} />
        <View style={styles.links}>
          <Text variant="caption" tone="bead" accessibilityRole="link" onPress={() => WebBrowser.openBrowserAsync(`${apiBaseUrl}/terms`)}>
            {t('pro_terms')}
          </Text>
          <Text variant="caption" tone="bead" accessibilityRole="link" onPress={() => WebBrowser.openBrowserAsync(`${apiBaseUrl}/privacy`)}>
            {t('pro_privacy')}
          </Text>
        </View>
      </Screen>
  );
}

const styles = StyleSheet.create({
  feature: { flexDirection: 'row', gap: space.md, alignItems: 'flex-start' },
  links: { flexDirection: 'row', justifyContent: 'center', gap: space.xl },
});
