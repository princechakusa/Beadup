import { expect, test } from "@playwright/test";
import { sql } from "./helpers";

// Every protected route refuses a request with no credentials, and the public
// error-log route validates, scrubs and stores (docs/SECURITY_ROUTES.md).
const UUID = "00000000-0000-4000-8000-000000000001";
const REFUSED = [400, 401, 403, 404, 405, 429, 503];

const protectedCalls: [string, string][] = [
  ["DELETE", "/api/account"],
  ["POST", `/api/bookings/${UUID}/cancel`],
  ["POST", `/api/bookings/${UUID}/balance`],
  ["POST", "/api/revalidate"],
  ["GET", "/api/stripe/balance"],
  ["POST", "/api/stripe/connect"],
  ["POST", "/api/quotes/ai"],
  ["GET", "/api/cron/messages"],
  ["POST", "/api/revenuecat/webhook"],
  ["POST", "/api/stripe/webhook"],
  ["POST", "/api/twilio/inbound"],
  ["GET", "/api/admin"],
  ["POST", "/api/admin"],
];

test("protected API routes refuse requests without credentials", async ({ request }) => {
  for (const [method, path] of protectedCalls) {
    const res = await request.fetch(path, { method, data: method === "GET" ? undefined : {} });
    expect(REFUSED, `${method} ${path} -> ${res.status()}`).toContain(res.status());
  }
});

test("a bad bearer token or a wrong cron secret is refused", async ({ request }) => {
  const bearer = await request.post("/api/revalidate", { headers: { authorization: "Bearer not-a-real-token" } });
  expect(bearer.status()).toBe(401);
  const cron = await request.get("/api/cron/messages", { headers: { authorization: "Bearer wrong" } });
  expect(REFUSED).toContain(cron.status());
  expect(cron.status()).not.toBe(200);
});

test("/api/log validates, scrubs personal details and stores the report", async ({ request }) => {
  const bad = await request.post("/api/log", { data: { source: "nope", message: 1 } });
  expect(bad.status()).toBe(400);

  // Letters only: the scrubber hides long digit runs.
  const marker = `e2e${Math.random().toString(36).replace(/[^a-z]/g, "").slice(0, 8)}`;
  const ok = await request.post("/api/log", {
    data: { source: "app", message: `${marker} failed for jo@example.com call +15125550101`, where: "ErrorBoundary", stack: "at x (file.js:1:1)", release: "1.0.1" },
  });
  expect(ok.status()).toBe(204);
  const row = sql(`select message from public.error_log where message like '${marker}%' order by id desc limit 1;`);
  expect(row).toContain(marker);
  expect(row).not.toContain("jo@example.com");
  expect(row).not.toContain("5125550101");
});
