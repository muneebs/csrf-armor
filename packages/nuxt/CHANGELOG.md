# @csrf-armor/nuxt

## 1.2.2

### Patch Changes

- Updated dependencies [[`748dc94`](https://github.com/muneebs/csrf-armor/commit/748dc946afb4318befeb30f67926140196dc098a)]:
  - @csrf-armor/core@1.3.1

## 1.2.1

### Patch Changes

- [#105](https://github.com/muneebs/csrf-armor/pull/105) [`18146d9`](https://github.com/muneebs/csrf-armor/commit/18146d91a7447147e6adc440ebeba0716e0b9977) Thanks [@muneebs](https://github.com/muneebs)! - Fix body-submitted CSRF tokens in two integrations. Next.js: server actions now pass validation. The adapter reads the token from React's prefixed form fields (`_1_csrf_token`) and from action arguments sent as `text/plain`. Nuxt: requests with a valid token in the body no longer hang. The adapter now leaves the body it reads for h3, so the route's `readBody(event)` still returns it.

- [#107](https://github.com/muneebs/csrf-armor/pull/107) [`c538607`](https://github.com/muneebs/csrf-armor/commit/c5386075220f873e0c998eee8c093379d16fda6c) Thanks [@muneebs](https://github.com/muneebs)! - Stop the server-side cookie parser from stripping Unicode whitespace around cookie names and values. It used `String.prototype.trim()`, which also removes characters such as the non-breaking space (U+00A0). A sibling subdomain could set a cookie whose name is `__Host-csrf-token` preceded by a non-breaking space. Browsers treat that cookie as unprefixed, but the parser read it as `__Host-csrf-token`, defeating the `__Host-` prefix. Only spaces and tabs are stripped now, as RFC 6265 specifies. Cookies set by this library are not affected.

## 1.2.0

### Minor Changes

- [#99](https://github.com/muneebs/csrf-armor/pull/99) [`c7b0325`](https://github.com/muneebs/csrf-armor/commit/c7b0325132a0cef9450b24db6a430f12a4a5dba8) Thanks [@muneebs](https://github.com/muneebs)! - Add session binding for Nuxt. Register a resolver with `defineCsrfSessionResolver(event => sessionId)` from a Nitro plugin. It is auto-imported in server code and also exported from `@csrf-armor/nuxt/server`. The middleware then passes it to core as `getSessionId`, so signed tokens and signed-double-submit cookie pairs only validate in the session they were issued to. Without a resolver, behaviour is unchanged. Setting the new `sessionBinding: true` module option makes a missing resolver fail closed (every request returns 500) instead of silently leaving tokens unbound.

### Patch Changes

- [#95](https://github.com/muneebs/csrf-armor/pull/95) [`f26aafe`](https://github.com/muneebs/csrf-armor/commit/f26aafeeeda9c4772a34625fe81ed53b7f8d7e61) Thanks [@muneebs](https://github.com/muneebs)! - Cap the request body the CSRF middleware reads while looking for a body-submitted token at 100 KiB by default. Bodies with a larger `Content-Length`, or that stream past the cap, are not buffered and fail validation with 403. Previously the whole body was buffered with no limit before the request was rejected. `NuxtAdapter` now accepts `{ maxBodySize }` to change the cap. Tokens sent in the header or query string are not affected.
- Updated dependencies [[`da4c926`](https://github.com/muneebs/csrf-armor/commit/da4c926fc810c8c6d5c1cdd1b21919bfd15d325d), [`793c1d2`](https://github.com/muneebs/csrf-armor/commit/793c1d2def16cfef18da279960f80f084e375a4a), [`704f82d`](https://github.com/muneebs/csrf-armor/commit/704f82d0f8cf3d63d7aaf51af49c3d211c038add), [`1400de7`](https://github.com/muneebs/csrf-armor/commit/1400de7c3b21c2425808d7a1164ddee75664f0f0)]:
  - @csrf-armor/core@1.3.0

## 1.1.3

### Patch Changes

- [#72](https://github.com/muneebs/csrf-armor/pull/72) [`d6036d4`](https://github.com/muneebs/csrf-armor/commit/d6036d476bbe4c5be171be29de04a7e9d369f2fb) Thanks [@muneebs](https://github.com/muneebs)! - Fix CSRF bypass: remove cookie fallback from getTokenFromRequest

  All three framework adapters (Express, Next.js, Nuxt) fell back to
  reading the CSRF token from the client-accessible cookie when no header
  token was found. This made validateSignedDoubleSubmit compare a value
  against itself — trivially true — defeating signed-double-submit,
  signed-token, and hybrid strategies.

  **Breaking change:** getTokenFromRequest no longer extracts the CSRF
  token from request cookies. Clients must send the token explicitly via
  the X-CSRF-Token header, request body, or query parameter. Use the
  provided client utilities (csrfFetch, useCsrfFetch) which already do
  this correctly.

  Security: SEC-INJ-1 (HIGH)

- Updated dependencies [[`3973db5`](https://github.com/muneebs/csrf-armor/commit/3973db598e6b53374feffc698ead42f694ef3e77), [`72c2272`](https://github.com/muneebs/csrf-armor/commit/72c2272e5215421a6e1b8509ba514ac53b2ac133), [`9db7455`](https://github.com/muneebs/csrf-armor/commit/9db745559fba874d9fdcfb66e3d540371571d2a8)]:
  - @csrf-armor/core@1.2.4

## 1.1.2

### Patch Changes

- [#50](https://github.com/muneebs/csrf-armor/pull/50) [`7d4adeb`](https://github.com/muneebs/csrf-armor/commit/7d4adebc94ceb1f01a6af0807b7a5f0c7a92b1f0) Thanks [@muneebs](https://github.com/muneebs)! - fix(client): preserve headers when `csrfFetch` is called with a `Request` object

  `csrfFetch` previously only read headers from the `init` argument, so when it was called with a full `Request` object (e.g. `csrfFetch(new Request(url, { headers }))`), the Request's headers were stripped. It now merges headers from the Request, then the `init` argument, then the CSRF headers (CSRF headers always take precedence), making `csrfFetch` a drop-in replacement for `fetch`.

  Fixes #49

- [#52](https://github.com/muneebs/csrf-armor/pull/52) [`440e0af`](https://github.com/muneebs/csrf-armor/commit/440e0af0a55bf2b3c93e26d031ea31a40540ad43) Thanks [@muneebs](https://github.com/muneebs)! - chore(deps): patch transitive dev dependency security advisories

  Bumps pnpm overrides for `vite` (`^6.4.1` → `^6.4.2`) and `unhead` (`>=2.1.11` → `>=2.1.13`) to pull in patched versions. These are dev/build-time dependencies only — no runtime behavior or published API changes.

  Addresses:

  - GHSA: Vite arbitrary file read via dev server WebSocket (high, <=6.4.1)
  - GHSA: Vite path traversal in optimized deps `.map` handling (medium, <=6.4.1)
  - GHSA: Unhead `hasDangerousProtocol()` bypass via leading-zero padded HTML entities in `useHeadSafe()` (medium, <2.1.13)

- Updated dependencies [[`440e0af`](https://github.com/muneebs/csrf-armor/commit/440e0af0a55bf2b3c93e26d031ea31a40540ad43)]:
  - @csrf-armor/core@1.2.3

## 1.1.1

### Patch Changes

- [#46](https://github.com/muneebs/csrf-armor/pull/46) [`2eded88`](https://github.com/muneebs/csrf-armor/commit/2eded88f07c8c199fb16fd84ea13149c8864f56f) Thanks [@muneebs](https://github.com/muneebs)! - fix: resolve high/moderate severity vulnerabilities in transitive dependencies

  Added pnpm overrides to force patched versions of `lodash` (>=4.18.0) and `defu` (>=6.1.5), which were pulled in transitively through the nuxt dependency chain. Addresses GHSA-r5fr-rjxr-66jc (lodash code injection), GHSA-f23m-r3pf-42rh (lodash prototype pollution), and GHSA-737v-mqg7-c878 (defu prototype pollution).

- Updated dependencies [[`2eded88`](https://github.com/muneebs/csrf-armor/commit/2eded88f07c8c199fb16fd84ea13149c8864f56f)]:
  - @csrf-armor/core@1.2.2

## 1.1.0

### Minor Changes

- [#40](https://github.com/muneebs/csrf-armor/pull/40) [`4fdec35`](https://github.com/muneebs/csrf-armor/commit/4fdec351810b90990b3a78760e24fdb36ce85584) Thanks [@muneebs](https://github.com/muneebs)! - Add `@csrf-armor/nuxt` module for Nuxt 3/4 applications

  Introduces a new Nuxt module that provides server-side CSRF protection via a Nitro middleware and client-side utilities for token management.

  **Features:**

  - `NuxtAdapter` bridges H3 events with the framework-agnostic `@csrf-armor/core` engine
  - Server middleware automatically enforces CSRF protection on all mutating requests
  - `useCsrfToken` composable for SSR-safe token access via `useState`
  - `useCsrfFetch` composable wrapping `$fetch` with automatic CSRF token injection
  - Client plugin initialises the token on page load
  - Full support for all core strategies: `double-submit`, `signed-double-submit`, `signed-token`, `origin-check`, `hybrid`
  - Zero runtime dependencies — uses H3Event native Web API (`event.method`, `event.headers`, `event.path`) and Node.js built-ins instead of h3 helper functions
