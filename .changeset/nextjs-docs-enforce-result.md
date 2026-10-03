---
"@csrf-armor/nextjs": patch
---

Fix two documented middleware examples that let rejected requests through. The `createCsrfMiddleware` JSDoc example ignored the result, and the README "Security Headers" example returned `result.response` on failure. Both now return a 403 when `result.success` is false. The JSDoc now states that callers must block failed checks themselves, because `result.response` is still the continue response when validation fails.
