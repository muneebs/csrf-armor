---
"@csrf-armor/core": patch
"@csrf-armor/nextjs": patch
"@csrf-armor/nuxt": patch
"@csrf-armor/express": patch
---

Declare `engines.node` as `>=19.0.0`. The core uses the global Web Crypto API, which Node.js only exposes without a flag from version 19, so importing it on Node 18 already failed; the old `>=18.0.0` range was inaccurate. `@csrf-armor/express` now declares the same range.
