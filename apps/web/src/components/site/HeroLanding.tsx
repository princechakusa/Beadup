import Link from "next/link";
import type { ReactNode } from "react";
import { AppStoreButton } from "./AppStoreButton";
import { Phone } from "./Phone";
import {
  IconArrowRight,
  IconBell,
  IconCamera,
  IconCalendar,
  IconShield,
  IconSparkle,
  IconStar,
  IconUsers,
} from "./Icons";

// Landing hero, laid out after the owner's approved mockup (2026-11-11):
// wet-paint backdrop with water beads, tilted phone, "Booking confirmed" card,
// a 4-up feature bar, and a "Let clients book in seconds" browser mockup.
// Tailwind classes only: the nonce CSP forbids inline styles in server HTML.

/** Wet paint backdrop: the owner's photo of a beaded hood. */
function Beads() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* the owner's wet-hood photo, darkened on the left so the headline reads */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/hero/hood.webp" alt="" fetchPriority="high" className="absolute inset-y-0 right-0 h-full w-full object-cover object-[70%_center] lg:w-[78%]" />
      <div className="absolute inset-0 bg-gradient-to-r from-midnight via-midnight/80 to-midnight/10" />
      <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-midnight/80 to-transparent" />
      {/* fade into the page below */}
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-midnight" />
    </div>
  );
}

/** The real app: the Today screen screenshot in our device frame, with side buttons. */
function HeroPhone() {
  return (
    <div className="relative mx-auto w-[270px] rotate-[8deg] sm:w-[320px]">
      <span aria-hidden="true" className="absolute -left-[5px] top-[18%] h-[6%] w-[5px] rounded-l-md bg-[#2c333f]" />
      <span aria-hidden="true" className="absolute -left-[5px] top-[27%] h-[10%] w-[5px] rounded-l-md bg-[#2c333f]" />
      <span aria-hidden="true" className="absolute -right-[5px] top-[24%] h-[14%] w-[5px] rounded-r-md bg-[#2c333f]" />
      <Phone screen="today" priority sizes="(min-width: 640px) 320px, 270px" />
    </div>
  );
}

export function HeroLanding() {
  const chips: { icon: (p: { size?: number; className?: string }) => ReactNode; label: string }[] = [
    { icon: IconCalendar, label: "Manage your schedule" },
    { icon: IconSparkle, label: "Get paid faster" },
    { icon: IconShield, label: "Keep more of what you earn" },
  ];
  return (
    <section aria-labelledby="hero-title" className="relative -mt-24 overflow-hidden pt-24">
      <Beads />
      <div className="relative mx-auto grid w-full max-w-6xl items-center gap-14 px-5 pb-20 pt-10 sm:px-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,460px)] lg:pt-16">
        <div className="flex flex-col items-start gap-7">
          <h1 id="hero-title" className="enter font-display text-[56px] font-extrabold leading-[0.95] tracking-[-0.05em] text-paint sm:text-[84px]">
            Quote it.
            <br />
            Book it.
            <br />
            <span className="relative inline-block bg-gradient-to-r from-[#4DD8FF] to-[#1e8bff] bg-clip-text text-transparent">
              Get paid.
              <span aria-hidden="true" className="absolute -bottom-2 left-0 h-[6px] w-full rounded-full bg-gradient-to-r from-transparent via-[#1e8bff] to-transparent blur-[1px]" />
            </span>
          </h1>
          <p className="enter d-2 max-w-[440px] text-[22px] leading-snug text-mist">
            The booking and quoting app built for mobile car detailers.
          </p>
          <div className="enter d-3 flex flex-wrap items-center gap-4">
            <AppStoreButton />
            <Link
              href="/beadup-demo-detailing"
              className="group inline-flex h-[60px] items-center gap-3 rounded-full border border-white/40 px-7 font-semibold text-paint transition-colors hover:bg-white/[0.08]"
            >
              <IconCalendar size={20} />
              Try a booking page
              <IconArrowRight size={18} className="transition-transform duration-300 group-hover:translate-x-0.5" />
            </Link>
          </div>
          <ul className="enter d-4 flex flex-wrap items-center gap-y-3 text-[16px] text-paint">
            {chips.map(({ icon: Icon, label }, i) => (
              <li key={label} className={`flex items-center gap-2.5 pr-5 ${i > 0 ? "border-l border-white/25 pl-5" : ""}`}>
                <Icon size={22} className="text-bead" />
                {label}
              </li>
            ))}
          </ul>
        </div>
        <div className="enter d-2 pb-6 pt-10 lg:pt-0">
          <HeroPhone />
        </div>
      </div>
    </section>
  );
}

export function FeatureBar() {
  const items: { icon: (p: { size?: number; className?: string }) => ReactNode; title: string; text: string }[] = [
    { icon: IconCamera, title: "AI photo quotes", text: "Turn photos into instant quotes" },
    { icon: IconBell, title: "Booking alerts", text: "Never miss a booking again" },
    { icon: IconShield, title: "30% deposits", text: "Secure your bookings upfront" },
    { icon: IconUsers, title: "Clients", text: "Grow your customer base" },
    { icon: IconStar, title: "Reviews", text: "Build trust and get more jobs" },
  ];
  return (
    <section aria-labelledby="features-title" className="mx-auto w-full max-w-6xl px-5 sm:px-8">
      <div className="text-center">
        <h2 id="features-title" className="font-display text-[36px] font-extrabold tracking-[-0.03em] text-paint sm:text-[44px]">Powerful features</h2>
        <p className="mt-2 text-[17px] text-mist">Everything you need to grow your detailing business.</p>
      </div>
      <ul className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {items.map(({ icon: Icon, title, text }) => (
          <li key={title} className="group flex flex-col items-center rounded-[22px] border border-white/10 bg-white/[0.04] px-4 py-7 text-center backdrop-blur transition duration-300 hover:-translate-y-1 hover:border-bead/40 hover:bg-white/[0.06]">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-bead/10 text-bead shadow-[0_0_30px_rgba(77,216,255,0.15)]">
              <Icon size={28} />
            </span>
            <span className="mt-4 block text-[16px] font-semibold text-paint">{title}</span>
            <span className="mt-1 block text-[13.5px] leading-snug text-mist">{text}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function BookInSeconds() {
  const services = [
    { name: "Basic detail", price: "$60" },
    { name: "Full detail", price: "$120", on: true },
    { name: "Premium detail", price: "$180" },
  ];
  const times = ["9:00 AM", "10:30 AM", "12:00 PM", "2:00 PM", "3:30 PM", "5:00 PM"];
  return (
    <section aria-labelledby="book-seconds-title" className="relative mt-24 overflow-hidden">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_70%_at_30%_60%,rgba(30,139,255,0.18),rgba(30,139,255,0))]" />
      <div className="relative mx-auto grid w-full max-w-6xl items-center gap-14 px-5 sm:px-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        {/* Browser window with the client booking page */}
        <div className="-rotate-[2deg] overflow-hidden rounded-[22px] border border-white/15 bg-[#0d1220] shadow-[0_50px_100px_-20px_rgba(0,0,0,0.8),0_0_60px_rgba(30,139,255,0.2)]">
          <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
            <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
            <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
            <span className="h-3 w-3 rounded-full bg-[#28c840]" />
            <span className="ml-4 flex-1 rounded-md bg-white/[0.06] px-3 py-1 text-center text-[12px] text-mist">beadup.app/yourname</span>
          </div>
          <div className="bg-gradient-to-r from-[#0d1a33] to-[#0a1424] px-6 py-4">
            <span className="font-display text-[22px] font-bold text-paint">
              <span className="text-bead">●</span> bead<span className="text-bead">up</span>
            </span>
          </div>
          <div className="bg-[#f4f6fa] px-6 pb-7 pt-5 text-[#0a0c10]">
            <div className="font-display text-[22px] font-bold">Book your detailing service</div>
            <div className="text-[13px] text-[#4a5468]">Choose a service and pick a time that works for you.</div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl bg-white p-4 shadow-sm">
                <div className="text-[14px] font-semibold">Select service</div>
                <ul className="mt-3 flex flex-col gap-2 text-[13px]">
                  {services.map((s) => (
                    <li key={s.name} className={`flex items-center justify-between rounded-xl px-3 py-2 ${s.on ? "bg-[#dbeafe]" : ""}`}>
                      <span className="flex items-center gap-2">
                        <span className={`h-4 w-4 rounded-full border-2 ${s.on ? "border-[#1e8bff] bg-[#1e8bff] ring-2 ring-white ring-inset" : "border-[#9aa3b2]"}`} />
                        {s.name}
                      </span>
                      <span className="font-semibold">{s.price}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-2xl bg-white p-4 shadow-sm">
                <div className="text-[14px] font-semibold">Available times</div>
                <ul className="mt-3 grid grid-cols-3 gap-2 text-[12px]">
                  {times.map((t, i) => (
                    <li key={t} className={`rounded-lg border px-1 py-2 text-center ${i === 0 ? "border-[#1e8bff] bg-[#dbeafe]" : "border-[#d6dbe4]"}`}>
                      {t}
                    </li>
                  ))}
                </ul>
                <div className="mt-3 rounded-full bg-[#1e8bff] py-2 text-center text-[13px] font-semibold text-white">Book now</div>
              </div>
            </div>
          </div>
        </div>
        <div>
          <h2 id="book-seconds-title" className="font-display text-[44px] font-extrabold leading-[1.02] tracking-[-0.04em] text-paint sm:text-[56px]">
            Let clients book
            <br />
            <span className="text-bead">in seconds</span>
          </h2>
          <p className="mt-6 max-w-[440px] text-[19px] leading-relaxed text-mist">
            Share your booking link and let customers book directly from any browser, no app required.
          </p>
          <div aria-hidden="true" className="mt-8 h-[3px] w-32 rounded-full bg-gradient-to-r from-[#1e8bff] to-transparent" />
        </div>
      </div>
    </section>
  );
}
