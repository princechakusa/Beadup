import type { Metadata } from "next";
import { Suspense } from "react";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { ReviewForm } from "./ReviewForm";
import { Receipt, receiptSchema } from "./Receipt";

export const metadata: Metadata = {
  title: "Your receipt",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

const contextSchema = z.object({
  businessName: z.string(),
  handle: z.string(),
  serviceName: z.string(),
  firstName: z.string(),
  canReview: z.boolean(),
  alreadyReviewed: z.boolean(),
});

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main id="main" className="relative mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center px-5 py-10">
      <div aria-hidden="true" className="pointer-events-none fixed inset-x-0 top-0 -z-10 h-[480px] bg-[radial-gradient(ellipse_70%_60%_at_50%_0%,rgba(77,216,255,0.16),transparent)]" />
      <div className="glass glass-edge w-full rounded-[32px] px-6 py-10 sm:px-8">{children}</div>
    </main>
  );
}

async function Rating({ params }: { params: PageProps<"/r/[token]">["params"] }) {
  const { token } = await params;
  const db = supabaseAdmin();
  const ctx =
    db && /^[0-9a-f]{48}$/.test(token)
      ? contextSchema.safeParse((await db.rpc("review_context", { p_token: token })).data)
      : null;

  if (!ctx?.success) {
    return (
      <div className="text-center">
        <h1 className="font-display text-3xl font-extrabold">Link not found</h1>
        <p className="mt-3 text-steel">This review link isn&apos;t valid.</p>
      </div>
    );
  }
  const c = ctx.data;
  if (c.alreadyReviewed) {
    return (
      <div className="text-center">
        {/* Also shown right after sending: saving refreshes this page. */}
        <h1 className="font-display text-3xl font-extrabold">Thanks for your review</h1>
        <p className="mt-3 text-steel">It helps {c.businessName} and other drivers nearby. Reviews can only be left once.</p>
      </div>
    );
  }
  if (!c.canReview) {
    return (
      <div className="text-center">
        <h1 className="font-display text-3xl font-extrabold">Not quite yet</h1>
        <p className="mt-3 text-steel">You can review this detail once the job is done.</p>
      </div>
    );
  }
  return <ReviewForm token={token} businessName={c.businessName} firstName={c.firstName} />;
}

/** The receipt for a finished job (when the link is valid and the job is done), then the rating. */
async function Review({ params }: { params: PageProps<"/r/[token]">["params"] }) {
  const { token } = await params;
  const db = supabaseAdmin();
  const data = db && /^[0-9a-f]{48}$/.test(token) ? (await db.rpc("receipt_context", { p_token: token })).data : null;
  const receipt = receiptSchema.safeParse(data);
  return (
    <>
      {receipt.success && receipt.data.status === "completed" && (
        <div className="mb-8">
          <Receipt r={receipt.data} />
        </div>
      )}
      <div className="no-print">
        <Rating params={params} />
      </div>
    </>
  );
}

export default function ReviewPage(props: PageProps<"/r/[token]">) {
  return (
    <Shell>
      <Suspense fallback={<p className="text-center text-steel" aria-busy="true">Loading…</p>}>
        <Review params={props.params} />
      </Suspense>
    </Shell>
  );
}
