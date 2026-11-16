import * as Clipboard from 'expo-clipboard';
import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { LiquidBead } from '@/components/bead/LiquidBead';
import { BackButton } from '@/components/nav/BackButton';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { GlassCard } from '@/components/ui/GlassCard';
import { Icon } from '@/components/ui/Icon';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { claimReferral, fetchReferralStatus, useQuery, type ClaimError } from '@/lib/data';
import { dayLabel } from '@/lib/format';
import { haptic } from '@/lib/haptics';
import { shareLink } from '@/lib/share';
import { apiBaseUrl } from '@/lib/supabase';
import { colors, space } from '@/theme/tokens';
import { t, type MessageKey } from '@/lib/i18n';

const CLAIM_ERRORS: Record<ClaimError, MessageKey> = {
  self: 'iv_self',
  not_found: 'iv_not_found',
  already_claimed: 'iv_claimed',
  too_late: 'iv_late',
  no_profile: 'iv_no_profile',
  unavailable: 'iv_unavail',
};

/**
 * Invite & earn: share your code; when the detailer you invite finishes their
 * first job, you both get a month of Pro (up to 12 months earned).
 */
export default function Invite() {
  const status = useQuery(fetchReferralStatus, [], 'referral-status');
  const s = status.data;
  const [copied, setCopied] = useState(false);
  const [code, setCode] = useState('');
  const [claimError, setClaimError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const site = apiBaseUrl.replace(/^https?:\/\//, '');
  const message = s
    ? t('iv_message', { code: s.code })
    : '';

  const share = () => {
    haptic.select();
    // The site link carries the Beadup preview card (logo + app screens).
    shareLink(message, apiBaseUrl);
  };
  const copy = async () => {
    if (!s) return;
    await Clipboard.setStringAsync(s.code);
    haptic.success();
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };
  const claim = async () => {
    if (!code.trim()) return;
    setBusy(true);
    setClaimError(null);
    const res = await claimReferral(code.trim());
    setBusy(false);
    if (res.ok) {
      haptic.success();
      setCode('');
      status.refresh();
    } else {
      haptic.error();
      setClaimError(t(CLAIM_ERRORS[res.error]));
    }
  };

  return (
    <Screen title={t('iv_title')} tabs={false} right={<BackButton variant="back" />} onRefresh={status.refresh} refreshing={status.loading && !!s}>
      <Animated.View entering={FadeInDown.springify()}>
        <View style={styles.hero}>
          <LinearGradient colors={['rgba(77,216,255,0.20)', 'rgba(77,216,255,0)']} style={StyleSheet.absoluteFill} />
          <LiquidBead size={84} />
          <Text variant="title" style={{ textAlign: 'center', marginTop: space.lg }}>
            {t('iv_hero')}
          </Text>
          <Text variant="body" tone="steel" style={{ textAlign: 'center', marginTop: space.sm, maxWidth: 300 }}>
            {t('iv_hero_d')}
          </Text>
        </View>
      </Animated.View>

      {s && (
        <Animated.View entering={FadeInDown.delay(100).springify()} style={{ gap: space.md }}>
          <GlassCard>
            <Text variant="eyebrow">{t('iv_code')}</Text>
            <View style={styles.codeRow}>
              {/* Long codes shrink to fit instead of being cut off. */}
              <Text style={styles.code} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.4}>
                {s.code}
              </Text>
              <Pressable onPress={copy} style={styles.copy} accessibilityRole="button" accessibilityLabel={copied ? t('iv_code_copied') : t('iv_code_copy')}>
                <Icon name={copied ? 'check' : 'link'} size={18} color={copied ? colors.success : colors.paint} />
              </Pressable>
            </View>
            <Text variant="caption" style={{ marginTop: 6 }}>
              {t('iv_code_d', { site, code: s.code })}
            </Text>
          </GlassCard>

          <Button label={t('iv_share')} icon={<Icon name="share" size={18} color={colors.beadInk} />} onPress={share} />

          <View style={styles.stats}>
            <GlassCard style={{ flex: 1 }}>
              <Text variant="heading">{s.invited}</Text>
              <Text variant="caption">{t('iv_signed')}</Text>
            </GlassCard>
            <GlassCard style={{ flex: 1 }}>
              <Text variant="heading" tone="gold">
                {s.rewarded}
              </Text>
              <Text variant="caption">{t('iv_months')}</Text>
            </GlassCard>
          </View>
          {s.bonusProUntil && new Date(s.bonusProUntil) > new Date() && (
            <Text variant="caption" tone="bead" style={{ textAlign: 'center' }}>
              {t('iv_free_until', { date: dayLabel(s.bonusProUntil, Intl.DateTimeFormat().resolvedOptions().timeZone) })}
            </Text>
          )}

          {s.referredBy ? (
            <Text variant="caption" style={{ textAlign: 'center' }}>
              {t('iv_by', { name: s.referredBy })}
            </Text>
          ) : (
            s.canClaim && (
              <GlassCard>
                <Text variant="bodyStrong">{t('iv_were')}</Text>
                <View style={{ marginTop: space.md, gap: space.md }}>
                  <Field
                    label={t('iv_their')}
                    value={code}
                    onChangeText={setCode}
                    placeholder={t('iv_their_ph')}
                    autoCapitalize="none"
                    autoCorrect={false}
                    maxLength={120}
                    error={claimError}
                  />
                  <Button label={t('iv_apply')} variant="glass" loading={busy} disabled={!code.trim()} onPress={claim} />
                </View>
              </GlassCard>
            )
          )}

          <Text variant="caption" style={{ lineHeight: 19 }}>
            {t('iv_rules')}
          </Text>
        </Animated.View>
      )}
      {status.error && !s && <Text variant="caption">{t('bp_load_fail')}</Text>}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', paddingVertical: space.xl, paddingHorizontal: space.lg, borderRadius: 32, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(77,216,255,0.22)' },
  codeRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8 },
  code: { flex: 1, fontFamily: 'Sora_800ExtraBold', fontSize: 30, letterSpacing: -0.8, color: colors.bead },
  copy: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.gunmetal, borderWidth: 1, borderColor: colors.lineStrong },
  stats: { flexDirection: 'row', gap: space.md },
});
