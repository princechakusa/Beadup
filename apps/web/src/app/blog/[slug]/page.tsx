import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AppStoreButton } from "@/components/site/AppStoreButton";
import { DocPage, H2 } from "@/components/site/SiteChrome";
import { FaqMicrodata } from "@/components/site/Structured";
import { GUIDES, getGuide } from "@/content/guides";
import { appStoreMetadata } from "@/lib/seo";

export function generateStaticParams() {
  return GUIDES.map((g) => ({ slug: g.slug }));
}

export async function generateMetadata({ params }: PageProps<"/blog/[slug]">): Promise<Metadata> {
  const g = getGuide((await params).slug);
  if (!g) return { title: "Not found" };
  const url = `/blog/${g.slug}`;
  return {
    title: g.title,
    description: g.description,
    alternates: { canonical: url },
    openGraph: { type: "article", title: g.title, description: g.description, url, publishedTime: g.published, modifiedTime: g.updated },
    twitter: { title: g.title, description: g.description },
    ...appStoreMetadata(),
  };
}

function longDate(iso: string) {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
}

export default async function GuidePage({ params }: PageProps<"/blog/[slug]">) {
  const g = getGuide((await params).slug);
  if (!g) notFound();
  const more = GUIDES.filter((x) => x.slug !== g.slug).slice(0, 3);

  return (
    <DocPage
      eyebrow={`Guide · ${g.readMin} min read`}
      title={g.title}
      updated={longDate(g.updated)}
      intro={<p>{g.description}</p>}
      toc={[...g.toc, "Common questions"]}
    >
      <div itemScope itemType="https://schema.org/Article" className="contents">
        <meta itemProp="headline" content={g.title} />
        <meta itemProp="description" content={g.description} />
        <meta itemProp="datePublished" content={g.published} />
        <meta itemProp="dateModified" content={g.updated} />
        <span itemProp="author publisher" itemScope itemType="https://schema.org/Organization" className="contents">
          <meta itemProp="name" content="Beadup" />
        </span>

        {/* The direct answer up front: the part people (and answer engines) quote. */}
        <aside aria-label="Short answer" className="glass glass-edge !mt-0 rounded-[22px] p-6">
          <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-bead">Short answer</p>
          <p className="mt-2 text-[17px] leading-relaxed text-paint" itemProp="abstract">
            {g.answer}
          </p>
        </aside>

        <div itemProp="articleBody" className="contents">
          {g.body}
        </div>
      </div>

      <H2>Common questions</H2>
      <FaqMicrodata items={g.faq} />

      <div className="glass glass-edge rounded-[24px] p-6">
        <p className="font-display text-xl font-bold text-paint">Run all of this from your phone</p>
        <p className="mt-2 text-[15px] text-steel">
          Beadup gives you a booking link, deposits paid straight to you, and quotes priced from your own list. Free to start.
        </p>
        <div className="mt-5">
          <AppStoreButton className="!text-midnight !no-underline" />
        </div>
      </div>

      <nav aria-label="More guides">
        <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-steel">More guides</p>
        <ul>
          {more.map((m) => (
            <li key={m.slug}>
              <Link href={`/blog/${m.slug}`}>{m.title}</Link>
            </li>
          ))}
        </ul>
      </nav>
    </DocPage>
  );
}
