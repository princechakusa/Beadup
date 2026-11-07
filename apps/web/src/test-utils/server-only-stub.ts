// Empty stand-in for the `server-only` package, aliased only in vitest so the
// server-guarded helpers in src/lib/* can be unit tested in a Node process.
// The real `server-only` module throws when imported off a server; this stub
// lets pure helpers (e.g. twilio.ts) run under vitest without a server runtime.
export {};