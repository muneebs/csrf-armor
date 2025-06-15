# @csrf-armor/express

## 1.2.0

### Minor Changes

- [#22](https://github.com/muneebs/csrf-armor/pull/22) [`19c15410af4d8faff3c1672bf99129f7d7e43068`](https://github.com/muneebs/csrf-armor/commit/19c15410af4d8faff3c1672bf99129f7d7e43068) Thanks [@muneebs](https://github.com/muneebs)! - # improved-token-expiry

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

### Patch Changes

- Updated dependencies [[`19c15410af4d8faff3c1672bf99129f7d7e43068`](https://github.com/muneebs/csrf-armor/commit/19c15410af4d8faff3c1672bf99129f7d7e43068)]:
  - @csrf-armor/core@1.2.0

## 1.1.0

### Minor Changes

- [#19](https://github.com/muneebs/csrf-armor/pull/19) [`0fea891851d67aa1c0a216c8a607d47b4bdb3101`](https://github.com/muneebs/csrf-armor/commit/0fea891851d67aa1c0a216c8a607d47b4bdb3101) Thanks [@muneebs](https://github.com/muneebs)! - Add JSR publishing support for dual npm/JSR distribution

  This change adds JSR (JavaScript Registry) publishing capability to enable distribution on both npm and JSR registries.
  Includes jsr.json configuration files for all packages and automated JSR publishing in the release workflow.

  **New Features:**

  - JSR configuration files (jsr.json) for all packages
  - JSR publishing scripts in package.json
  - Automated JSR publishing in GitHub release workflow
  - Updated release summaries with both npm and JSR installation commands

  **Benefits:**

  - Reach broader JavaScript ecosystem including Deno users
  - Maintain existing npm workflow while adding JSR support
  - Simplified dual-registry publishing process

### Patch Changes

- Updated dependencies [[`420ed073cf4d2d1c031b104a41dea08443f2ff6e`](https://github.com/muneebs/csrf-armor/commit/420ed073cf4d2d1c031b104a41dea08443f2ff6e), [`0fea891851d67aa1c0a216c8a607d47b4bdb3101`](https://github.com/muneebs/csrf-armor/commit/0fea891851d67aa1c0a216c8a607d47b4bdb3101)]:
  - @csrf-armor/core@1.1.0

## 1.0.1

### Patch Changes

- [#15](https://github.com/muneebs/csrf-armor/pull/15) [`58e501450279dcdd299ca6aa39221689d678c2f3`](https://github.com/muneebs/csrf-armor/commit/58e501450279dcdd299ca6aa39221689d678c2f3) Thanks [@muneebs](https://github.com/muneebs)! - fix: improve URL handling security and code quality

  - Remove unsafe URL base fallback patterns that could lead to potential vulnerabilities
  - Add readonly modifiers to CryptoKeyCache properties for better immutability
  - Update tests to use complete URLs for proper validation
  - Improve URL parsing by requiring proper absolute URLs instead of relying on base URL fallbacks

- Updated dependencies [[`58e501450279dcdd299ca6aa39221689d678c2f3`](https://github.com/muneebs/csrf-armor/commit/58e501450279dcdd299ca6aa39221689d678c2f3), [`58e501450279dcdd299ca6aa39221689d678c2f3`](https://github.com/muneebs/csrf-armor/commit/58e501450279dcdd299ca6aa39221689d678c2f3)]:
  - @csrf-armor/core@1.0.3

## 1.0.0

### Major Changes

- [#12](https://github.com/muneebs/csrf-armor/pull/12) [`44fb8ebf2bd3066d4c8e5f7d9dd12b86fb4bcf67`](https://github.com/muneebs/csrf-armor/commit/44fb8ebf2bd3066d4c8e5f7d9dd12b86fb4bcf67) Thanks [@muneebs](https://github.com/muneebs)! - Added Express.js adapter package:
  - Introduced @csrf-armor/express package
  - Implemented csrfMiddleware for CSRF token management
  - Created ExpressAdapter to handle request and response for CSRF operations
  - Added TypeScript definitions for CSRF token in Express request
  - Included tests for adapter and middleware functionality

### Patch Changes

- Updated dependencies [[`44fb8ebf2bd3066d4c8e5f7d9dd12b86fb4bcf67`](https://github.com/muneebs/csrf-armor/commit/44fb8ebf2bd3066d4c8e5f7d9dd12b86fb4bcf67), [`19dab6865f5d66123e20c01a9eff0eaefee5812c`](https://github.com/muneebs/csrf-armor/commit/19dab6865f5d66123e20c01a9eff0eaefee5812c)]:
  - @csrf-armor/core@1.0.2
