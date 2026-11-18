import Link from "next/link";
import type { ReactNode } from "react";
import { BeadLogo } from "@/components/BeadLogo";
import { SAMPLE_PAGE } from "@/lib/site";
import { AppStoreButton } from "./AppStoreButton";
import { AquaHero } from "./AquaHero";
import { IconArrowRight } from "./Icons";
import { MobileMenu } from "./MobileMenu";

const NAV = [
  { href: "/#features", label: "Features" },
  { href: "/for", label: "Who it's for" },
  { href: "/find", label: "Find a pro" },
  { href: "/pricing", label: "Pricing" },
  { href: "/blog", label: "Guides" },
  { href: "/support", label: "Support" },
];

export function Wordmark({ size = 30 }: { size?: number }) {
  return (
    <span className="flex items-center gap-2">
      <BeadLogo size={size} animate={false} />
      <span className="font-display text-[22px] font-extrabold tracking-[-0.045em] text-paint">beadup</span>
    </span>
  );
}

export function SkipLink() {
  return (
    <a
      href="#main"
      className="sr-only rounded-full bg-bead px-4 py-2 font-semibold text-bead-ink focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50"
    >
      Skip to content
    </a>
  );
}

export function SiteHeader() {
  return (
    <>
      <SkipLink />
      <header className="sticky top-0 z-40 px-3 pt-3 sm:px-5">
        <div className="glass relative mx-auto flex h-16 [background:linear-gradient(180deg,rgb(22_26_33/0.92),rgb(12_15_20/0.88))] w-full max-w-6xl items-center justify-between rounded-[22px] pl-4 pr-2.5 sm:pl-5">
          <Link href="/" aria-label="Beadup home" className="rounded-xl">
            <Wordmark />
          </Link>
          <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
            {NAV.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="rounded-full px-4 py-2 text-[15px] font-medium text-mist transition-colors hover:bg-white/[0.05] hover:text-paint"
              >
                {l.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <Link
              href="/#get-the-app"
              className="btn-sheen inline-flex h-11 items-center gap-1.5 rounded-full bg-bead px-4 text-[15px] font-bold text-bead-ink shadow-[0_8px_28px_-6px_rgba(77,216,255,0.6)] transition-transform duration-300 ease-(--ease-spring) hover:-translate-y-px active:scale-[0.97] sm:px-5"
            >
              Get the app
            </Link>
            <MobileMenu links={[...NAV, { href: SAMPLE_PAGE, label: "Sample booking page" }]} />
          </div>
        </div>
      </header>
    </>
  );
}

// Four plain columns of links, like a store footer: no headings, generous spacing.
const FOOTER_COLUMNS: { href: string; label: string }[][] = [
  [
    { href: "/#features", label: "Features" },
    { href: "/#how-it-works", label: "How it works" },
    { href: "/pricing", label: "Pricing" },
    { href: SAMPLE_PAGE, label: "Sample booking page" },
    { href: "/find", label: "Find a pro" },
  ],
  [
    { href: "/for", label: "Who it's for" },
    { href: "/blog", label: "Guides" },
    { href: "/support", label: "Support" },
    { href: "/#faq", label: "FAQ" },
    { href: "/delete-account", label: "Delete account" },
  ],
  [
    { href: "/for/car-detailers", label: "Car detailers" },
    { href: "/for/hair-salons", label: "Hair salons" },
    { href: "/for/barbers", label: "Barbers" },
    { href: "/for/nail-technicians", label: "Nails and beauty" },
    { href: "/for/pet-groomers", label: "Pet groomers" },
  ],
  [
    { href: "/privacy", label: "Privacy policy" },
    { href: "/terms", label: "Terms of service" },
    { href: "/refund-policy", label: "Refund policy" },
  ],
];

const SOCIALS = [
  {
    label: "Beadup on Instagram",
    href: "https://www.instagram.com/beadupapp/",
    path: "M7 3h10a4 4 0 0 1 4 4v10a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V7a4 4 0 0 1 4-4zm5 5a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm5.5-2.2a1.1 1.1 0 1 0 0 2.2 1.1 1.1 0 0 0 0-2.2z",
  },
  {
    label: "Beadup on X",
    href: "https://x.com/Beadupapp",
    path: "M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z",
  },
  {
    label: "Beadup on Facebook",
    href: "https://www.facebook.com/profile.php?id=61596086686334",
    path: "M13.5 21.5v-8h2.7l.4-3.2h-3.1V8.4c0-.9.3-1.5 1.6-1.5h1.7V4.1c-.3 0-1.3-.1-2.4-.1-2.4 0-4.1 1.5-4.1 4.2v2.4H7.5v3.2h2.8v8h3.2z",
  },
  {
    label: "Beadup on Pinterest",
    href: "https://www.pinterest.com/beadupapp/",
    path: "M12 2a10 10 0 0 0-3.6 19.3c-.1-.8-.2-2 0-2.9l1.2-5s-.3-.6-.3-1.5c0-1.4.8-2.4 1.8-2.4.9 0 1.3.6 1.3 1.4 0 .9-.5 2.1-.8 3.300-.2 1 .5 1.800 1.500 1.800 1.800 0 3.200-1.900 3.200-4.600 0-2.400-1.700-4.100-4.200-4.100-2.800 0-4.500 2.100-4.500 4.300 0 .9.300 1.800.7 2.300.1.100.1.200.1.300l-.3 1.100c0 .2-.1.200-.3.100-1.300-.6-2.100-2.500-2.100-4 0-3.300 2.400-6.300 6.900-6.300 3.600 0 6.400 2.600 6.400 6 0 3.600-2.300 6.500-5.400 6.500-1.100 0-2.100-.6-2.400-1.200l-.7 2.500c-.2.900-.9 2.100-1.300 2.800A10 10 0 1 0 12 2z",
  },
];

export function SiteFooter() {
  return (
    <footer className="relative mt-24 bg-gunmetal">
      <div className="mx-auto w-full max-w-6xl px-5 pb-10 pt-16 sm:px-8">
        <Link href="/" aria-label="Beadup home" className="inline-block rounded-xl">
          <Wordmark size={34} />
        </Link>
        <nav aria-label="Footer" className="mt-12 grid grid-cols-2 gap-x-8 gap-y-9 pl-1 sm:pl-5 lg:grid-cols-4">
          {FOOTER_COLUMNS.map((col, i) => (
            <ul key={i} className="flex flex-col gap-6 sm:gap-9">
              {col.map((l) => (
                <li key={l.label}>
                  <Link href={l.href} className="text-[16px] text-paint/90 transition-colors hover:text-bead">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          ))}
        </nav>
        <div className="mt-14 flex flex-col gap-6 border-t border-white/[0.1] pt-8 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-5">
            <ul className="flex items-center gap-5">
              {SOCIALS.map((s) => (
                <li key={s.href}>
                  <a href={s.href} aria-label={s.label} rel="noopener" className="text-paint transition-colors hover:text-bead">
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <path d={s.path} fillRule="evenodd" />
                    </svg>
                  </a>
                </li>
              ))}
            </ul>
          </div>
          <AppStoreButton size="md" />
        </div>
      </div>
    </footer>
  );
}

/** Page frame for every marketing page: header, main landmark, footer, ambient light. */
export function SitePage({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-dvh flex-col overflow-x-clip">
      <Ambient />
      <SiteHeader />
      <main id="main" className="relative flex-1">
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}

/** Soft bead-blue light pooled at the top of the page. */
export function Ambient() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 -z-0 h-[900px] overflow-hidden">
      <div className="absolute left-1/2 top-[-420px] h-[820px] w-[1100px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(77,216,255,0.16),rgba(77,216,255,0))]" />
      <div className="bg-grid absolute inset-0 opacity-70" />
    </div>
  );
}

export function slug(text: string) {
  return text
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** A document section heading with a stable anchor (used by the table of contents). */
export function H2({ children }: { children: string }) {
  const id = slug(children);
  return (
    <h2 id={id} className="group">
      <a href={`#${id}`} className="!text-paint !no-underline">
        {children}
        <span aria-hidden="true" className="ml-2 text-bead opacity-0 transition-opacity group-hover:opacity-100">
          #
        </span>
      </a>
    </h2>
  );
}

/** Long-form page layout for policies and help: title block, sticky contents, readable measure. */
export function DocPage({
  eyebrow,
  title,
  updated,
  intro,
  toc,
  children,
}: {
  eyebrow?: string;
  title: string;
  updated?: string;
  intro?: ReactNode;
  /** Section headings, in order; each must match an <H2> in the page. */
  toc?: string[];
  children: ReactNode;
}) {
  return (
    <SitePage>
      <AquaHero eyebrow={eyebrow} title={title} below={updated ? <p className="text-sm text-mist">Last updated {updated}</p> : undefined}>
        {intro}
      </AquaHero>
      <div className="mx-auto w-full max-w-6xl px-5 pt-12 sm:px-8">
        <div className={`grid gap-10 ${toc ? "lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-16" : ""}`}>
          {toc && (
            <>
              <details className="glass group rounded-[22px] lg:hidden">
                <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-4 font-semibold [&::-webkit-details-marker]:hidden">
                  On this page
                  <span aria-hidden="true" className="text-steel transition-transform group-open:rotate-45">
                    +
                  </span>
                </summary>
                <TocList items={toc} />
              </details>
              <aside className="hidden lg:block">
                <nav aria-label="On this page" className="sticky top-28">
                  <p className="px-3 text-[12px] font-semibold uppercase tracking-[0.16em] text-steel">On this page</p>
                  <TocList items={toc} />
                </nav>
              </aside>
            </>
          )}
          <article className="doc min-w-0 max-w-[68ch]">{children}</article>
        </div>
      </div>
    </SitePage>
  );
}

function TocList({ items }: { items: string[] }) {
  return (
    <ol className="flex flex-col gap-0.5 px-2 pb-3 pt-1 lg:mt-2 lg:border-l lg:border-white/[0.07] lg:px-0">
      {items.map((t, i) => (
        <li key={t}>
          <a
            href={`#${slug(t)}`}
            className="flex gap-3 rounded-xl px-3 py-2 text-[14px] text-steel transition-colors hover:bg-white/[0.04] hover:text-paint lg:-ml-px lg:rounded-none lg:border-l lg:border-transparent lg:hover:border-bead lg:hover:bg-transparent"
          >
            <span className="w-5 shrink-0 tabular-nums text-steel/70">{String(i + 1).padStart(2, "0")}</span>
            {t}
          </a>
        </li>
      ))}
    </ol>
  );
}

export function ButtonLink({ href, children, variant = "primary" }: { href: string; children: ReactNode; variant?: "primary" | "ghost" }) {
  const cls =
    variant === "primary"
      ? "btn-sheen bg-bead text-bead-ink shadow-[0_14px_40px_-10px_rgba(77,216,255,0.6)]"
      : "border border-white/[0.12] bg-white/[0.04] text-paint hover:bg-white/[0.08]";
  return (
    <Link
      href={href}
      className={`inline-flex h-14 items-center gap-2 rounded-[18px] px-6 font-semibold transition-all duration-300 ease-(--ease-spring) hover:-translate-y-0.5 active:scale-[0.97] ${cls}`}
    >
      {children}
      <IconArrowRight size={18} />
    </Link>
  );
}
