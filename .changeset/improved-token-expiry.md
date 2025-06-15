---
"@csrf-armor/core": minor
"@csrf-armor/express": minor
"@csrf-armor/nextjs": minor
---

# improved-token-expiry

Improve token expiry handling with automatic reissue

Adds a token reissue threshold mechanism to automatically refresh CSRF tokens before they expire.
This improves user experience by preventing token expiration errors during long user sessions.

**Key changes:**

- Add 'reissueThreshold' option (default: 500 seconds) to token configuration
- Change default strategy from 'hybrid' to 'signed-double-submit' for better security
- Improve token extraction in adapters with better error handling
- Add comprehensive JSDoc documentation across all packages
- Fix error handling in Express example app

This change is backward compatible with existing configurations.
