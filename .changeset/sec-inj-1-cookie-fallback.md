---
"@csrf-armor/express": patch
"@csrf-armor/nextjs": patch
"@csrf-armor/nuxt": patch
---

Fix CSRF bypass: remove cookie fallback from getTokenFromRequest

All three framework adapters (Express, Next.js, Nuxt) fell back to
reading the CSRF token from the client-accessible cookie when no header
token was found. This made validateSignedDoubleSubmit compare a value
against itself — trivially true — defeating signed-double-submit,
signed-token, and hybrid strategies.

**Breaking change:** getTokenFromRequest no longer extracts the CSRF
token from request cookies. Clients must send the token explicitly via
the X-CSRF-Token header, request body, or query parameter. Use the
provided client utilities (csrfFetch, useCsrfFetch) which already do
this correctly.

Security: SEC-INJ-1 (HIGH)