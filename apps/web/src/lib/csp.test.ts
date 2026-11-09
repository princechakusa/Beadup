import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { documentCsp, newNonce, STATIC_CSP } from "./csp";
import hashes from "./csp-hashes.json";

const directives = (csp: string) => new Map(csp.split("; ").map((d) => [d.split(" ")[0], d.split(" ").slice(1)]));

describe("document CSP", () => {
  const csp = directives(documentCsp("abc123", false));

  it("never allows unsafe-inline or unsafe-eval in production", () => {
    expect(documentCsp("abc123", false)).not.toMatch(/unsafe-inline|unsafe-eval/);
  });

  it("locks everything down by default and only opens what pages use", () => {
    expect(csp.get("default-src")).toEqual(["'none'"]);
    expect(csp.get("script-src")).toEqual(expect.arrayContaining(["'self'", "'nonce-abc123'", "https://challenges.cloudflare.com"]));
    expect(csp.get("style-src")).toEqual(["'self'", "'nonce-abc123'"]);
    expect(csp.get("frame-ancestors")).toEqual(["'none'"]);
    expect(csp.get("object-src")).toEqual(["'none'"]);
    expect(csp.get("base-uri")).toEqual(["'none'"]);
    expect(csp.get("form-action")).toEqual(["'self'"]);
    expect(csp.has("upgrade-insecure-requests")).toBe(true);
  });

  it("allows React's shell timing script by its exact hash", () => {
    const body = "requestAnimationFrame(function(){$RT=performance.now()});";
    const hash = `sha256-${createHash("sha256").update(body).digest("base64")}`;
    expect(hashes.script).toContain(hash);
    expect(csp.get("script-src")).toContain(`'${hash}'`);
  });

  it("uses fresh, unguessable nonces", () => {
    const a = newNonce();
    expect(a).toMatch(/^[A-Za-z0-9+/]{24}$/);
    expect(newNonce()).not.toBe(a);
  });

  it("gives non-HTML responses a deny-all policy", () => {
    expect(STATIC_CSP).toContain("default-src 'none'");
    expect(STATIC_CSP).toContain("frame-ancestors 'none'");
  });
});
