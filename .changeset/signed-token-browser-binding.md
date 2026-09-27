---
"@csrf-armor/core": patch
"@csrf-armor/express": patch
---

Require signed-token and hybrid submissions to match the incoming CSRF cookie as well as passing signature and expiry checks. Cookie-less and cross-browser token submissions are rejected; clients must use the current token after cookie rotation. Preserve case-sensitive Express cookie names so custom names remain usable.
