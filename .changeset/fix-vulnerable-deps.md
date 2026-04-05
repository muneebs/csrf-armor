---
"@csrf-armor/core": patch
"@csrf-armor/express": patch
"@csrf-armor/nextjs": patch
"@csrf-armor/nuxt": patch
---

fix: resolve high/moderate severity vulnerabilities in transitive dependencies

Added pnpm overrides to force patched versions of `lodash` (>=4.18.0) and `defu` (>=6.1.5), which were pulled in transitively through the nuxt dependency chain. Addresses GHSA-r5fr-rjxr-66jc (lodash code injection), GHSA-f23m-r3pf-42rh (lodash prototype pollution), and GHSA-737v-mqg7-c878 (defu prototype pollution).
