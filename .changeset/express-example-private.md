---
---

Mark the Express example app as private so Changesets no longer tries to publish it to npm. It was bumped and picked up for publishing alongside `@csrf-armor/express` 1.2.5, which made the release job fail with `ENEEDAUTH` after the real packages had already published.
