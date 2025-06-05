---
"@csrf-armor/core": patch
"@csrf-armor/express": patch
---

fix: improve URL handling security and code quality

- Remove unsafe URL base fallback patterns that could lead to potential vulnerabilities
- Add readonly modifiers to CryptoKeyCache properties for better immutability
- Update tests to use complete URLs for proper validation
- Improve URL parsing by requiring proper absolute URLs instead of relying on base URL fallbacks