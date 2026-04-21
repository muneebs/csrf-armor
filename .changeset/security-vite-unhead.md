---
"@csrf-armor/core": patch
"@csrf-armor/express": patch
"@csrf-armor/nextjs": patch
"@csrf-armor/nuxt": patch
---

chore(deps): patch transitive dev dependency security advisories

Bumps pnpm overrides for `vite` (`^6.4.1` → `^6.4.2`) and `unhead` (`>=2.1.11` → `>=2.1.13`) to pull in patched versions. These are dev/build-time dependencies only — no runtime behavior or published API changes.

Addresses:
- GHSA: Vite arbitrary file read via dev server WebSocket (high, <=6.4.1)
- GHSA: Vite path traversal in optimized deps `.map` handling (medium, <=6.4.1)
- GHSA: Unhead `hasDangerousProtocol()` bypass via leading-zero padded HTML entities in `useHeadSafe()` (medium, <2.1.13)
