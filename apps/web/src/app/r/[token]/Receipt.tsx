import { z } from "zod";
import { formatMoney, formatPhone, whatsappUrl, type Country } from "@/lib/countries";
import { tierLabel } from "@/lib/trades";
import { PrintButton } from "./PrintButton";

export const receiptSchema = z.object({
  ref: z.string(),
  handle: z.string(),
  trade: z.string().default("detailing"),
  businessName: z.string(),
  contactPhone: z.string().nullable(),
  country: z.enum(["US", "CA", "GB", "AU", "NZ", "AE", "ZA", "SG"]),
  timezone: z.string(),
  firstName: z.string(),
  serviceName: z.string(),
  vehicleSize: z.enum(["sedan", "suv", "truck"]),
  addOns: z.array(z.object({ name: z.string(), priceCents: z.number().int().optional() })),
  startsAt: z.string(),
  completedAt: z.string().nullable(),
  status: z.string(),
  subtotalCents: z.number().int(),
  depositCents: z.number().int(),
  depositPaid: z.boolean(),
});
export type ReceiptData = z.infer<typeof receiptSchema>;


/**
 * The client's receipt for a finished job, in the detailer's currency. Prints
 * (or saves as PDF) on its own: the print stylesheet hides everything else.
 */
export function Receipt({ r }: { r: ReceiptData }) {
  const money = (c: number) => formatMoney(c, r.country as Country);
  const extras = r.addOns.reduce((n, a) => n + (a.priceCents ?? 0), 0);
  const date = new Date(r.completedAt ?? r.startsAt).toLocaleDateString("en-US", {
    timeZone: r.timezone,
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  return (
    <section aria-label="Receipt" className="print-receipt rounded-[24px] border border-white/10 bg-white/[0.03] p-5 text-left">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[12px] uppercase tracking-[0.18em] text-steel">Receipt</p>
          <h2 className="mt-1 font-display text-xl font-bold">{r.businessName}</h2>
          {r.contactPhone && <p className="text-[13px] text-steel">{formatPhone(r.contactPhone, r.country as Country)}</p>}
        </div>
        <div className="text-right text-[13px] text-steel">
          <p>No. {r.ref}</p>
          <p>{date}</p>
        </div>
      </div>
      <p className="mt-4 text-[13px] text-steel">For {r.firstName}</p>
      <div className="mt-3 border-t border-white/10 pt-3 text-[15px]">
        <Line label={[r.serviceName, tierLabel(r.trade, r.vehicleSize)].filter(Boolean).join(" · ")} value={money(r.subtotalCents - extras)} />
        {r.addOns.map((a) => (
          <Line key={a.name} label={a.name} value={a.priceCents != null ? money(a.priceCents) : ""} />
        ))}
        <div className="mt-2 border-t border-white/10 pt-2">
          <Line label="Total" value={money(r.subtotalCents)} strong />
          {r.depositCents > 0 && r.depositPaid && <Line label="Deposit paid" value={`- ${money(r.depositCents)}`} />}
          {r.depositCents > 0 && r.depositPaid && <Line label="Balance at the job" value={money(r.subtotalCents - r.depositCents)} />}
        </div>
      </div>
      <p className="mt-4 text-[12px] text-steel">Paid directly to {r.businessName}. Issued with Beadup.</p>
      <div className="no-print mt-4 flex gap-2">
        <PrintButton />
        {r.contactPhone && (
          <a
            href={whatsappUrl(r.contactPhone, `Hi ${r.businessName}, it's ${r.firstName} about receipt ${r.ref}.`)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-11 flex-1 items-center justify-center rounded-full border border-[#25D366]/40 bg-[#25D366]/10 text-[14px] font-semibold text-[#7ff0a8]"
          >
            WhatsApp {r.businessName.split(" ")[0]}
          </a>
        )}
      </div>
    </section>
  );
}

function Line({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex justify-between gap-4 py-1 ${strong ? "font-semibold" : ""}`}>
      <span className={strong ? "" : "text-steel"}>{label}</span>
      <span>{value}</span>
    </div>
  );
}
