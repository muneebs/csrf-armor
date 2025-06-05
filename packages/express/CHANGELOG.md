# @csrf-armor/express

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
