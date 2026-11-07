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
      setMessage('You’re on Pro. Thank you!');
      setTimeout(() => usage.refresh(), 2500); // the server confirms via the store webhook
    } else if (outcome === 'failed') {
      haptic.error();
      setMessage('The purchase didn’t go through. You haven’t been charged.');
    }
  };

  const restore = async () => {
    setBusy('restore');
    setMessage(null);
    const ok = await restorePro().catch(() => false);
    setBusy(null);
    setMessage(ok ? 'Pro restored on this device.' : 'No Pro subscription found for this Apple or Google account.');
    if (ok) usage.refresh();
  };

  const manage = async () => {
    const url = (await managementUrl().catch(() => null)) ??
      (Platform.OS === 'ios' ? 'https://apps.apple.com/account/subscriptions' : 'https://play.google.com/store/account/subscriptions');
    Linking.openURL(url);
  };

  const store = Platform.OS === 'ios' ? 'Apple ID' : 'Google Play';

  return (
      <Screen title="Beadup Pro" tabs={false} right={<BackButton />}>
        <View style={{ alignItems: 'center', marginBottom: space.sm }}>
          <LiquidBead size={96} />
        </View>

        {usage.data && !isPro && (
          <Text variant="body" tone="steel" style={{ textAlign: 'center' }}>
            You’ve used {usage.data.used} of {usage.data.limit} free bookings this month.
          </Text>
        )}

        <GlassCard glowing>
          <View style={{ gap: space.md }}>
            {[
              'Unlimited bookings every month',
              'Everything in Free: booking link, deposits, AI photo quotes, reminders and receipts',
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
              You’re on Pro
            </Text>
            <Button label="Manage subscription" variant="glass" onPress={manage} />
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
            <Button label={`Subscribe for ${offer.price} / ${offer.period}`} onPress={buy} loading={busy === 'buy'} />
          </>
        ) : (
          <Text variant="caption" style={{ textAlign: 'center' }}>
            {state === 'loading' ? 'Loading…' : 'Subscriptions aren’t available in this version of the app yet.'}
          </Text>
        )}

        {message && (
          <Text variant="caption" tone="bead" style={{ textAlign: 'center' }} accessibilityLiveRegion="polite">
            {message}
          </Text>
        )}

        <Text variant="caption" style={{ textAlign: 'center', lineHeight: 18 }}>
          Payment is charged to your {store} account. The subscription renews automatically each {offer?.period ?? 'period'} at the
          same price unless you cancel at least 24 hours before the end of the current period. Cancel any time in your {store} subscription
          settings.
        </Text>
        <Button label="Restore purchases" variant="ghost" onPress={restore} loading={busy === 'restore'} disabled={state === 'unavailable'} />
        <View style={styles.links}>
          <Text variant="caption" tone="bead" accessibilityRole="link" onPress={() => WebBrowser.openBrowserAsync(`${apiBaseUrl}/terms`)}>
            Terms of service
          </Text>
          <Text variant="caption" tone="bead" accessibilityRole="link" onPress={() => WebBrowser.openBrowserAsync(`${apiBaseUrl}/privacy`)}>
            Privacy policy
          </Text>
        </View>
      </Screen>
  );
}

const styles = StyleSheet.create({
  feature: { flexDirection: 'row', gap: space.md, alignItems: 'flex-start' },
  links: { flexDirection: 'row', justifyContent: 'center', gap: space.xl },
});
