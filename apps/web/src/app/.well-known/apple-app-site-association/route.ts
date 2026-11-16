/**
 * Universal Links: https://beadup.app/.well-known/apple-app-site-association
 * (JSON, no file extension, served as application/json).
 *
 * Needs NEXT_PUBLIC_APPLE_TEAM_ID (Apple Developer > Membership > Team ID).
 * Without it the file is a 404, so we never publish a broken app id.
 *
 * Client booking pages (/<handle>, /b/*, /r/*) must stay in the browser, so
 * everything is excluded except /app/*, a reserved handle the app can use for
 * future deep links. The app also needs the Associated Domains entitlement
 * (applinks:beadup.app) in a native iOS build; see docs/ASO.md.
 */
export const dynamic = "force-static";

const BUNDLE_ID = "com.beadup.app";

export function GET() {
  const team = (process.env.NEXT_PUBLIC_APPLE_TEAM_ID ?? "").trim();
  if (!/^[A-Z0-9]{10}$/.test(team)) return new Response("Not found", { status: 404 });
  const body = {
    applinks: {
      details: [
        {
          appIDs: [`${team}.${BUNDLE_ID}`],
          components: [
            { "/": "/api/*", exclude: true },
            { "/": "/admin*", exclude: true },
            { "/": "/b/*", exclude: true },
            { "/": "/r/*", exclude: true },
            { "/": "/app/*", comment: "Reserved for in-app deep links" },
            { "/": "/*", exclude: true },
          ],
        },
      ],
    },
  };
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=3600" },
  });
}
