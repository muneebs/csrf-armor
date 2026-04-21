# @csrf-armor/nuxt

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
