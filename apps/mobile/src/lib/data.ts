import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';

import { clearCache, readCache, writeCache } from './cache';
import { fixtures } from './fixtures';
import { apiBaseUrl, supabase } from './supabase';

// Data access for the detailer app. Every query runs as the signed-in
// detailer, so row level security limits it to their own rows; no query
// filters by detailer id client-side for security.

export type Profile = { id: string; handle: string; businessName: string; timezone: string };

export type BookingStatus = 'pending_payment' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';

export type Booking = {
  id: string;
  startsAt: string;
  durationMin: number;
  serviceName: string;
  vehicleSize: 'sedan' | 'suv' | 'truck';
  status: BookingStatus;
  subtotalCents: number;
  depositCents: number;
  address: string;
  addOns: { name: string; priceCents?: number }[];
  client: { id: string; name: string; phone: string };
};

export type Payment = {
  id: string;
  bookingId: string;
  kind: 'deposit' | 'balance' | 'refund';
  status: 'pending' | 'succeeded' | 'failed' | 'refunded';
  amountCents: number;
  createdAt: string;
  clientName: string;
};

export type ClientSummary = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  visits: number;
  spentCents: number;
  lastVisit: string | null;
  nextBooking: string | null;
};

export type Balance = {
  connected: boolean;
  availableCents: number;
  pendingCents: number;
  nextPayout: { amountCents: number; arrivalDate: string } | null;
  bankLast4: string | null;
};

const BOOKING_SELECT =
  'id, starts_at, duration_min, service_name, vehicle_size, status, subtotal_cents, deposit_cents, address, add_ons, client:clients(id, name, phone)';

type BookingRow = {
  id: string;
  starts_at: string;
  duration_min: number;
  service_name: string;
  vehicle_size: Booking['vehicleSize'];
  status: BookingStatus;
  subtotal_cents: number;
  deposit_cents: number;
  address: string;
  add_ons: { name: string; priceCents?: number }[] | null;
  client: { id: string; name: string; phone: string } | null;
};

const toBooking = (r: BookingRow): Booking => ({
  id: r.id,
  startsAt: r.starts_at,
  durationMin: r.duration_min,
  serviceName: r.service_name,
  vehicleSize: r.vehicle_size,
  status: r.status,
  subtotalCents: r.subtotal_cents,
  depositCents: r.deposit_cents,
  address: r.address,
  addOns: r.add_ons ?? [],
  client: r.client ?? { id: '', name: 'Client', phone: '' },
});

function db() {
  if (!supabase) throw new Error('offline');
  return supabase;
}

export async function fetchProfile(): Promise<Profile | null> {
  if (!supabase) return fixtures.profile;
  const { data, error } = await db().from('detailers').select('id, handle, business_name, timezone').maybeSingle();
  if (error) throw error;
  return data && { id: data.id, handle: data.handle, businessName: data.business_name, timezone: data.timezone };
}

/** Bookings starting in [from, to), excluding unpaid holds and cancellations. */
export async function fetchBookings(from: Date, to: Date): Promise<Booking[]> {
  if (!supabase) return fixtures.bookings(from, to);
  const { data, error } = await db()
    .from('bookings')
    .select(BOOKING_SELECT)
    .gte('starts_at', from.toISOString())
    .lt('starts_at', to.toISOString())
    .in('status', ['confirmed', 'completed', 'no_show'])
    .order('starts_at');
  if (error) throw error;
  return (data as unknown as BookingRow[]).map(toBooking);
}

export async function fetchNextBookings(limit = 6): Promise<Booking[]> {
  if (!supabase) return fixtures.bookings(new Date(), new Date(Date.now() + 7 * 86_400_000)).slice(0, limit);
  const { data, error } = await db()
    .from('bookings')
    .select(BOOKING_SELECT)
    .gte('starts_at', new Date(Date.now() - 3 * 3_600_000).toISOString()) // include jobs in progress
    .eq('status', 'confirmed')
    .order('starts_at')
    .limit(limit);
  if (error) throw error;
  return (data as unknown as BookingRow[]).map(toBooking);
}

export async function fetchPayments(since: Date): Promise<Payment[]> {
  if (!supabase) return fixtures.payments;
  const { data, error } = await db()
    .from('payments')
    .select('id, booking_id, kind, status, amount_cents, created_at, booking:bookings(client:clients(name))')
    .gte('created_at', since.toISOString())
    .in('status', ['succeeded', 'refunded'])
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw error;
  type Row = {
    id: string;
    booking_id: string;
    kind: Payment['kind'];
    status: Payment['status'];
    amount_cents: number;
    created_at: string;
    booking: { client: { name: string } | null } | null;
  };
  return (data as unknown as Row[]).map((r) => ({
    id: r.id,
    bookingId: r.booking_id,
    kind: r.kind,
    status: r.status,
    amountCents: r.amount_cents,
    createdAt: r.created_at,
    clientName: r.booking?.client?.name ?? 'Client',
  }));
}

export async function fetchClients(): Promise<ClientSummary[]> {
  if (!supabase) return fixtures.clients;
  const { data, error } = await db()
    .from('clients')
    .select('id, name, phone, email, bookings(subtotal_cents, status, starts_at)')
    .order('name');
  if (error) throw error;
  type Row = {
    id: string;
    name: string;
    phone: string;
    email: string | null;
    bookings: { subtotal_cents: number; status: BookingStatus; starts_at: string }[];
  };
  const now = Date.now();
  return (data as unknown as Row[]).map((c) => {
    const done = c.bookings.filter((b) => b.status === 'completed');
    const upcoming = c.bookings
      .filter((b) => b.status === 'confirmed' && Date.parse(b.starts_at) > now)
      .map((b) => b.starts_at)
      .sort();
    const last = done.map((b) => b.starts_at).sort().at(-1) ?? null;
    return {
      id: c.id,
      name: c.name,
      phone: c.phone,
      email: c.email,
      visits: done.length,
      spentCents: done.reduce((n, b) => n + b.subtotal_cents, 0),
      lastVisit: last,
      nextBooking: upcoming[0] ?? null,
    };
  });
}

export async function fetchRating(): Promise<{ rating: number | null; count: number }> {
  if (!supabase) return { rating: 4.9, count: 38 };
  const { data, error } = await db().from('reviews').select('rating');
  if (error) throw error;
  if (!data.length) return { rating: null, count: 0 };
  return { rating: Math.round((data.reduce((n, r) => n + r.rating, 0) / data.length) * 10) / 10, count: data.length };
}

/** Calls the web API as the signed-in detailer (Bearer access token). */
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { data } = await db().auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('signed out');
  const res = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: { ...init.headers, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error(`api ${res.status}`);
  return (await res.json()) as T;
}

export async function fetchBalance(): Promise<Balance> {
  if (!supabase) return fixtures.balance;
  return api<Balance>('/api/stripe/balance');
}

export type Account = {
  plan: 'free' | 'pro';
  planRenewsAt: string | null;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  stripeLinked: boolean;
};

export async function fetchAccount(): Promise<Account> {
  if (!supabase) return { plan: 'pro', planRenewsAt: new Date(Date.now() + 30 * 86_400_000).toISOString(), chargesEnabled: true, payoutsEnabled: true, stripeLinked: true };
  const { data, error } = await db()
    .from('detailer_accounts')
    .select('plan, plan_renews_at, charges_enabled, payouts_enabled, stripe_account_id')
    .maybeSingle();
  if (error) throw error;
  return {
    plan: (data?.plan as Account['plan']) ?? 'free',
    planRenewsAt: data?.plan_renews_at ?? null,
    chargesEnabled: !!data?.charges_enabled,
    payoutsEnabled: !!data?.payouts_enabled,
    stripeLinked: !!data?.stripe_account_id,
  };
}

export type BookingDetail = Booking & { notes: string; bookingFeeCents: number; paidCents: number };

export async function fetchBooking(id: string): Promise<BookingDetail | null> {
  if (!supabase) {
    const b = fixtures.bookings(new Date(0), new Date(8.64e15)).find((x) => x.id === id);
    return b ? { ...b, notes: '', bookingFeeCents: 222, paidCents: b.status === 'completed' ? b.subtotalCents : b.depositCents } : null;
  }
  const { data, error } = await db()
    .from('bookings')
    .select(`${BOOKING_SELECT}, notes, booking_fee_cents, payments(amount_cents, status, kind)`)
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const row = data as unknown as BookingRow & {
    notes: string;
    booking_fee_cents: number;
    payments: { amount_cents: number; status: string; kind: string }[];
  };
  return {
    ...toBooking(row),
    notes: row.notes,
    bookingFeeCents: row.booking_fee_cents,
    paidCents: row.payments.filter((p) => p.status === 'succeeded').reduce((n, p) => n + p.amount_cents, 0),
  };
}

export async function fetchClientBookings(clientId: string): Promise<Booking[]> {
  if (!supabase) return fixtures.bookings(new Date(0), new Date(8.64e15)).filter((b) => b.client.id === clientId);
  const { data, error } = await db()
    .from('bookings')
    .select(BOOKING_SELECT)
    .eq('client_id', clientId)
    .in('status', ['confirmed', 'completed', 'no_show', 'cancelled'])
    .order('starts_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data as unknown as BookingRow[]).map(toBooking);
}

/** Detailer-side status changes allowed by RLS column grants. */
export async function setBookingStatus(id: string, status: 'completed' | 'no_show'): Promise<void> {
  if (!supabase) return;
  const { error } = await db().from('bookings').update({ status }).eq('id', id);
  if (error) throw error;
}

export async function cancelBooking(id: string): Promise<{ refundCents: number }> {
  if (!supabase) return { refundCents: 0 };
  return api(`/api/bookings/${id}/cancel`, { method: 'POST' });
}

export async function requestBalanceLink(id: string): Promise<{ url: string; balanceCents: number; bookingFeeCents: number }> {
  if (!supabase) return { url: 'https://checkout.stripe.com/preview', balanceCents: 16800, bookingFeeCents: 523 };
  return api(`/api/bookings/${id}/balance`, { method: 'POST' });
}

export async function startPayoutsSetup(): Promise<string> {
  const { url } = await api<{ url: string }>('/api/stripe/connect', { method: 'POST' });
  return url;
}

/** Refreshes the public booking page after catalog or availability edits. */
export async function refreshBookingPage(): Promise<void> {
  if (!supabase) return;
  await api('/api/revalidate', { method: 'POST' }).catch(() => {}); // best effort: the page also refreshes within minutes
}

export class ApiError extends Error {
  constructor(public status: number, public body: unknown) {
    super(`api ${status}`);
  }
}

export async function deleteAccount(): Promise<void> {
  const { data } = await db().auth.getSession();
  const res = await fetch(`${apiBaseUrl}/api/account`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${data.session?.access_token ?? ''}` },
  });
  if (!res.ok) throw new ApiError(res.status, await res.json().catch(() => null));
  clearCache();
  await db().auth.signOut({ scope: 'local' });
}

export type CatalogService = {
  id: string;
  name: string;
  description: string;
  durationMin: number;
  priceCents: { sedan: number; suv: number; truck: number };
  active: boolean;
  sortOrder: number;
};
export type CatalogAddOn = { id: string; name: string; priceCents: number; active: boolean; sortOrder: number };

export async function fetchCatalog(): Promise<{ services: CatalogService[]; addOns: CatalogAddOn[] }> {
  if (!supabase) return fixtures.catalog;
  const [s, a] = await Promise.all([
    db().from('services').select('id, name, description, duration_min, price_sedan_cents, price_suv_cents, price_truck_cents, active, sort_order').order('sort_order'),
    db().from('add_ons').select('id, name, price_cents, active, sort_order').order('sort_order'),
  ]);
  if (s.error) throw s.error;
  if (a.error) throw a.error;
  return {
    services: s.data.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      durationMin: r.duration_min,
      priceCents: { sedan: r.price_sedan_cents, suv: r.price_suv_cents, truck: r.price_truck_cents },
      active: r.active,
      sortOrder: r.sort_order,
    })),
    addOns: a.data.map((r) => ({ id: r.id, name: r.name, priceCents: r.price_cents, active: r.active, sortOrder: r.sort_order })),
  };
}

export type QuoteItem = { label: string; cents: number };

/** Saves a quote (status sent or draft). Totals are whole cents. */
export async function saveQuote(q: {
  vehicleSize: 'sedan' | 'suv' | 'truck';
  vehicleDesc: string;
  items: QuoteItem[];
  notes: string;
  status: 'draft' | 'sent';
}): Promise<string> {
  if (!supabase) return 'preview';
  const { data: user } = await db().auth.getUser();
  const total = q.items.reduce((n, i) => n + i.cents, 0);
  const { data, error } = await db()
    .from('quotes')
    .insert({
      detailer_id: user.user?.id,
      vehicle_size: q.vehicleSize,
      vehicle_desc: q.vehicleDesc,
      items: q.items,
      total_cents: total,
      notes: q.notes,
      status: q.status,
    })
    .select('id')
    .single();
  if (error) throw error;
  return data.id as string;
}

// ---------------------------------------------------------------------------

export type QueryState<T> = {
  data: T | undefined;
  error: Error | null;
  loading: boolean;
  /** True when showing saved (offline) data because the network failed. */
  stale: boolean;
  refresh: () => void;
};

/**
 * Minimal query hook: loads on mount, reloads whenever the screen regains
 * focus, and keeps showing the last data while refreshing. With `cacheKey`,
 * the last good result is saved on the device and shown at once on launch
 * and whenever the network is unavailable (offline schedule).
 */
export function useQuery<T>(fn: () => Promise<T>, deps: readonly unknown[] = [], cacheKey?: string): QueryState<T> {
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);
  const [stale, setStale] = useState(false);
  const seq = useRef(0);
  const fnRef = useRef(fn);
  useEffect(() => {
    fnRef.current = fn;
  });

  const key = JSON.stringify([deps, cacheKey]);
  const run = useCallback(() => {
    const id = ++seq.current;
    let settled = false;
    setLoading(true);
    if (cacheKey) {
      readCache<T>(cacheKey).then((hit) => {
        // Only fill in if the network hasn't answered yet.
        if (hit && !settled && id === seq.current) {
          setData((d) => d ?? hit.data);
          setStale(true);
        }
      });
    }
    fnRef
      .current()
      .then((d) => {
        settled = true;
        if (id !== seq.current) return;
        setData(d);
        setError(null);
        setStale(false);
        if (cacheKey) writeCache(cacheKey, d);
      })
      .catch((e: unknown) => {
        settled = true;
        if (id === seq.current) setError(e instanceof Error ? e : new Error(String(e)));
      })
      .finally(() => {
        if (id === seq.current) setLoading(false);
      });
    // `key` stands in for the caller's deps (fn itself is read through a ref).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useFocusEffect(run);
  return { data, error, loading, stale, refresh: run };
}
