---
"@csrf-armor/core": patch
"@csrf-armor/nextjs": patch
---

Fix browser navigation token refresh and adapter robustness

**Bug Fixes:**

- **Navigation Token Refresh**: Fixed issue where users navigating back to cached pages would encounter stale CSRF tokens that were already replaced
- **Adapter Test Failures**: Resolved adapter test failures in different environments by improving JSON and text body parsing
- **Request Body Handling**: Enhanced token extraction to gracefully handle various request body types and mock objects

**Improvements:**

- **Navigation Events**: Added comprehensive navigation event listeners (`popstate`, `pageshow`) for automatic token refresh
- **Route-based Refresh**: Integrated Next.js `usePathname` for automatic token refresh on route changes  
- **Robust Extraction**: Improved token extraction with proper fallbacks for production and test environments
- **Test Coverage**: Added comprehensive test coverage for concurrent requests and edge cases

**Technical Changes:**

- Enhanced React client with navigation-aware token refresh logic
- Improved adapter error handling and type safety for different request body formats
- Added timing-based token staleness detection to prevent using outdated tokens
- Updated type signatures to be more consistent across validation functions

This update ensures CSRF tokens remain fresh during browser navigation and improves the reliability of token extraction across different environments.