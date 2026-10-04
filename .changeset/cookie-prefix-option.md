---
"@csrf-armor/core": minor
"@csrf-armor/nextjs": minor
"@csrf-armor/nuxt": minor
"@csrf-armor/express": patch
---

Add an opt-in `cookie.prefix: '__Host-' | '__Secure-' | false` option. The prefix is prepended to the CSRF cookie and to the `-server` cookie used by `signed-double-submit`, e.g. `__Host-csrf-token` and `__Host-csrf-token-server`. With `__Host-`, browsers reject CSRF cookies set by sibling subdomains or plain-HTTP origins, which stops cookie-tossing attacks on the `double-submit`, `signed-double-submit`, `signed-token` and `hybrid` strategies. The default is no prefix, so existing cookie names are unchanged.

Creating the protection now throws a `CsrfConfigError` (code `INVALID_CONFIG`) when the cookie options conflict with the prefix: `__Host-` with `domain`, a `path` other than `/`, or `secure: false`; `__Secure-` with `secure: false`; a `prefix` on a name that is already prefixed; or an `__Http-` / `__Host-Http-` name. The same checks apply to a prefix written into `cookie.name` by hand. Core also exports `resolveCookieName(cookieOptions)`, which returns the full cookie name for client code.

Next.js: `CsrfClientConfig` gains `cookiePrefix`; set it to the same value as the server's `cookie.prefix` so `getCsrfToken`, `csrfFetch` and `CsrfProvider` read the prefixed cookie.

Nuxt: the module passes the full prefixed cookie name to the client, so `useCsrfToken` and `useCsrfFetch` need no change.

Migration: after enabling the prefix, the old unprefixed cookies are ignored and prefixed ones are issued on the next safe request. A page that was already open may get one 403 on its next unsafe request until its token is refreshed. Safari rejects `Secure` and prefixed cookies over `http://localhost`, so consider enabling the prefix in production only.
