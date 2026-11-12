import { useState } from 'react';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, Switch, View } from 'react-native';

import { BackButton } from '@/components/nav/BackButton';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { GlassCard } from '@/components/ui/GlassCard';
import { ListCard, Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { fetchCatalog, refreshBookingPage, useQuery, type CatalogService } from '@/lib/data';
import { currencySymbol, money } from '@/lib/format';
import { pickPhoto, setServicePhoto, signedUrls } from '@/lib/media';
import { currentTrade } from '@/lib/trades';
import { haptic } from '@/lib/haptics';
import { supabase } from '@/lib/supabase';
import { colors, space } from '@/theme/tokens';

type Draft = { id?: string; name: string; description: string; hours: string; sedan: string; suv: string; truck: string; photoPath?: string | null };
const toCents = (v: string) => Math.round(Number(v.replace(/[^0-9.]/g, '')) * 100);
const blank: Draft = { name: '', description: '', hours: '2', sedan: '', suv: '', truck: '' };

/** Services and prices editor. Writes go straight to Supabase under RLS. */
export default function Services() {
  const catalog = useQuery(fetchCatalog);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [addOn, setAddOn] = useState({ name: '', price: '' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Switch positions the detailer just set, shown until the reload confirms them.
  const [pending, setPending] = useState<Record<string, boolean>>({});
  // How this trade prices: one price, or one per size (Sedan/SUV/Truck, Small/Medium/Large dog...).
  const trade = currentTrade();
  const tiers = trade.pricing === 'tiers';
  const symbol = currencySymbol();
  const photoPaths = (catalog.data?.services ?? []).map((s) => s.photoPath).filter((p): p is string => !!p);
  const photos = useQuery(() => signedUrls(photoPaths), [photoPaths.join('|')]);
  const [photoBusy, setPhotoBusy] = useState(false);
  const changePhoto = async (remove: boolean) => {
    if (!draft?.id) return;
    const uri = remove ? null : await pickPhoto([4, 3]);
    if (!remove && !uri) return;
    setPhotoBusy(true);
    setError(null);
    try {
      await setServicePhoto(draft.id, uri, draft.photoPath ?? null);
      haptic.success();
      await catalog.refresh();
      setDraft(null);
    } catch {
      haptic.error();
      setError('The photo didn’t save. Check your connection and try again.');
    } finally {
      setPhotoBusy(false);
    }
  };

  const edit = (s: CatalogService) =>
    setDraft({
      id: s.id,
      name: s.name,
      description: s.description,
      hours: String(s.durationMin / 60),
      sedan: String(s.priceCents.sedan / 100),
      suv: String(s.priceCents.suv / 100),
      truck: String(s.priceCents.truck / 100),
      photoPath: s.photoPath,
    });

  const save = async () => {
    if (!draft || !supabase) return;
    const minutes = Math.round(Number(draft.hours) * 60);
    // Single-price trades keep one price in all three columns.
    const prices = tiers ? [toCents(draft.sedan), toCents(draft.suv), toCents(draft.truck)] : [toCents(draft.sedan), toCents(draft.sedan), toCents(draft.sedan)];
    if (!draft.name.trim() || !(minutes >= 15 && minutes <= 720) || prices.some((p) => !(p >= 0 && p <= 1_000_000))) {
      setError(`Add a name, a duration between 15 minutes and 12 hours, and ${tiers ? 'a price for each size' : 'a price'}.`);
      return;
    }
    setBusy(true);
    setError(null);
    const row = {
      name: draft.name.trim().slice(0, 60),
      description: draft.description.trim().slice(0, 200),
      duration_min: minutes,
      price_sedan_cents: prices[0],
      price_suv_cents: prices[1],
      price_truck_cents: prices[2],
    };
    const { data: user } = await supabase.auth.getUser();
    const res = draft.id
      ? await supabase.from('services').update(row).eq('id', draft.id)
      : await supabase.from('services').insert({ ...row, detailer_id: user.user?.id, sort_order: (catalog.data?.services.length ?? 0) + 1 });
    setBusy(false);
    if (res.error) {
      haptic.error();
      setError('Could not save. Check the values and try again.');
      return;
    }
    haptic.success();
    setDraft(null);
    catalog.refresh();
    refreshBookingPage();
  };

  const toggle = async (table: 'services' | 'add_ons', id: string, active: boolean) => {
    haptic.select();
    setPending((p) => ({ ...p, [id]: active }));
    if (!supabase) return; // preview mode: nothing to save
    const { error: e } = await supabase.from(table).update({ active }).eq('id', id);
    if (e) {
      haptic.error();
      setError('Could not update. Check your connection and try again.');
    } else {
      catalog.refresh();
      refreshBookingPage();
    }
    setPending(({ [id]: _, ...rest }) => rest);
  };

  const addAddOn = async () => {
    const cents = toCents(addOn.price);
    if (!supabase || !addOn.name.trim() || !(cents > 0)) return;
    const { data: user } = await supabase.auth.getUser();
    const { error: e } = await supabase.from('add_ons').insert({
      detailer_id: user.user?.id,
      name: addOn.name.trim().slice(0, 60),
      price_cents: Math.min(cents, 1_000_000),
      sort_order: (catalog.data?.addOns.length ?? 0) + 1,
    });
    if (e) return haptic.error();
    haptic.success();
    setAddOn({ name: '', price: '' });
    catalog.refresh();
    refreshBookingPage();
  };

  return (
    <Screen title="Services and prices" tabs={false} right={<BackButton variant="back" />}>
      <Text variant="caption">Clients see these on your booking link. Turn a service off to hide it without deleting it.</Text>

      <ListCard>
        {(catalog.data?.services ?? []).map((s) => (
          <View key={s.id} style={styles.row}>
            {s.photoPath && photos.data?.[s.photoPath] ? (
              <Image source={{ uri: photos.data[s.photoPath] }} style={styles.thumb} contentFit="cover" accessibilityLabel={`${s.name} photo`} />
            ) : null}
            <Pressable style={{ flex: 1, gap: 2 }} onPress={() => edit(s)} accessibilityRole="button" accessibilityLabel={`Edit ${s.name}`}>
              <Text variant="bodyStrong" style={{ color: s.active ? colors.paint : colors.steel }}>
                {s.name}
              </Text>
              <Text variant="caption">
                {tiers ? `${money(s.priceCents.sedan)} / ${money(s.priceCents.suv)} / ${money(s.priceCents.truck)}` : money(s.priceCents.sedan)} · {s.durationMin / 60} h
              </Text>
            </Pressable>
            <Switch
              value={pending[s.id] ?? s.active}
              onValueChange={(v) => toggle('services', s.id, v)}
              trackColor={{ true: colors.bead, false: '#262B35' }}
              accessibilityLabel={`${s.name} shown on booking link`}
            />
          </View>
        ))}
      </ListCard>

      {draft ? (
        <GlassCard glowing>
          <View style={{ gap: space.md }}>
            <Text variant="heading">{draft.id ? 'Edit service' : 'New service'}</Text>
            <Field label="Name" value={draft.name} onChangeText={(name) => setDraft({ ...draft, name })} maxLength={60} />
            <Field label="Description" value={draft.description} onChangeText={(description) => setDraft({ ...draft, description })} maxLength={200} />
            <Field label="Hours" value={draft.hours} onChangeText={(hours) => setDraft({ ...draft, hours })} keyboardType="decimal-pad" />
            {tiers ? (
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {(['sedan', 'suv', 'truck'] as const).map((k) => (
                  <View key={k} style={{ flex: 1 }}>
                    <Field label={`${trade.tiers[k]} ${symbol}`} value={draft[k]} onChangeText={(v) => setDraft({ ...draft, [k]: v })} keyboardType="decimal-pad" />
                  </View>
                ))}
              </View>
            ) : (
              <Field label={`Price ${symbol}`} value={draft.sedan} onChangeText={(v) => setDraft({ ...draft, sedan: v })} keyboardType="decimal-pad" />
            )}
            {draft.id ? (
              <View style={{ gap: space.sm }}>
                <Text variant="caption">
                  {trade.photoFirst ? 'Photo of this service: clients choose by what they see.' : 'Photo of this service (optional).'}
                </Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <View style={{ flex: 1 }}>
                    <Button label={draft.photoPath ? 'Change photo' : 'Add photo'} variant="glass" loading={photoBusy} onPress={() => changePhoto(false)} />
                  </View>
                  {draft.photoPath ? (
                    <View style={{ flex: 1 }}>
                      <Button label="Remove photo" variant="ghost" onPress={() => changePhoto(true)} />
                    </View>
                  ) : null}
                </View>
              </View>
            ) : (
              <Text variant="caption">Save the service first, then you can add a photo.</Text>
            )}
            {error && (
              <Text variant="caption" tone="danger">
                {error}
              </Text>
            )}
            <Button label="Save" onPress={save} loading={busy} />
            <Button label="Cancel" variant="ghost" onPress={() => setDraft(null)} />
          </View>
        </GlassCard>
      ) : (
        <Button label="Add a service" variant="glass" onPress={() => setDraft(blank)} />
      )}

      <Text variant="heading" style={{ fontSize: 18, marginTop: space.sm }}>
        Add-ons
      </Text>
      <ListCard>
        {(catalog.data?.addOns ?? []).map((a) => (
          <View key={a.id} style={styles.row}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="bodyStrong" style={{ color: a.active ? colors.paint : colors.steel }}>
                {a.name}
              </Text>
              <Text variant="caption">{money(a.priceCents)}</Text>
            </View>
            <Switch
              value={pending[a.id] ?? a.active}
              onValueChange={(v) => toggle('add_ons', a.id, v)}
              trackColor={{ true: colors.bead, false: '#262B35' }}
              accessibilityLabel={`${a.name} shown on booking link`}
            />
          </View>
        ))}
      </ListCard>
      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-end' }}>
        <View style={{ flex: 1 }}>
          <Field label="New add-on" value={addOn.name} onChangeText={(name) => setAddOn({ ...addOn, name })} placeholder="e.g. Headlight restore" maxLength={60} />
        </View>
        <View style={{ width: 96 }}>
          <Field label={`Price ${symbol}`} value={addOn.price} onChangeText={(price) => setAddOn({ ...addOn, price })} keyboardType="decimal-pad" />
        </View>
      </View>
      <Button label="Add add-on" variant="glass" onPress={addAddOn} disabled={!addOn.name.trim() || !addOn.price} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  thumb: { width: 52, height: 40, borderRadius: 10 },
});
