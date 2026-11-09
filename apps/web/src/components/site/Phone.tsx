import { getImageProps } from "next/image";

export const SCREENS = {
  today: { src: "/app/today.webp", alt: "Beadup Today screen: earnings this week, jobs, average ticket, rating and the next job with a Start route button" },
  quote: { src: "/app/quote.webp", alt: "Beadup New quote screen: AI photo scan, vehicle size, services and add-ons with prices" },
  calendar: { src: "/app/calendar.webp", alt: "Beadup Calendar screen: a week strip and a day timeline of booked jobs" },
  booking: { src: "/app/booking.webp", alt: "A client booking page made with Beadup: pick a detail, with prices from each service" },
  money: { src: "/app/money.webp", alt: "Beadup Money screen: earned this month, still booked, deposits received and recent jobs" },
  payment: { src: "/app/payment.webp", alt: "Beadup Payment link screen, where a detailer adds the link clients use to pay the deposit" },
} as const;

export type ScreenName = keyof typeof SCREENS;

/**
 * A real app screenshot in a glass device frame. Uses next/image's
 * getImageProps so the <img> carries no style="" attribute (CSP has no
 * 'unsafe-inline' for styles).
 */
export function Phone({
  screen,
  priority = false,
  sizes = "(min-width: 1024px) 320px, 70vw",
  className = "",
  glow = true,
}: {
  screen: ScreenName;
  priority?: boolean;
  sizes?: string;
  className?: string;
  glow?: boolean;
}) {
  const { src, alt } = SCREENS[screen];
  const {
    props: { style: _style, ...img },
  } = getImageProps({ src, alt, width: 922, height: 2010, sizes, priority, quality: 85 });
  void _style;
  return (
    <div className={`relative ${className}`}>
      {glow && (
        <div aria-hidden="true" className="pointer-events-none absolute -inset-[18%] rounded-full bg-[radial-gradient(closest-side,rgba(77,216,255,0.22),rgba(77,216,255,0))] blur-2xl" />
      )}
      <div className="relative rounded-[15%/7%] bg-gradient-to-b from-[#3a4250] via-[#1b2028] to-[#2c333f] p-[3.2%] shadow-[0_50px_100px_-30px_rgba(0,0,0,0.9),0_0_0_1px_rgba(255,255,255,0.06)]">
        <div className="relative overflow-hidden rounded-[12%/5.6%] bg-midnight ring-1 ring-black/60">
          {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text -- props come from getImageProps */}
          <img {...img} className="block h-auto w-full" />
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[linear-gradient(115deg,rgba(255,255,255,0.08)_0%,rgba(255,255,255,0)_32%)]" />
        </div>
        <div aria-hidden="true" className="absolute left-1/2 top-[1.9%] h-[2.6%] w-[28%] -translate-x-1/2 rounded-full bg-black" />
      </div>
    </div>
  );
}
