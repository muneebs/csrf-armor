---
---

Give the `next` and `react` imports in `packages/nextjs/jsr.json` real version ranges (`^16.0.0` and `^19.0.0`, the majors the package is tested against) instead of `*`, which JSR rejects as "missing a version constraint". JSR only; the npm package and its peer range are unchanged.
