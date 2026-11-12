import * as Clipboard from 'expo-clipboard';
import { router, useFocusEffect } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useEffect, useState } from 'react';
import { Linking, Pressable, StyleSheet, Switch, View } from 'react-native';

import { BackButton } from '@/components/nav/BackButton';
import { Icon, type IconName } from '@/components/ui/Icon';
import { ListCard, Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { AI_PROVIDER_LABEL, aiConsentStatus, withdrawAiConsent, type AiProviderId } from '@/lib/ai';
import { signOut } from '@/lib/auth';
import { fetchAccount, fetchPaymentDetails, fetchPlanUsage, fetchProfile, startPayoutsSetup, usePaymentsMode, useQuery } from '@/lib/data';
import { initials } from '@/lib/format';
import { haptic } from '@/lib/haptics';
import { shareLink } from '@/lib/share';
import { disablePush, enablePush, pushState, type PushState } from '@/lib/push';
import { apiBaseUrl } from '@/lib/supabase';
import { colors } from '@/theme/tokens';

const SUPPORT_EMAIL = 'support@beadup.app';

export default function Settings() {
  const profile = useQuery(fetchProfile);
  const account = useQuery(fetchAccount);
  const usage = useQuery(fetchPlanUsage);
  const [copied, setCopied] = useState(false);
  const [opening, setOpening] = useState(false);
  const [push, setPush] = useState<PushState | null>(null);
  // The switch shows the requested value while registering (permission,
  // token, save take a second or two), so it doesn't look like it failed.
  const [pushBusy, setPushBusy] = useState<boolean | null>(null);
  const [pushFailed, setPushFailed] = useState(false);
  const [ai, setAi] = useState<boolean | null>(null);
  const [aiProvider, setAiProvider] = useState<AiProviderId>('openai');
  const paymentsMode = usePaymentsMode();
  const paymentDetails = useQuery(fetchPaymentDetails, [], 'payment-details');
  const pd = paymentDetails.data;
  const paymentSummary = !pd
    ? ' '
    : pd.link
      ? pd.link.replace(/^https:\/\//, '').slice(0, 28)
      : pd.note
        ? pd.note.slice(0, 28)
        : 'Not set · add how clients pay you';
  useFocusEffect(
    useCallback(() => {
      aiConsentStatus()
        .then((s) => {
          setAi(s.consented);
          setAiProvider(s.provider);
        })
        .catch(() => setAi(false));
    }, []),
  );
  useEffect(() => {
    pushState().then(setPush).catch(() => setPush('off'));
  }, []);

  const togglePush = async (on: boolean) => {
    if (pushBusy !== null) return;
    haptic.select();
    setPushBusy(on);
    setPushFailed(false);
    try {
      if (on) {
        const s = await enablePush();
        setPush(s);
        if (s === 'denied') Linking.openSettings();
        else if (s !== 'on') {
          setPushFailed(true);
          haptic.error();
        }
      } else {
        await disablePush();
        setPush('off');
      }
    } catch {
      setPush(await pushState().catch(() => 'off' as const));
      setPushFailed(on);
    } finally {
      setPushBusy(null);
    }
  };

  const p = profile.data;
  const a = account.data;
  const bookingUrl = p ? `${apiBaseUrl.replace(/^https?:\/\//, '')}/${p.handle}` : '';
  const fullUrl = p ? `${apiBaseUrl}/${p.handle}` : '';

  const u = usage.data;
  const plan =
    u?.plan === 'pro' || a?.plan === 'pro'
      ? `Pro${a?.planRenewsAt ? ` · renews ${new Date(a.planRenewsAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : ''}`
      : u
        ? `Free plan · ${u.used} of ${u.limit} bookings this month`
        : 'Free plan';
  const payouts = !a
    ? ' '
    : a.chargesEnabled
      ? a.payoutsEnabled
        ? 'Connected'
        : 'Connected · Stripe needs more details'
      : a.stripeLinked
        ? 'Finish setting up with Stripe'
        : 'Not set up · needed to take deposits';

  const openPayouts = async () => {
    setOpening(true);
    try {
      await WebBrowser.openBrowserAsync(await startPayoutsSetup());
      account.refresh();
    } catch {
      haptic.error();
    } finally {
      setOpening(false);
    }
  };

  return (
    <Screen title="Settings" tabs={false} right={<BackButton />}>
      <Pressable style={styles.profile} onPress={() => router.push('/settings/profile')} accessibilityRole="button" accessibilityLabel={`Edit business profile: ${p?.businessName ?? ''}`}>
        <View style={styles.monogram}>
          <Text variant="heading" tone="beadInk">
            {p ? initials(p.businessName) : ''}
          </Text>
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="heading" style={{ fontSize: 18 }}>
            {p?.businessName ?? ' '}
          </Text>
          <Text variant="caption" tone="steel" style={{ fontSize: 13 }}>
            Edit name, tagline and service area
          </Text>
        </View>
        <Icon name="chevronRight" size={18} color="#5B6371" />
      </Pressable>

      <View style={styles.linkCard}>
        <Text variant="caption" style={{ fontSize: 13 }}>
          Your booking link
        </Text>
        <View style={styles.linkRow}>
          <Text variant="bodyStrong" tone="bead" style={{ flex: 1, fontSize: 16 }} numberOfLines={1}>
            {bookingUrl}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Copy link"
            onPress={async () => {
              await Clipboard.setStringAsync(fullUrl);
              haptic.success();
              setCopied(true);
              setTimeout(() => setCopied(false), 1600);
            }}
            style={styles.iconBtn}>
            <Icon name={copied ? 'check' : 'link'} size={18} color={copied ? colors.success : colors.paint} />
          </Pressable>
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            haptic.tap();
            shareLink(`Book your next detail with ${p?.businessName ?? 'me'}:`, fullUrl);
          }}
          style={styles.shareBtn}>
          <Icon name="share" size={18} color={colors.beadInk} strokeWidth={2.2} />
          <Text variant="bodyStrong" tone="beadInk" style={{ fontSize: 15 }}>
            Share link
          </Text>
        </Pressable>
      </View>

      <ListCard>
        <Row icon="sparkle" label="Plan" detail={plan} onPress={() => router.push('/pro')} />
        <Row icon="clients" label="Invite & earn" detail="Free months of Pro" onPress={() => router.push('/settings/invite')} />
      </ListCard>

      <ListCard>
        <Row icon="camera" label="Photo and your work" detail="Shown on your booking page" onPress={() => router.push('/settings/media')} />
        <Row icon="search" label="Get found on Google" detail="Add your link to Search and Maps" onPress={() => router.push('/settings/google')} />
        <Row icon="car" label="Services and prices" onPress={() => router.push('/settings/services')} />
        <Row icon="calendar" label="Availability" onPress={() => router.push('/settings/availability')} />
        <Row icon="clients" label="Team" detail="People who take bookings" onPress={() => router.push('/settings/team')} />
        {paymentsMode === 'external' ? (
          <>
            <Row icon="money" label="Deposit" detail="30% · paid to you directly" />
            <Row
              icon="link"
              label="Payment link"
              detail={paymentSummary}
              onPress={() => router.push('/settings/payment')}
              warn={!!pd && !pd.link && !pd.note}
            />
          </>
        ) : (
          <>
            <Row icon="money" label="Deposit" detail="30% · client pays the card fee" />
            <Row icon="money" label="Payouts" detail={opening ? 'Opening Stripe…' : payouts} onPress={a?.payoutsEnabled ? undefined : openPayouts} warn={!!a && !a.chargesEnabled} />
          </>
        )}
      </ListCard>

      <ListCard>
        <View style={styles.row}>
          <Icon name="bell" size={20} color={colors.steel} />
          <View style={{ flex: 1, gap: 1 }}>
            <Text variant="bodyStrong" style={{ fontSize: 15 }}>
              Booking alerts
            </Text>
            <Text variant="caption" style={{ fontSize: 12 }}>
              {pushBusy === true
                ? 'Turning on…'
                : pushFailed
                  ? 'Couldn’t turn on alerts. Check your connection and try again.'
                  : push === 'denied'
                    ? 'Turned off in your phone settings'
                    : push === 'unavailable'
                      ? 'Available in the App Store and Play Store builds'
                      : 'Optional. The app works without them'}
            </Text>
          </View>
          <Switch
            value={pushBusy ?? push === 'on'}
            disabled={push === null || push === 'unavailable' || pushBusy !== null}
            onValueChange={togglePush}
            trackColor={{ true: colors.bead, false: '#262B35' }}
            accessibilityLabel="Booking alerts"
          />
        </View>
        <View style={styles.row}>
          <Icon name="sparkle" size={20} color={colors.steel} />
          <View style={{ flex: 1, gap: 1 }}>
            <Text variant="bodyStrong" style={{ fontSize: 15 }}>
              AI photo quotes
            </Text>
            <Text variant="caption" style={{ fontSize: 12 }}>
              Photos are sent to our AI provider, {AI_PROVIDER_LABEL[aiProvider].name}
            </Text>
          </View>
          <Switch
            value={!!ai}
            disabled={ai === null}
            onValueChange={async (on) => {
              haptic.select();
              if (on) return router.push('/ai-consent');
              setAi(false);
              try {
                await withdrawAiConsent();
              } catch {
                haptic.error();
                setAi(true); // still on at the server; show the truth
              }
            }}
            trackColor={{ true: colors.bead, false: '#262B35' }}
            accessibilityLabel="AI photo quotes"
          />
        </View>
      </ListCard>

      <ListCard>
        <Row icon="link" label="Privacy policy and terms" onPress={() => WebBrowser.openBrowserAsync(`${apiBaseUrl}/privacy`)} />
        <Row icon="message" label="Help and support" detail={SUPPORT_EMAIL} onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`)} />
      </ListCard>

      <ListCard>
        <Row icon="logout" label="Sign out" onPress={() => signOut()} />
        <Row icon="trash" label="Delete account" danger onPress={() => router.push('/settings/delete-account')} />
      </ListCard>
    </Screen>
  );
}

function Row({
  icon,
  label,
  detail,
  onPress,
  danger,
  warn,
}: {
  icon: IconName;
  label: string;
  detail?: string;
  onPress?: () => void;
  danger?: boolean;
  warn?: boolean;
}) {
  return (
    <Pressable
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityLabel={detail ? `${label}, ${detail}` : label}
      onPress={() => {
        haptic.select();
        onPress?.();
      }}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: 'rgba(255,255,255,0.03)' }]}>
      <Icon name={icon} size={20} color={danger ? colors.danger : colors.steel} />
      <View style={{ flex: 1, gap: 1 }}>
        <Text variant="bodyStrong" style={{ fontSize: 15, color: danger ? colors.danger : colors.paint }}>
          {label}
        </Text>
        {detail && (
          <Text variant="caption" style={{ fontSize: 12, color: warn ? colors.gold : colors.steel }}>
            {detail}
          </Text>
        )}
      </View>
      {onPress && !danger && <Icon name="chevronRight" size={18} color="#5B6371" />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  profile: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  monogram: { width: 56, height: 56, borderRadius: 18, backgroundColor: colors.paint, alignItems: 'center', justifyContent: 'center' },
  linkCard: { borderRadius: 28, padding: 18, gap: 12, backgroundColor: '#0F1A20', borderWidth: 1, borderColor: 'rgba(77,216,255,0.35)' },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconBtn: { width: 44, height: 44, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', backgroundColor: 'rgba(255,255,255,0.05)', alignItems: 'center', justifyContent: 'center' },
  shareBtn: { height: 48, borderRadius: 16, backgroundColor: colors.bead, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, minHeight: 60, paddingVertical: 10 },
});

