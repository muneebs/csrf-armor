---
"@csrf-armor/nextjs": minor
---

Updated package configuration and test coverage:

- Updated exports configuration in package.json and tsconfig for better module resolution
- Added comprehensive test coverage for NextjsAdapter and CSRF middleware:
  - Added tests for request data extraction and response application
  - Added tests for token extraction from various sources (headers, cookies, form data, JSON body)
  - Added tests for cookie options handling
  - Enhanced middleware tests for signed-double-submit strategy
  - Added tests for cookie integrity and token validation
  - Improved test coverage for error cases and edge scenarios
