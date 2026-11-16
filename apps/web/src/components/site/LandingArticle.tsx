import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { APP_STORE_URL, AppStoreButton, IphoneNote } from "@/components/site/AppStoreButton";
import { IconArrowRight } from "@/components/site/Icons";
import { SitePage } from "@/components/site/SiteChrome";
import { AppMicrodata, FaqMicrodata } from "@/components/site/Structured";
import { landingPage, LANDING_PAGES, type LandingSlug } from "@/content/landing-pages";
import { appStoreMetadata, pageMeta } from "@/lib/seo";
import { getPublicConfig } from "@/lib/site";

/** Metadata for a landing page: unique title, description, canonical, Open Graph and Twitter. */
export function landingMetadata(slug: LandingSlug): Metadata {
  const p = landingPage(slug);
  if (!p) return {};
  return { ...pageMeta(`/${p.slug}`, p.title, p.description), ...appStoreMetadata() };
}

/** A top-level SEO landing page: one h1, answer first, sections, honest comparison table, FAQ, links. */
export async function LandingArticle({ slug }: { slug: LandingSlug }) {
  const p = landingPage(slug);
  if (!p) notFound();
  const config = await getPublicConfig();
  const faq: [string, string][] = [
    ...p.faq,
    ["What does it cost?", `Free for up to ${config.free_bookings_per_month} bookings a month with every feature. Beadup Pro removes the limit and is bought in the app.`],
  ];
  const related = p.related.map((s) => LANDING_PAGES.find((o) => o.slug === s)!);

  return (
    <SitePage>
      <AppMicrodata description={p.description} appStoreUrl={APP_STORE_URL} />
      <article className="mx-auto w-full max-w-4xl px-5 pt-10 sm:px-8 sm:pt-16">
        <header>
          <nav aria-label="Breadcrumb" className="text-[13px] text-steel">
            <Link href="/" className="hover:text-paint">
              Beadup
            </Link>{" "}
            <span aria-hidden="true">/</span> {p.h1}
          </nav>
          <h1 className="text-gradient mt-6 text-balance font-display text-[38px] font-extrabold leading-[1.04] tracking-[-0.045em] sm:text-6xl">{p.h1}</h1>
          <p className="mt-6 max-w-3xl text-xl leading-relaxed text-mist">{p.answer}</p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <AppStoreButton />
            <Link href="/beadup-demo-detailing" className="inline-flex h-[60px] items-center gap-2 rounded-full border border-white/30 px-7 font-semibold hover:bg-white/[0.06]">
              See a booking page <IconArrowRight size={18} />
            </Link>
          </div>
          <div className="mt-4">
            <IphoneNote />
          </div>
        </header>

        {p.sections.map((s) => (
          <section key={s.h2} className="mt-16">
            <h2 className="font-display text-3xl font-extrabold tracking-[-0.03em]">{s.h2}</h2>
            {s.paragraphs.map((t) => (
              <p key={t} className="mt-4 text-[17px] leading-relaxed text-mist">
                {t}
              </p>
            ))}
            {s.bullets && (
              <ul className="mt-4 flex list-disc flex-col gap-2 pl-6 text-[16px] leading-relaxed text-mist marker:text-bead">
                {s.bullets.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            )}
          </section>
        ))}

        <section className="mt-16">
          <h2 className="font-display text-3xl font-extrabold tracking-[-0.03em]">{p.compare.heading}</h2>
          <p className="mt-4 text-[17px] leading-relaxed text-mist">{p.compare.intro}</p>
          <div className="mt-6 overflow-x-auto rounded-[24px] border border-white/10">
            <table className="w-full min-w-[640px] border-collapse text-left text-[15px]">
              <caption className="sr-only">{p.compare.heading}</caption>
              <thead>
                <tr className="bg-white/[0.04] text-paint">
                  <th scope="col" className="px-5 py-4 font-semibold">
                    Feature
                  </th>
                  <th scope="col" className="px-5 py-4 font-semibold text-bead">
                    Beadup
                  </th>
                  <th scope="col" className="px-5 py-4 font-semibold">
                    {p.compare.other}
                  </th>
                </tr>
              </thead>
              <tbody>
                {p.compare.rows.map(([f, a, b]) => (
                  <tr key={f} className="border-t border-white/[0.07] align-top">
                    <th scope="row" className="px-5 py-4 font-medium text-paint">
                      {f}
                    </th>
                    <td className="px-5 py-4 text-paint">{a}</td>
                    <td className="px-5 py-4 text-steel">{b}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-[14px] leading-relaxed text-steel">{p.compare.note}</p>
        </section>

        <section aria-labelledby="faq" className="mt-16">
          <h2 id="faq" className="mb-6 font-display text-3xl font-extrabold tracking-[-0.03em]">
            Questions
          </h2>
          <FaqMicrodata items={faq} />
        </section>

        <aside aria-labelledby="more" className="mt-16">
          <h2 id="more" className="font-display text-xl font-bold">
            Keep reading
          </h2>
          <ul className="mt-4 flex flex-wrap gap-2">
            {related.map((r) => (
              <li key={r.slug}>
                <Link href={`/${r.slug}`} className="inline-flex min-h-10 items-center rounded-full border border-white/15 px-4 py-2 text-[14px] text-mist hover:text-paint">
                  {r.h1}
                </Link>
              </li>
            ))}
            <li>
              <Link href="/for/car-detailers" className="inline-flex min-h-10 items-center rounded-full border border-white/15 px-4 py-2 text-[14px] text-mist hover:text-paint">
                Booking app for car detailers
              </Link>
            </li>
            <li>
              <Link href="/for" className="inline-flex min-h-10 items-center rounded-full border border-white/15 px-4 py-2 text-[14px] text-mist hover:text-paint">
                Every kind of business
              </Link>
            </li>
            <li>
              <Link href="/blog" className="inline-flex min-h-10 items-center rounded-full border border-white/15 px-4 py-2 text-[14px] text-mist hover:text-paint">
                Guides
              </Link>
            </li>
            <li>
              <Link href="/pricing" className="inline-flex min-h-10 items-center rounded-full border border-white/15 px-4 py-2 text-[14px] text-mist hover:text-paint">
                Pricing
              </Link>
            </li>
          </ul>
        </aside>
      </article>
    </SitePage>
  );
}
