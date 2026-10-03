---
"@csrf-armor/nuxt": minor
---

Add session binding for Nuxt. Register a resolver with `defineCsrfSessionResolver(event => sessionId)` from a Nitro plugin. It is auto-imported in server code and also exported from `@csrf-armor/nuxt/server`. The middleware then passes it to core as `getSessionId`, so signed tokens and signed-double-submit cookie pairs only validate in the session they were issued to. Without a resolver, behaviour is unchanged. Setting the new `sessionBinding: true` module option makes a missing resolver fail closed (every request returns 500) instead of silently leaving tokens unbound.
