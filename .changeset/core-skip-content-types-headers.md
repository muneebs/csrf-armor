---
"@csrf-armor/core": patch
---

Fix `skipContentTypes` never matching when the adapter passes a Web `Headers` object (Next.js and Nuxt). Header normalization now reads `Headers` instances instead of treating them as an empty plain object. Requests were previously protected rather than skipped, so this was not a bypass.
