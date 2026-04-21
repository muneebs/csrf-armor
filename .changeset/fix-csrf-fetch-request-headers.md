---
"@csrf-armor/nextjs": patch
"@csrf-armor/nuxt": patch
---

fix(client): preserve headers when `csrfFetch` is called with a `Request` object

`csrfFetch` previously only read headers from the `init` argument, so when it was called with a full `Request` object (e.g. `csrfFetch(new Request(url, { headers }))`), the Request's headers were stripped. It now merges headers from the Request, then the `init` argument, then the CSRF headers (CSRF headers always take precedence), making `csrfFetch` a drop-in replacement for `fetch`.

Fixes #49
