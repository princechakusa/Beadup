import Link from "next/link";
import type { ReactNode } from "react";
import { BeadLogo } from "@/components/BeadLogo";
import { SAMPLE_PAGE } from "@/lib/site";
import { IconArrowRight } from "./Icons";
import { MobileMenu } from "./MobileMenu";

const NAV = [
  { href: "/#features", label: "Features" },
  { href: "/#how-it-works", label: "How it works" },
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
        <div className="glass relative mx-auto flex h-16 w-full max-w-6xl items-center justify-between rounded-[22px] pl-4 pr-2.5 sm:pl-5">
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

const FOOTER = [
  {
    title: "Product",
    links: [
      { href: "/#features", label: "Features" },
      { href: "/#how-it-works", label: "How it works" },
      { href: "/pricing", label: "Pricing" },
      { href: SAMPLE_PAGE, label: "Sample booking page" },
    ],
  },
  {
    title: "Help",
    links: [
      { href: "/support", label: "Support" },
      { href: "/#faq", label: "FAQ" },
      { href: "/blog", label: "Guides for detailers" },
      { href: "/delete-account", label: "Delete account" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "/privacy", label: "Privacy policy" },
      { href: "/terms", label: "Terms of service" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="relative mt-28 border-t border-white/[0.06]">
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-bead/40 to-transparent" />
      <div className="mx-auto grid w-full max-w-6xl gap-12 px-5 py-14 sm:px-8 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div className="flex flex-col gap-4">
          <Wordmark />
          <p className="max-w-xs text-[15px] leading-relaxed text-steel">
            Quote, book and get paid. The app for mobile car detailers, with a booking link your clients love.
          </p>
        </div>
        {FOOTER.map((col) => (
          <nav key={col.title} aria-label={col.title} className="flex flex-col gap-3">
            <h2 className="text-[13px] font-semibold uppercase tracking-[0.14em] text-steel">{col.title}</h2>
            {col.links.map((l) => (
              <Link key={l.href} href={l.href} className="w-fit text-[15px] text-mist transition-colors hover:text-paint">
                {l.label}
              </Link>
            ))}
          </nav>
        ))}
      </div>
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 border-t border-white/[0.05] px-5 py-6 text-[13px] text-steel sm:flex-row sm:justify-between sm:px-8">
        <span>© 2026 Beadup. All rights reserved.</span>
        <span>Made for detailers in the USA. No ads. No tracking. We never sell your data.</span>
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
      <div className="mx-auto w-full max-w-6xl px-5 pt-14 sm:px-8 sm:pt-20">
        <div className="enter max-w-3xl">
          {eyebrow && <p className="text-[13px] font-semibold uppercase tracking-[0.18em] text-bead">{eyebrow}</p>}
          <h1 className="text-gradient mt-3 font-display text-[40px] font-extrabold leading-[1.05] tracking-[-0.04em] sm:text-6xl">
            {title}
          </h1>
          {updated && <p className="mt-4 text-sm text-steel">Last updated {updated}</p>}
          {intro && <div className="mt-6 text-lg leading-relaxed text-mist">{intro}</div>}
        </div>

        <div className={`mt-12 grid gap-10 ${toc ? "lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-16" : ""}`}>
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
