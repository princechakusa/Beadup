import { useState } from 'react';
import { Pressable, StyleSheet, Switch, View } from 'react-native';

import { BackButton } from '@/components/nav/BackButton';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { GlassCard } from '@/components/ui/GlassCard';
import { ListCard, Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { fetchCatalog, refreshBookingPage, useQuery, type CatalogService } from '@/lib/data';
import { usd } from '@/lib/format';
import { haptic } from '@/lib/haptics';
import { supabase } from '@/lib/supabase';
import { colors, space } from '@/theme/tokens';

type Draft = { id?: string; name: string; description: string; hours: string; sedan: string; suv: string; truck: string };
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

  const edit = (s: CatalogService) =>
    setDraft({
      id: s.id,
      name: s.name,
      description: s.description,
      hours: String(s.durationMin / 60),
      sedan: String(s.priceCents.sedan / 100),
      suv: String(s.priceCents.suv / 100),
      truck: String(s.priceCents.truck / 100),
    });

  const save = async () => {
    if (!draft || !supabase) return;
    const minutes = Math.round(Number(draft.hours) * 60);
    const prices = [toCents(draft.sedan), toCents(draft.suv), toCents(draft.truck)];
    if (!draft.name.trim() || !(minutes >= 15 && minutes <= 720) || prices.some((p) => !(p >= 0 && p <= 1_000_000))) {
      setError('Add a name, a duration between 15 minutes and 12 hours, and a price for each size.');
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
            <Pressable style={{ flex: 1, gap: 2 }} onPress={() => edit(s)} accessibilityRole="button" accessibilityLabel={`Edit ${s.name}`}>
              <Text variant="bodyStrong" style={{ color: s.active ? colors.paint : colors.steel }}>
                {s.name}
              </Text>
              <Text variant="caption">
                {usd(s.priceCents.sedan)} / {usd(s.priceCents.suv)} / {usd(s.priceCents.truck)} · {s.durationMin / 60} h
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
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {(['sedan', 'suv', 'truck'] as const).map((k) => (
                <View key={k} style={{ flex: 1 }}>
                  <Field
                    label={k === 'suv' ? 'SUV $' : `${k[0].toUpperCase()}${k.slice(1)} $`}
                    value={draft[k]}
                    onChangeText={(v) => setDraft({ ...draft, [k]: v })}
                    keyboardType="decimal-pad"
                  />
                </View>
              ))}
            </View>
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
              <Text variant="caption">{usd(a.priceCents)}</Text>
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
          <Field label="Price $" value={addOn.price} onChangeText={(price) => setAddOn({ ...addOn, price })} keyboardType="decimal-pad" />
        </View>
      </View>
      <Button label="Add add-on" variant="glass" onPress={addAddOn} disabled={!addOn.name.trim() || !addOn.price} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
});
