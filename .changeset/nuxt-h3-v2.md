---
"@csrf-armor/nuxt": patch
---

Support h3 v2 alongside h3 v1. On h3 v2 the adapter now writes the token header and cookies to `event.res.headers` and reads a body-submitted token from a clone of `event.req`, so the route can still read the body. Before this change, the adapter expected the Node `req` and `res` that h3 v1 provides, so on h3 v2 it failed when no Node response was available. On h3 v2 under Node, it also read the request stream directly, which could leave the route unable to read the body. Behavior on h3 v1 (Nuxt 3 and 4) is unchanged.
