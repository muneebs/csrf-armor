# @csrf-armor/nuxt

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
