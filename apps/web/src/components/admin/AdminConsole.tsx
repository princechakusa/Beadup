"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { BeadLogo } from "@/components/BeadLogo";
import type { AdminOverview } from "@/lib/admin";

type State = { kind: "loading" } | { kind: "signed-out" } | { kind: "ready"; data: AdminOverview } | { kind: "error" };

const COUNTRY: Record<string, string> = { US: "United States", CA: "Canada", GB: "United Kingdom", AU: "Australia", NZ: "New Zealand", AE: "United Arab Emirates", ZA: "South Africa", SG: "Singapore" };
const shortDate = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

async function post(url: string, body: unknown) {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return { status: res.status, json: (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; overview?: AdminOverview } };
}

export function AdminConsole() {
  const [state, setState] = useState<State>({ kind: "loading" });

  const load = useCallback(async () => {
    const res = await fetch("/api/admin", { cache: "no-store" });
    if (res.status === 401) return setState({ kind: "signed-out" });
    const json = (await res.json().catch(() => null)) as { overview?: AdminOverview } | null;
    setState(json?.overview ? { kind: "ready", data: json.overview } : { kind: "error" });
  }, []);

  useEffect(() => {
    // Initial load from the admin API (client-only page).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  return (
    <main id="main" className="relative mx-auto min-h-dvh w-full max-w-6xl px-5 pb-20 pt-8 sm:px-8">
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px] bg-[radial-gradient(ellipse_70%_60%_at_50%_0%,rgba(77,216,255,0.14),transparent)]" />
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <BeadLogo size={28} animate={false} />
          <span className="font-display text-xl font-extrabold tracking-[-0.04em]">beadup</span>
          <span className="ml-1 rounded-full border border-gold/30 bg-gold/10 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-gold">Admin</span>
        </div>
        {state.kind === "ready" && (
          <div className="flex items-center gap-3 text-[13px] text-steel">
            <span className="hidden sm:inline">{state.data.admin}</span>
            <button
              type="button"
              className="rounded-full border border-white/10 px-3.5 py-1.5 font-semibold text-mist hover:bg-white/[0.05]"
              onClick={async () => {
                await fetch("/api/admin/auth", { method: "DELETE" });
                setState({ kind: "signed-out" });
              }}
            >
              Sign out
            </button>
          </div>
        )}
      </header>

      {state.kind === "loading" && <p className="mt-24 text-center text-steel">Loading…</p>}
      {state.kind === "error" && <p className="mt-24 text-center text-steel">Could not load the dashboard. Check the server configuration.</p>}
      {state.kind === "signed-out" && <SignIn onDone={load} />}
      {state.kind === "ready" && <Dashboard data={state.data} onChange={(d) => setState({ kind: "ready", data: d })} />}
    </main>
  );
}

function SignIn({ onDone }: { onDone: () => void }) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { status, json } = await post("/api/admin/auth", sent ? { step: "verify", email, code } : { step: "send", email });
    setBusy(false);
    if (status === 429) return setError("Too many tries. Wait a few minutes.");
    if (!sent) return json.ok ? setSent(true) : setError("Enter a valid email.");
    if (json.ok) return onDone();
    setError("That code didn't work. Check the latest email and try again.");
  }

  return (
    <form onSubmit={submit} className="glass glass-edge mx-auto mt-24 flex w-full max-w-sm flex-col gap-4 rounded-[28px] p-7">
      <h1 className="font-display text-2xl font-bold">Admin sign-in</h1>
      <p className="text-[14px] leading-relaxed text-steel">
        {sent ? `If ${email} is an admin, a sign-in code is on its way.` : "Only Beadup admins can sign in here."}
      </p>
      <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-mist">
        Email
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          disabled={sent}
          onChange={(e) => setEmail(e.target.value)}
          className="h-12 rounded-[14px] border border-white/10 bg-white/[0.04] px-4 text-[15px] font-normal text-paint outline-none focus:border-bead/60"
        />
      </label>
      {sent && (
        <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-mist">
          Code from the email
          <input
            inputMode="numeric"
            autoComplete="one-time-code"
            required
            pattern="[0-9]{6,10}"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            className="h-12 rounded-[14px] border border-white/10 bg-white/[0.04] px-4 text-[17px] tracking-[0.3em] text-paint outline-none focus:border-bead/60"
          />
        </label>
      )}
      {error && <p className="text-[13px] text-danger">{error}</p>}
      <button type="submit" disabled={busy} className="btn-sheen h-12 rounded-[16px] bg-bead font-bold text-bead-ink disabled:opacity-60">
        {busy ? "…" : sent ? "Sign in" : "Email me a code"}
      </button>
    </form>
  );
}

function Tile({ label, value, tone = "paint", sub }: { label: string; value: ReactNode; tone?: "paint" | "gold" | "bead"; sub?: string }) {
  const color = tone === "gold" ? "text-gold" : tone === "bead" ? "text-bead" : "text-paint";
  return (
    <div className="glass rounded-[22px] p-5">
      <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-steel">{label}</p>
      <p className={`mt-2 font-display text-3xl font-extrabold tracking-[-0.03em] ${color}`}>{value}</p>
      {sub && <p className="mt-1 text-[12px] text-steel">{sub}</p>}
    </div>
  );
}

function Dashboard({ data, onChange }: { data: AdminOverview; onChange: (d: AdminOverview) => void }) {
  const t = data.totals;
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const detailers = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? data.detailers.filter((d) => d.handle.includes(q) || d.businessName.toLowerCase().includes(q)) : data.detailers;
  }, [data.detailers, query]);

  async function act(key: string, body: unknown, done: string) {
    setBusy(key);
    setNotice(null);
    const { json } = await post("/api/admin", body);
    setBusy(null);
    if (json.ok && json.overview) {
      onChange(json.overview);
      setNotice(done);
    } else setNotice("That didn't work. Refresh and try again.");
  }

  return (
    <div className="mt-10 flex flex-col gap-10">
      <section aria-label="Totals" className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-5">
        <Tile label="Detailers" value={t.detailers} sub={`+${t.newThisWeek} this week`} />
        <Tile label="Live booking pages" value={t.published} />
        <Tile label="Bookings · 30 days" value={t.bookings30d} sub={`${t.completed30d} completed`} />
        <Tile label="Pro (paid)" value={t.pro} tone="gold" sub={`${t.bonusPro} on free months`} />
        <Tile label="Referrals" value={t.referrals} tone="bead" sub={`${t.reviews} reviews`} />
      </section>

      <section aria-label="Countries" className="flex flex-wrap gap-2">
        {Object.entries(data.byCountry).map(([c, n]) => (
          <span key={c} className="glass rounded-full px-4 py-2 text-[13px] text-mist">
            {COUNTRY[c] ?? c} <span className="ml-1 font-semibold text-paint">{n}</span>
          </span>
        ))}
      </section>

      {notice && (
        <p role="status" className="rounded-[14px] border border-bead/30 bg-bead/[0.06] px-4 py-3 text-[14px] text-paint">
          {notice}
        </p>
      )}

      {data.deletionRequests.length > 0 && (
        <section aria-labelledby="del-title" className="glass rounded-[24px] border border-danger/25 p-6">
          <h2 id="del-title" className="font-display text-xl font-bold">
            Account deletion requests <span className="text-danger">({t.openDeletionRequests})</span>
          </h2>
          <p className="mt-1 text-[13px] text-steel">
            From the website form. Delete the account in the Supabase dashboard (Authentication → Users), then close the request.
          </p>
          <ul className="mt-4 flex flex-col divide-y divide-white/[0.06]">
            {data.deletionRequests.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <p className="font-semibold">{r.email}</p>
                  <p className="text-[13px] text-steel">
                    {shortDate(r.createdAt)}
                    {r.note ? ` · ${r.note}` : ""}
                  </p>
                </div>
                <div className="flex gap-2">
                  <SmallButton disabled={busy !== null} onClick={() => act(`del-${r.id}`, { type: "deletion.close", id: r.id, status: "done" }, "Marked as deleted.")}>
                    Deleted
                  </SmallButton>
                  <SmallButton disabled={busy !== null} onClick={() => act(`del-${r.id}`, { type: "deletion.close", id: r.id, status: "no_account" }, "Closed: no account.")}>
                    No account
                  </SmallButton>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="err-title" className="glass rounded-[24px] p-6">
        <h2 id="err-title" className="font-display text-xl font-bold">
          Recent errors <span className="text-steel">({data.errors.length})</span>
        </h2>
        <p className="mt-1 text-[13px] text-steel">Crashes from the website, the server and the app, last 30 days. No personal details are stored.</p>
        {data.errors.length === 0 ? (
          <p className="mt-4 text-[14px] text-mist">Nothing reported.</p>
        ) : (
          <ul className="mt-4 flex flex-col divide-y divide-white/[0.06]">
            {data.errors.map((e) => (
              <li key={e.id} className="py-3">
                <p className="break-words font-mono text-[13px] text-paint">{e.message}</p>
                <p className="mt-1 text-[12px] text-steel">
                  {e.source} · {shortDate(e.createdAt)}
                  {e.where ? ` · ${e.where}` : ""}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="det-title">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 id="det-title" className="font-display text-2xl font-bold">
            Detailers
          </h2>
          <input
            type="search"
            placeholder="Search name or handle"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-11 w-full max-w-xs rounded-[14px] border border-white/10 bg-white/[0.04] px-4 text-[14px] text-paint outline-none focus:border-bead/60"
          />
        </div>
        <div className="glass mt-4 overflow-x-auto rounded-[24px]">
          <table className="w-full min-w-[760px] text-left text-[14px]">
            <thead className="text-[12px] uppercase tracking-[0.12em] text-steel">
              <tr className="border-b border-white/[0.06]">
                <th className="px-5 py-3 font-semibold">Business</th>
                <th className="px-3 py-3 font-semibold">Country</th>
                <th className="px-3 py-3 font-semibold">Joined</th>
                <th className="px-3 py-3 font-semibold">Bookings</th>
                <th className="px-3 py-3 font-semibold">Plan</th>
                <th className="px-5 py-3 text-right font-semibold">Free Pro</th>
              </tr>
            </thead>
            <tbody>
              {detailers.map((d) => (
                <tr key={d.id} className="border-b border-white/[0.04] last:border-0">
                  <td className="px-5 py-3">
                    <p className="font-semibold text-paint">{d.businessName}</p>
                    <a href={`/${d.handle}`} target="_blank" rel="noopener" className="text-[13px] text-bead hover:underline">
                      /{d.handle}
                    </a>
                    {!d.published && <span className="ml-2 text-[12px] text-steel">(not live)</span>}
                  </td>
                  <td className="px-3 py-3 text-mist">{d.country}</td>
                  <td className="px-3 py-3 text-mist">{shortDate(d.createdAt)}</td>
                  <td className="px-3 py-3 text-mist">{d.bookings}</td>
                  <td className="px-3 py-3">
                    <span className={d.plan === "pro" ? "font-semibold text-gold" : "text-steel"}>{d.plan === "pro" ? "Pro" : "Free"}</span>
                    {d.bonusProUntil && <p className="text-[12px] text-steel">free until {shortDate(d.bonusProUntil)}</p>}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <div className="inline-flex gap-1.5">
                      {[1, 3].map((m) => (
                        <SmallButton
                          key={m}
                          disabled={busy !== null}
                          onClick={() => act(`pro-${d.id}`, { type: "pro.grant", detailerId: d.id, months: m }, `Gave ${d.businessName} ${m} free month${m > 1 ? "s" : ""} of Pro.`)}
                        >
                          +{m} mo
                        </SmallButton>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
              {detailers.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-steel">
                    No detailers yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="rev-title">
        <h2 id="rev-title" className="font-display text-2xl font-bold">
          Reviews
        </h2>
        <p className="mt-1 text-[13px] text-steel">Hide only reviews that break the rules (abuse, spam, personal data). Detailers can&apos;t hide reviews themselves.</p>
        <ul className="mt-4 grid gap-3 md:grid-cols-2">
          {data.reviews.map((r) => (
            <li key={r.id} className={`glass rounded-[20px] p-5 ${r.hidden ? "opacity-50" : ""}`}>
              <div className="flex items-center justify-between gap-3">
                <span className="font-semibold text-gold" aria-label={`${r.rating} out of 5`}>
                  {"★".repeat(r.rating)}
                  <span className="text-white/15">{"★".repeat(5 - r.rating)}</span>
                </span>
                <span className="text-[12px] text-steel">
                  /{r.handle} · {shortDate(r.createdAt)}
                </span>
              </div>
              {r.body && <p className="mt-2 text-[14px] leading-relaxed text-mist">{r.body}</p>}
              <div className="mt-3">
                <SmallButton
                  disabled={busy !== null}
                  onClick={() => act(`rev-${r.id}`, { type: "review.hide", id: r.id, hidden: !r.hidden }, r.hidden ? "Review shown again." : "Review hidden.")}
                >
                  {r.hidden ? "Show" : "Hide"}
                </SmallButton>
              </div>
            </li>
          ))}
          {data.reviews.length === 0 && <li className="text-steel">No reviews yet.</li>}
        </ul>
      </section>
    </div>
  );
}

function SmallButton({ children, onClick, disabled }: { children: ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[13px] font-semibold text-paint transition-colors hover:bg-white/[0.09] disabled:opacity-50"
    >
      {children}
    </button>
  );
}
