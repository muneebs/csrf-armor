---
"@csrf-armor/core": patch
---

Fix uncaught TypeError on malformed Referer header in validateOrigin

`validateOrigin` called `new URL(referer).origin` without a try-catch.
A malformed Referer header (e.g. `not-a-valid-url`) caused an unhandled
TypeError that propagated as HTTP 500. Malformed Referer headers now
return a validation failure (`isValid: false`, reason:
`'Malformed Referer header'`) resulting in HTTP 403, not 500.

refs SEC-VAL-1