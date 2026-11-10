// Cloudflare Workers build (OpenNext). KV holds the Next.js data cache and tag
// cache: it is on Cloudflare's free plan with no card needed (R2 needs one).
// Reads are cheap; writes only happen when cached data is regenerated.
import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import kvIncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/kv-incremental-cache";
import kvNextTagCache from "@opennextjs/cloudflare/overrides/tag-cache/kv-next-tag-cache";

export default defineCloudflareConfig({
  incrementalCache: kvIncrementalCache,
  tagCache: kvNextTagCache,
});
