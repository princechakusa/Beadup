import { ImageResponse } from "next/og";
import { getBookingPage } from "@/lib/booking-page";
import { formatMoney } from "@/lib/countries";
import { OG_LOGO } from "@/lib/og-logo";

// The preview card shown when a detailer pastes their link into a text,
// iMessage, Instagram DM or Facebook: business name, area, rating and
// starting prices, in the Beadup dark-glass look.
export const alt = "Book online with this detailer";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";


export default async function Image({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const d = await getBookingPage(handle);
  const name = d?.businessName ?? "Book a detail";
  const services = (d?.services ?? []).slice(0, 3);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "64px 72px",
          background: "radial-gradient(ellipse 80% 70% at 85% 0%, rgba(77,216,255,0.28), rgba(10,12,16,0) 60%), #0A0C10",
          color: "#F4F6FA",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse renders plain <img> */}
          <img src={OG_LOGO} width={64} height={64} alt="" style={{ borderRadius: 16, boxShadow: "0 0 40px rgba(77,216,255,0.45)" }} />
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: 22, color: "#9AA3B2", letterSpacing: 4, textTransform: "uppercase" }}>Book online</span>
            {d?.serviceArea ? <span style={{ fontSize: 26, color: "#C9D0DB" }}>{`Mobile detailing · ${d.serviceArea}`}</span> : null}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <span style={{ fontSize: name.length > 22 ? 76 : 96, fontWeight: 800, letterSpacing: -3, lineHeight: 1 }}>{name}</span>
          {d?.rating && d.reviewCount > 0 ? (
            <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 30, color: "#FFB547" }}>
              <svg width="30" height="30" viewBox="0 0 24 24" fill="#FFB547">
                <path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z" />
              </svg>
              <span>{`${d.rating.toFixed(1)}  ·  ${d.reviewCount} review${d.reviewCount === 1 ? "" : "s"}`}</span>
            </div>
          ) : null}
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div style={{ display: "flex", gap: 16 }}>
            {services.map((s) => (
              <div
                key={s.id}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  padding: "18px 22px",
                  borderRadius: 22,
                  border: "1px solid rgba(255,255,255,0.12)",
                  background: "rgba(255,255,255,0.05)",
                  maxWidth: 280,
                }}
              >
                <span style={{ fontSize: 22, color: "#C9D0DB" }}>{s.name.length > 22 ? `${s.name.slice(0, 21)}…` : s.name}</span>
                <span style={{ fontSize: 34, fontWeight: 800, color: "#FFB547" }}>{`from ${formatMoney(Math.round(s.priceCents.sedan / 100) * 100, d?.country ?? "US")}`}</span>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse renders plain <img> */}
            <img src={OG_LOGO} width={30} height={30} alt="" style={{ borderRadius: 8 }} />
            <span style={{ fontSize: 26, color: "#F4F6FA", fontWeight: 700 }}>beadup</span>
          </div>
        </div>
      </div>
    ),
    size,
  );
}
