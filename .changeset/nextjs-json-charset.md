---
"@csrf-armor/nextjs": patch
---

Read the CSRF token from JSON bodies whose `Content-Type` carries parameters or different casing, such as `application/json; charset=utf-8`. The adapter previously required an exact `application/json` match and skipped those bodies, so a token sent only in the body was rejected; tokens sent in the header were unaffected.
