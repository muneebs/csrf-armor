---
"@csrf-armor/core": minor
---

Add opt-in session binding through a new `getSessionId(csrfRequest, frameworkRequest)` config option. When it is set, the returned session identifier is mixed into the HMAC of `signed-token` and `hybrid` tokens and of the `signed-double-submit` server cookie. A token or cookie pair issued in one session then fails in any other, which blocks pairs planted by a sibling subdomain and tokens copied from another user. Anonymous requests bind to an empty session, so tokens are reissued on the next safe request after login. Without the option, tokens are signed exactly as before.

`signUnsignedToken`, `verifySignedToken`, `generateSignedToken`, `signNonceWithExpiry`, `parseSignedToken`, `validateSignedToken`, `validateSignedDoubleSubmit` and `validateRequest` accept an optional trailing session-context argument.

Express and Next.js users pass `getSessionId` in their middleware config. Nuxt users register it with `defineCsrfSessionResolver()` from a Nitro plugin (see `@csrf-armor/nuxt` 1.2.0), because `runtimeConfig` cannot hold functions.
