---
"@csrf-armor/nextjs": patch
"@csrf-armor/nuxt": patch
---

Fix body-submitted CSRF tokens in two integrations. Next.js: server actions now pass validation. The adapter reads the token from React's prefixed form fields (`_1_csrf_token`) and from action arguments sent as `text/plain`. Nuxt: requests with a valid token in the body no longer hang. The adapter now leaves the body it reads for h3, so the route's `readBody(event)` still returns it.
