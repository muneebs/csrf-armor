---
"@csrf-armor/core": patch
---

Fix excludePaths over-matching unrelated path prefixes

`shouldSkipProtection` used `pathname.startsWith(path)` for exclusion
matching, so `excludePaths: ['/api']` also matched `/api-public` and
`/apiv2` — more paths than intended. Matching is now path-segment
aware: `'/api'` matches `/api` and `/api/v1` but not `/api-public`.
A trailing slash (`'/api/'`) matches children only, not the bare path.

refs SEC-VAL-2