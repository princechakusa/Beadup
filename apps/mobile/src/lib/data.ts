import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';

import { clearCache, readCache, writeCache } from './cache';
import { fixtures } from './fixtures';
import { addDaysKey, dateKey, isCountry, setMoneyCountry, startOfDay, type Country } from './format';
import { apiBaseUrl, supabase } from './supabase';

// Data access for the detailer app. Every query runs as the signed-in
// detailer, so row level security limits it to their own rows; no query
// filters by detailer id client-side for security.

export type Profile = { id: string; handle: string; businessName: string; timezone: string; country: Country };

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
  /** External payments: the detailer marked the deposit as paid to them. */
  depositReceived: boolean;
  /** External payments: the client tapped "I've sent the deposit" (not confirmed until depositReceived). */
  depositReported: boolean;
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
  'id, starts_at, duration_min, service_name, vehicle_size, status, subtotal_cents, deposit_cents, deposit_received_at, deposit_reported_at, address, add_ons, client:clients(id, name, phone)';

type BookingRow = {
  id: string;
  starts_at: string;
  duration_min: number;
  service_name: string;
  vehicle_size: Booking['vehicleSize'];
  status: BookingStatus;
  subtotal_cents: number;
  deposit_cents: number;
  deposit_received_at: string | null;
  deposit_reported_at: string | null;
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
  depositReceived: !!r.deposit_received_at,
  depositReported: !!r.deposit_reported_at,
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
  // "*" rather than a column list: works before and after the country column
  // exists, so an app update can never get ahead of the database.
  const { data, error } = await db().from('detailers').select('*').maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const country: Country = isCountry(data.country) ? data.country : 'US';
  setMoneyCountry(country);
  return { id: data.id, handle: data.handle, businessName: data.business_name, timezone: data.timezone, country };
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
  if (!res.ok) throw new ApiError(res.status, await res.json().catch(() => null));
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

export type RescheduleError = 'overlap' | 'time' | 'status' | 'not_found';

/** Moves a booking (checked on the server: owner only, future, no overlap with other jobs or travel time). */
export async function rescheduleBooking(id: string, startsAt: Date): Promise<{ ok: true } | { ok: false; error: RescheduleError }> {
  if (!supabase) return { ok: true };
  const { data, error } = await db().rpc('reschedule_booking', { p_booking_id: id, p_starts_at: startsAt.toISOString() });
  if (error) throw error;
  const r = data as { ok: boolean; error?: RescheduleError };
  if (!r.ok) return { ok: false, error: r.error ?? 'not_found' };
  await refreshBookingPage();
  return { ok: true };
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

export type PlanUsage = { plan: 'free' | 'pro'; used: number; limit: number };

export async function fetchPlanUsage(): Promise<PlanUsage> {
  if (!supabase) return { plan: 'free', used: 3, limit: 5 };
  const { data, error } = await db().rpc('plan_usage');
  if (error) throw error;
  return data as PlanUsage;
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
  /** An AI draft created by the server: update it instead of inserting. */
  quoteId?: string | null;
  vehicleSize: 'sedan' | 'suv' | 'truck';
  vehicleDesc: string;
  items: QuoteItem[];
  notes: string;
  status: 'draft' | 'sent';
}): Promise<string> {
  if (!supabase) return 'preview';
  const total = q.items.reduce((n, i) => n + i.cents, 0);
  if (q.quoteId) {
    const { error } = await db()
      .from('quotes')
      .update({ vehicle_size: q.vehicleSize, vehicle_desc: q.vehicleDesc, items: q.items, total_cents: total, notes: q.notes, status: q.status })
      .eq('id', q.quoteId);
    if (error) throw error;
    return q.quoteId;
  }
  const { data: user } = await db().auth.getUser();
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
  const hasData = useRef(false);
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
        // Show the saved copy while the network answers, without calling it
        // "offline": that label only appears if the fetch actually fails
        // (otherwise it flickers on every open).
        if (hit && !settled && id === seq.current) {
          hasData.current = true;
          setData((d) => d ?? hit.data);
        }
      });
    }
    fnRef
      .current()
      .then((d) => {
        settled = true;
        if (id !== seq.current) return;
        hasData.current = true;
        setData(d);
        setError(null);
        setStale(false);
        if (cacheKey) writeCache(cacheKey, d);
      })
      .catch((e: unknown) => {
        settled = true;
        if (id !== seq.current) return;
        setError(e instanceof Error ? e : new Error(String(e)));
        // The network failed: whatever is on screen is the last saved copy.
        if (hasData.current) setStale(true);
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

// Launch mode (owner decision 2026-11-07): clients pay deposits to the
// detailer directly via the detailer's own link or note; Beadup never touches
// the money. "stripe" switches the in-app Stripe flows back on.
export type PaymentsMode = 'stripe' | 'external';

export async function fetchPaymentsMode(): Promise<PaymentsMode> {
  if (!supabase) return 'external';
  const { data, error } = await db().rpc('payments_mode');
  if (error) throw error;
  return data === 'stripe' ? 'stripe' : 'external';
}

/** Payments mode for screens; external until the server says otherwise. */
export function usePaymentsMode(): PaymentsMode {
  return useQuery(fetchPaymentsMode, [], 'payments-mode').data ?? 'external';
}

export type PaymentDetails = { link: string | null; note: string | null };

export async function fetchPaymentDetails(): Promise<PaymentDetails> {
  if (!supabase) return fixtures.paymentDetails;
  const { data, error } = await db().from('detailers').select('payment_link, payment_note').maybeSingle();
  if (error) throw error;
  return { link: data?.payment_link ?? null, note: data?.payment_note ?? null };
}

/**
 * Cleans a typed payment link: adds https:// when missing, refuses plain
 * http and anything that isn't a web address. Same rule as the database check.
 */
export function normalizePaymentLink(input: string): { ok: true; link: string | null } | { ok: false; error: string } {
  const t = input.trim();
  if (!t) return { ok: true, link: null };
  if (/^http:\/\//i.test(t)) return { ok: false, error: 'Use the https:// version of the link.' };
  const link = /^https:\/\//i.test(t) ? `https://${t.slice(8)}` : `https://${t}`;
  if (link.length > 300 || !/^https:\/\/[^\s<>"]+\.[^\s<>"]+$/.test(link)) return { ok: false, error: 'That doesn’t look like a web link.' };
  try {
    new URL(link);
  } catch {
    return { ok: false, error: 'That doesn’t look like a web link.' };
  }
  return { ok: true, link };
}

export async function savePaymentDetails(d: PaymentDetails): Promise<void> {
  if (!supabase) return;
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error('signed out');
  const { error } = await db()
    .from('detailers')
    .update({ payment_link: d.link, payment_note: d.note?.trim() ? d.note.trim().slice(0, 200) : null })
    .eq('id', user.user.id);
  if (error) throw error;
  await refreshBookingPage();
}

export type BusinessProfile = {
  businessName: string;
  tagline: string;
  serviceArea: string;
  handle: string;
  country: Country;
  /** Public phone on the booking page and confirmation (E.164), or null. */
  contactPhone: string | null;
};

export async function fetchBusinessProfile(): Promise<BusinessProfile | null> {
  if (!supabase) return fixtures.businessProfile;
  const { data, error } = await db().from('detailers').select('*').maybeSingle();
  if (error) throw error;
  return (
    data && {
      businessName: data.business_name,
      tagline: data.tagline,
      serviceArea: data.service_area,
      handle: data.handle,
      country: isCountry(data.country) ? data.country : 'US',
      contactPhone: data.contact_phone ?? null,
    }
  );
}

/** Name, tagline and service area shown on the booking page (the handle stays fixed so shared links keep working). */
export async function saveBusinessProfile(p: Omit<BusinessProfile, 'handle'>): Promise<void> {
  if (!supabase) return;
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error('signed out');
  const { error } = await db()
    .from('detailers')
    .update({
      business_name: p.businessName.trim(),
      tagline: p.tagline.trim(),
      service_area: p.serviceArea.trim(),
      country: p.country,
      contact_phone: p.contactPhone,
    })
    .eq('id', user.user.id);
  if (error) throw error;
  setMoneyCountry(p.country);
  await refreshBookingPage();
}

/** External payments: the detailer confirms (or undoes) that the client paid the deposit to them. */
export async function markDepositReceived(id: string, received: boolean): Promise<void> {
  if (!supabase) return;
  const { data, error } = await db().rpc('mark_deposit_received', { p_booking_id: id, p_received: received });
  if (error) throw error;
  if (!(data as { ok?: boolean } | null)?.ok) throw new Error('not allowed');
}

export type ReviewLink = { url: string; reviewed: boolean };

/**
 * The client's private review page for a completed job (/r/<token>). Clients
 * can rate a job once; the detailer sends the link themselves (texts from
 * Beadup are off), from their own Messages app.
 */
export async function fetchReviewLink(bookingId: string): Promise<ReviewLink | null> {
  if (!supabase) return { url: `${apiBaseUrl}/r/${'0'.repeat(48)}`, reviewed: false };
  const { data, error } = await db()
    .from('bookings')
    .select('review_token, status, reviews(id)')
    .eq('id', bookingId)
    .maybeSingle();
  if (error) throw error;
  if (!data || data.status !== 'completed' || !data.review_token) return null;
  const reviews = data.reviews as unknown;
  const reviewed = Array.isArray(reviews) ? reviews.length > 0 : !!reviews;
  return { url: `${apiBaseUrl}/r/${data.review_token}`, reviewed };
}

export type Review = { id: string; rating: number; body: string; createdAt: string; clientName: string };

/** The detailer's reviews, newest first (read-only: detailers can't edit or hide them). */
export async function fetchReviews(): Promise<Review[]> {
  if (!supabase) return fixtures.reviews;
  const { data, error } = await db()
    .from('reviews')
    .select('id, rating, body, created_at, booking:bookings(client:clients(name))')
    .eq('hidden', false)
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data ?? []).map((r) => {
    const booking = (Array.isArray(r.booking) ? r.booking[0] : r.booking) as { client?: { name?: string } | { name?: string }[] } | null;
    const client = Array.isArray(booking?.client) ? booking?.client[0] : booking?.client;
    const full = client?.name ?? 'Client';
    const [first, last] = full.split(' ');
    return { id: r.id, rating: r.rating, body: r.body, createdAt: r.created_at, clientName: last ? `${first} ${last[0]}.` : first };
  });
}

export type ReferralStatus = {
  code: string;
  invited: number;
  rewarded: number;
  bonusProUntil: string | null;
  referredBy: string | null;
  canClaim: boolean;
};

/** Invite & earn: your code (your handle), how many invites paid off, and whether you can still enter who referred you. */
export async function fetchReferralStatus(): Promise<ReferralStatus | null> {
  if (!supabase) return { code: 'marcus', invited: 2, rewarded: 1, bonusProUntil: null, referredBy: null, canClaim: true };
  const { data, error } = await db().rpc('referral_status');
  if (error) throw error;
  return (data as ReferralStatus | null) ?? null;
}

export type ClaimError = 'self' | 'not_found' | 'already_claimed' | 'too_late' | 'no_profile' | 'unavailable';

/** Records who referred this detailer (a handle, or a booking link ending in one). */
export async function claimReferral(code: string): Promise<{ ok: true } | { ok: false; error: ClaimError }> {
  if (!supabase) return { ok: true };
  const { data, error } = await db().rpc('claim_referral', { p_code: code });
  if (error) return { ok: false, error: 'unavailable' };
  const res = data as { ok: boolean; error?: ClaimError };
  return res.ok ? { ok: true } : { ok: false, error: res.error ?? 'unavailable' };
}

// ---------------------------------------------------------------------------
// Days off and travel time (Settings > Availability).

/** Upcoming whole days off ("YYYY-MM-DD", business timezone). */
export async function fetchDaysOff(fromKey: string): Promise<string[]> {
  if (!supabase) return [];
  const { data, error } = await db().from('days_off').select('day').gte('day', fromKey).order('day');
  if (error) throw error;
  return data.map((r) => String(r.day));
}

export async function setDayOff(day: string, off: boolean): Promise<void> {
  if (!supabase) return;
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error('signed out');
  const { error } = off
    ? await db().from('days_off').upsert({ detailer_id: user.user.id, day }, { onConflict: 'detailer_id,day', ignoreDuplicates: true })
    : await db().from('days_off').delete().eq('day', day);
  if (error) throw error;
  await refreshBookingPage();
}

/** Minutes kept free between jobs for travel. */
export async function fetchBufferMin(): Promise<number> {
  if (!supabase) return 0;
  const { data, error } = await db().from('detailers').select('*').maybeSingle();
  if (error) throw error;
  return typeof data?.buffer_min === 'number' ? data.buffer_min : 0;
}

export async function saveBufferMin(minutes: number): Promise<void> {
  if (!supabase) return;
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error('signed out');
  const { error } = await db().from('detailers').update({ buffer_min: minutes }).eq('id', user.user.id);
  if (error) throw error;
  await refreshBookingPage();
}

// ---------------------------------------------------------------------------
// Today > Needs attention: only things the detailer has to act on, from real rows.

/** A client's request from their booking page (beadup.app/b/...). The detailer decides. */
export type BookingRequest = {
  id: string;
  bookingId: string;
  kind: 'reschedule' | 'cancel';
  /** Up to three "YYYY-MM-DD HH:MM" start times in the business timezone. */
  preferred: string[];
  note: string;
  createdAt: string;
};

type RequestRow = { id: string; booking_id: string; kind: BookingRequest['kind']; preferred: string[]; note: string; created_at: string };
const toRequest = (r: RequestRow): BookingRequest => ({
  id: r.id,
  bookingId: r.booking_id,
  kind: r.kind,
  preferred: r.preferred ?? [],
  note: r.note,
  createdAt: r.created_at,
});

/** The open request on a booking, if any. */
export async function fetchBookingRequest(bookingId: string): Promise<BookingRequest | null> {
  if (!supabase) return null;
  const { data, error } = await db()
    .from('booking_requests')
    .select('id, booking_id, kind, preferred, note, created_at')
    .eq('booking_id', bookingId)
    .eq('status', 'open')
    .maybeSingle();
  if (error) throw error;
  return data ? toRequest(data as RequestRow) : null;
}

/** Closes a request without acting on it (moving or cancelling the booking closes it by itself). */
export async function dismissBookingRequest(id: string): Promise<void> {
  if (!supabase) return;
  const { data, error } = await db().rpc('dismiss_booking_request', { p_request_id: id });
  if (error) throw error;
  if (!(data as { ok?: boolean } | null)?.ok) throw new Error('not found');
}

export type Attention = {
  /** Clients asking to move or cancel, newest first, with their booking. */
  requests: { request: BookingRequest; booking: Booking }[];
  /** External payments: confirmed jobs whose deposit isn't marked received ("client says sent" first). */
  depositsToConfirm: Booking[];
  /** Jobs that ended but were never marked done or no-show. */
  toCloseOut: Booking[];
  /** Confirmed jobs tomorrow: a reminder the day before cuts no-shows. */
  tomorrow: Booking[];
  /** Setup gaps clients would notice. */
  missingPayment: boolean;
  missingPhone: boolean;
  missingPhoto: boolean;
};

export async function fetchAttention(external: boolean, tz = 'America/Chicago'): Promise<Attention> {
  if (!supabase) {
    const all = fixtures.bookings(new Date(Date.now() - 7 * 86_400_000), new Date(Date.now() + 7 * 86_400_000));
    return {
      depositsToConfirm: external ? all.filter((b) => b.status === 'confirmed' && !b.depositReceived && Date.parse(b.startsAt) > Date.now()) : [],
      toCloseOut: [],
      requests: [],
      tomorrow: [],
      missingPayment: false,
      missingPhone: false,
      missingPhoto: false,
    };
  }
  const now = Date.now();
  const tomorrowKey = addDaysKey(dateKey(new Date(now), tz), 1);
  const [deposits, past, me, reqs, tmrw] = await Promise.all([
    external
      ? db()
          .from('bookings')
          .select(BOOKING_SELECT)
          .eq('status', 'confirmed')
          .is('deposit_received_at', null)
          .gte('starts_at', new Date(now - 12 * 3_600_000).toISOString())
          .order('starts_at')
          .limit(20)
      : Promise.resolve({ data: [], error: null }),
    db()
      .from('bookings')
      .select(BOOKING_SELECT)
      .eq('status', 'confirmed')
      .gte('starts_at', new Date(now - 60 * 86_400_000).toISOString())
      .lt('starts_at', new Date(now - 3_600_000).toISOString())
      .order('starts_at', { ascending: false })
      .limit(20),
    db().from('detailers').select('*').maybeSingle(),
    db()
      .from('booking_requests')
      .select(`id, booking_id, kind, preferred, note, created_at, booking:bookings(${BOOKING_SELECT})`)
      .eq('status', 'open')
      .order('created_at', { ascending: false })
      .limit(10),
    db()
      .from('bookings')
      .select(BOOKING_SELECT)
      .eq('status', 'confirmed')
      .gte('starts_at', startOfDay(tomorrowKey, tz).toISOString())
      .lt('starts_at', startOfDay(addDaysKey(tomorrowKey, 1), tz).toISOString())
      .order('starts_at')
      .limit(10),
  ]);
  // Requests are an extra: if they can't load, still show the rest of the card.
  if (reqs.error) console.warn('booking requests unavailable', reqs.error.code);
  if (deposits.error) throw deposits.error;
  if (past.error) throw past.error;
  if (me.error) throw me.error;
  const toBookings = (rows: unknown) => (rows as BookingRow[]).map(toBooking);
  const depositsToConfirm = toBookings(deposits.data).sort((a, b) => Number(b.depositReported) - Number(a.depositReported));
  // Ended at least 30 minutes ago.
  const toCloseOut = toBookings(past.data).filter((b) => Date.parse(b.startsAt) + (b.durationMin + 30) * 60_000 < now);
  const requests = ((reqs.error ? [] : reqs.data) as unknown as (RequestRow & { booking: BookingRow | null })[])
    .filter((r) => r.booking)
    .map((r) => ({ request: toRequest(r), booking: toBooking(r.booking!) }));
  return {
    requests,
    tomorrow: tmrw.error ? [] : toBookings(tmrw.data),
    depositsToConfirm,
    toCloseOut,
    missingPayment: external && !me.data?.payment_link && !me.data?.payment_note,
    missingPhone: !me.data?.contact_phone,
    missingPhoto: !me.data?.photo_path,
  };
}

/** The client's private booking page (view, pay the deposit, ask to change), for the detailer to resend. */
export async function fetchClientLink(bookingId: string): Promise<string | null> {
  if (!supabase) return `${apiBaseUrl}/b/${'0'.repeat(48)}`;
  const { data, error } = await db().rpc('client_link_token', { p_booking_id: bookingId });
  if (error) throw error;
  return typeof data === 'string' && /^[0-9a-f]{48}$/.test(data) ? `${apiBaseUrl}/b/${data}` : null;
}
