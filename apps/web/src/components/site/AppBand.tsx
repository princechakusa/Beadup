import qrcode from "qrcode-generator";
import { APP_DOWNLOAD_URL, AppStoreButton } from "./AppStoreButton";
import { IconBell, IconCalendar, IconWallet } from "./Icons";
import { Phone } from "./Phone";

/** QR code as one SVG path (no inline styles: the CSP forbids them). Scans with glare or a scuff (level Q). */
export function Qr({ value }: { value: string }) {
  const qr = qrcode(0, "Q");
  qr.addData(value);
  qr.make();
  const n = qr.getModuleCount();
  let d = "";
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) d += `M${c} ${r}h1v1h-1z`;
  return (
    <svg viewBox={`-2 -2 ${n + 4} ${n + 4}`} role="img" aria-label="QR code that opens Beadup in the App Store" className="h-[150px] w-[150px]" shapeRendering="crispEdges">
      <path d={d} fill="#0A0C10" />
    </svg>
  );
}

const POINTS = [
  { icon: IconWallet, title: "Quote and get paid", text: "Your prices, deposits and receipts in one link" },
  { icon: IconCalendar, title: "Your calendar", text: "Open times only, no double bookings" },
  { icon: IconBell, title: "Instant alerts", text: "A push the moment someone books" },
];

/** "Get more with the Beadup app": phone, three reasons and a QR code to scan from a computer. */
export function AppBand({ className = "" }: { className?: string }) {
  return (
    <section aria-labelledby="app-band-title" className={`mx-auto w-full max-w-6xl px-5 sm:px-8 ${className}`}>
      <div className="glass glass-edge relative overflow-hidden rounded-[32px] px-6 pt-8 sm:px-10 lg:grid lg:grid-cols-[170px_minmax(0,1fr)_200px] lg:items-center lg:gap-10 lg:py-0 lg:pt-0">
        <div aria-hidden="true" className="pointer-events-none absolute -left-16 -top-28 h-[380px] w-[520px] rounded-full bg-[radial-gradient(closest-side,rgba(77,216,255,0.2),transparent)]" />
        <div className="relative hidden h-[250px] self-end overflow-hidden lg:block">
          <Phone screen="today" glow={false} sizes="170px" className="mt-6" />
        </div>
        <div className="relative flex flex-col gap-3 lg:py-9">
          <p className="text-sm text-steel">Built for solo pros in 8 countries</p>
          <h2 id="app-band-title" className="font-display text-[28px] font-extrabold leading-[1.1] tracking-[-0.03em] sm:text-[32px]">
            Get more with the Beadup app
          </h2>
          <p className="max-w-xl text-base leading-relaxed text-mist">Quote, book and get paid from your phone. Clients book from any browser.</p>
          <ul className="mt-2 grid gap-4 sm:grid-cols-3">
            {POINTS.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/25 text-bead">
                  <Icon size={18} />
                </span>
                <span className="text-[14px] leading-snug">
                  <b className="block font-semibold">{title}</b>
                  <span className="text-steel">{text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div className="relative my-8 flex flex-col items-center gap-3 lg:my-0">
          {APP_DOWNLOAD_URL ? (
            <div className="hidden w-[200px] flex-col items-center gap-2 rounded-[22px] bg-white p-3.5 lg:flex">
              <Qr value={APP_DOWNLOAD_URL} />
              <span className="text-center text-[13px] font-semibold text-midnight">Scan to download for iPhone</span>
            </div>
          ) : null}
          {/* Phones tap a button; computers scan the code. */}
          <div className={APP_DOWNLOAD_URL ? "lg:hidden" : ""}>
            <AppStoreButton size="md" />
          </div>
        </div>
      </div>
    </section>
  );
}
