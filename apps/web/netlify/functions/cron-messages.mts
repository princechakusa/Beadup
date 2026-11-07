// Every 15 minutes: queue and send due texts, retry failed refunds
// (GET /api/cron/messages). Netlify scheduled functions run on the free plan;
// the route itself checks the Bearer CRON_SECRET.
export default async function cronMessages(): Promise<Response> {
  const site = process.env.URL; // set by Netlify to the site's main address
  const secret = process.env.CRON_SECRET;
  if (!site || !secret) return new Response("not configured", { status: 500 });
  const res = await fetch(`${site}/api/cron/messages`, { headers: { authorization: `Bearer ${secret}` } });
  return new Response(await res.text(), { status: res.status });
}

export const config = { schedule: "*/15 * * * *" };
