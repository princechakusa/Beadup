"use client";

import { useEffect, useState } from "react";
import type { AdminOverview, AuditEntry } from "@/lib/admin";

/** Admin > Audit trail: the append-only audit_log, filterable by event or actor. */
export function AuditTrail() {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<AuditEntry[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const t = setTimeout(async () => {
      const res = await fetch(`/api/admin?view=audit&q=${encodeURIComponent(q)}`, { cache: "no-store" });
      const json = (await res.json().catch(() => null)) as { audit?: AuditEntry[] } | null;
      setFailed(!json?.audit);
      setRows(json?.audit ?? []);
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <section aria-labelledby="audit-title">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="audit-title" className="font-display text-2xl font-bold">
            Audit trail
          </h2>
          <p className="mt-1 text-[13px] text-steel">Append-only record of money, account and admin events. Newest first, last 100 matches.</p>
        </div>
        <input
          type="search"
          placeholder="Filter by event or actor"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Filter the audit trail"
          className="h-11 w-full max-w-xs rounded-[14px] border border-white/10 bg-white/[0.04] px-4 text-[14px] text-paint outline-none focus:border-bead/60"
        />
      </div>
      <div className="glass mt-4 overflow-x-auto rounded-[24px]">
        <table className="w-full min-w-[640px] text-left text-[13px]">
          <thead className="text-[12px] uppercase tracking-[0.12em] text-steel">
            <tr className="border-b border-white/[0.06]">
              <th className="px-5 py-3 font-semibold">When</th>
              <th className="px-3 py-3 font-semibold">Event</th>
              <th className="px-3 py-3 font-semibold">Actor</th>
              <th className="px-5 py-3 font-semibold">Details</th>
            </tr>
          </thead>
          <tbody>
            {(rows ?? []).map((r) => (
              <tr key={r.id} className="border-b border-white/[0.04] align-top last:border-0">
                <td className="whitespace-nowrap px-5 py-2.5 text-mist">
                  {new Date(r.createdAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                </td>
                <td className="px-3 py-2.5 font-mono text-[12px] text-paint">{r.event}</td>
                <td className="max-w-[180px] truncate px-3 py-2.5 text-mist">{r.actor}</td>
                <td className="px-5 py-2.5">
                  {r.handle ? <span className="mr-2 text-bead">/{r.handle}</span> : null}
                  <span className="break-words font-mono text-[11px] text-steel">{JSON.stringify(r.data).slice(0, 160)}</span>
                </td>
              </tr>
            ))}
            {rows !== null && rows.length === 0 && (
              <tr>
                <td colSpan={4} className="px-5 py-8 text-center text-steel">
                  {failed ? "Could not load the audit trail." : "Nothing matches."}
                </td>
              </tr>
            )}
            {rows === null && (
              <tr>
                <td colSpan={4} className="px-5 py-8 text-center text-steel">
                  Loading…
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/** Admin > Security: how this session is protected, with a sign-out. */
export function Security({ data }: { data: AdminOverview }) {
  const expires = data.sessionExpiresAt ? new Date(data.sessionExpiresAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }) : "unknown";
  const facts: [string, string][] = [
    ["Signed in as", data.admin],
    ["Session ends", `${expires} at the latest (sessions last up to one hour)`],
    ["Idle sign-out", "after 15 minutes without use"],
    ["Cookie", "httpOnly, Secure, SameSite=Strict; page scripts can't read it"],
    ["Sign-in", "one-time email code, only for addresses in ADMIN_EMAILS; 8 attempts per 15 minutes per IP; failures are logged"],
    ["Every action", "re-verified on the server, Origin checked on writes, recorded in the audit trail"],
  ];
  return (
    <section aria-labelledby="sec-title" className="glass rounded-[24px] p-6">
      <h2 id="sec-title" className="font-display text-2xl font-bold">
        Security and session
      </h2>
      <dl className="mt-4 divide-y divide-white/[0.06]">
        {facts.map(([k, v]) => (
          <div key={k} className="grid gap-1 py-3 sm:grid-cols-[180px_1fr]">
            <dt className="text-[13px] font-semibold text-steel">{k}</dt>
            <dd className="text-[14px] text-paint">{v}</dd>
          </div>
        ))}
      </dl>
      <button
        type="button"
        className="mt-4 rounded-full border border-white/10 px-4 py-2 text-[14px] font-semibold text-mist hover:bg-white/[0.05]"
        onClick={async () => {
          await fetch("/api/admin/auth", { method: "DELETE" });
          window.location.reload();
        }}
      >
        Sign out of this session
      </button>
    </section>
  );
}
