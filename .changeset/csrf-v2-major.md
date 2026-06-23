---
'@csrf-armor/core': major
'@csrf-armor/express': major
'@csrf-armor/nextjs': major
'@csrf-armor/nuxt': major
---

## v2.0.0

**Breaking changes:**

- Introduced a new strategy model supporting `signed-double-submit`, `origin-check`, `fetch-metadata`, and `hybrid`. The default strategy remains `signed-double-submit` for v2.0.
- Token format is now versioned (`v2.{exp}.{nonce}.{sig}`) with optional session binding via `getSessionId`.
- Added `previousSecrets` support and `rotationGracePeriod` for zero-downtime secret rotation.
- Added `rotateOnUse` with an in-memory rotation cache to mitigate token leakage.
- Replaced `skipContentTypes` with `ContentTypeOptions` allow/deny lists and enforced content-type checking for non-safe requests.
- Added `hostCookiePrefix` option for `__Host-` prefixed cookies when served over HTTPS.
- Removed cookie-key lowercasing in Express, Next.js, and Nuxt adapters; cookie names are now matched exactly.
- Removed query-parameter token extraction from the Express adapter.
- The Nuxt adapter now enforces a `maxBodySize` limit and caches parsed bodies.

**Security hardening:**

- Strengthened secret validation (minimum 32 characters, `WeakSecretError`).
- Session-bound tokens now reject mismatched or missing session IDs.
- Web Crypto availability is asserted at runtime (`MissingWebCryptoError`).
- Added `onFailure`, `logger`, and `metrics` hooks for observability.

**Internal changes:**

- Removed dependency on `fast-check` (deferred to v2.1 property-based tests).
- Added bundle-size budgets via `size-limit` and `@size-limit/preset-small-lib`.
