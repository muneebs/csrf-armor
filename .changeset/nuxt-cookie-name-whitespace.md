---
"@csrf-armor/nuxt": patch
---

Stop the server-side cookie parser from stripping Unicode whitespace around cookie names and values. It used `String.prototype.trim()`, which also removes characters such as the non-breaking space (U+00A0). A sibling subdomain could set a cookie whose name is `__Host-csrf-token` preceded by a non-breaking space. Browsers treat that cookie as unprefixed, but the parser read it as `__Host-csrf-token`, defeating the `__Host-` prefix. Only spaces and tabs are stripped now, as RFC 6265 specifies. Cookies set by this library are not affected.
