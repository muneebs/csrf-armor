---
"@csrf-armor/nuxt": patch
---

Cap the request body the CSRF middleware reads while looking for a body-submitted token at 100 KiB by default. Bodies with a larger `Content-Length`, or that stream past the cap, are not buffered and fail validation with 403. Previously the whole body was buffered with no limit before the request was rejected. `NuxtAdapter` now accepts `{ maxBodySize }` to change the cap. Tokens sent in the header or query string are not affected.
