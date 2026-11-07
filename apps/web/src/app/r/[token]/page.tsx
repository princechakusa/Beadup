import type { Metadata } from "next";
import { Suspense } from "react";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { ReviewForm } from "./ReviewForm";

export const metadata: Metadata = { title: "Rate your detail", robots: { index: false, follow: false } };

const contextSchema = z.object({
  businessName: z.string(),
  handle: z.string(),
  serviceName: z.string(),
  firstName: z.string(),
  canReview: z.boolean(),
  alreadyReviewed: z.boolean(),
});

function Shell({ children }: { children: React.ReactNode }) {
  return <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center px-5 py-10">{children}</main>;
}

async function Review({ params }: { params: PageProps<"/r/[token]">["params"] }) {
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
        <h1 className="font-display text-3xl font-extrabold">Thanks, you&apos;ve already reviewed this</h1>
        <p className="mt-3 text-steel">We appreciate it.</p>
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

export default function ReviewPage(props: PageProps<"/r/[token]">) {
  return (
    <Shell>
      <Suspense fallback={<p className="text-steel">Loading…</p>}>
        <Review params={props.params} />
      </Suspense>
    </Shell>
  );
}
