# @csrf-armor/core

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

- [#21](https://github.com/muneebs/csrf-armor/pull/21) [`420ed073cf4d2d1c031b104a41dea08443f2ff6e`](https://github.com/muneebs/csrf-armor/commit/420ed073cf4d2d1c031b104a41dea08443f2ff6e) Thanks [@muneebs](https://github.com/muneebs)! - Fix browser navigation token refresh and adapter robustness

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

## 1.0.3

### Patch Changes

- [#15](https://github.com/muneebs/csrf-armor/pull/15) [`58e501450279dcdd299ca6aa39221689d678c2f3`](https://github.com/muneebs/csrf-armor/commit/58e501450279dcdd299ca6aa39221689d678c2f3) Thanks [@muneebs](https://github.com/muneebs)! - fix: improve URL handling security and code quality

  - Remove unsafe URL base fallback patterns that could lead to potential vulnerabilities
  - Add readonly modifiers to CryptoKeyCache properties for better immutability
  - Update tests to use complete URLs for proper validation
  - Improve URL parsing by requiring proper absolute URLs instead of relying on base URL fallbacks

- [#15](https://github.com/muneebs/csrf-armor/pull/15) [`58e501450279dcdd299ca6aa39221689d678c2f3`](https://github.com/muneebs/csrf-armor/commit/58e501450279dcdd299ca6aa39221689d678c2f3) Thanks [@muneebs](https://github.com/muneebs)! - docs: update double-submit strategy security recommendations

  - Reduce security rating from ⭐⭐⭐ to ⭐ for double-submit strategy across all documentation
  - Update recommendations to specify "Local development" only, not production use
  - Align package documentation with main README security warnings
  - Remove references to production use cases like "Content management systems, internal tools"

## 1.0.2

### Patch Changes

- [#12](https://github.com/muneebs/csrf-armor/pull/12) [`44fb8ebf2bd3066d4c8e5f7d9dd12b86fb4bcf67`](https://github.com/muneebs/csrf-armor/commit/44fb8ebf2bd3066d4c8e5f7d9dd12b86fb4bcf67) Thanks [@muneebs](https://github.com/muneebs)! - docs: Update documentation

  - Enhanced documentation in ADVANCED.md and SECURITY.md with additional resources and usage examples.

- [`19dab6865f5d66123e20c01a9eff0eaefee5812c`](https://github.com/muneebs/csrf-armor/commit/19dab6865f5d66123e20c01a9eff0eaefee5812c) - Enhance CsrfRequest interface and update NextjsAdapter to handle headers and body correctly

## 1.0.1

### Patch Changes

- [`99d33a8cfaeb4dabeb380cb248779c5b7610928f`](https://github.com/muneebs/csrf-armor/commit/99d33a8cfaeb4dabeb380cb248779c5b7610928f) - streamline README content by removing outdated examples and enhancing structure for clarity

## 1.0.0

### Major Changes

- [#1](https://github.com/muneebs/csrf-armor/pull/1) [`e33c1aeacd29803c9d3f0eb3c539404a92b177c8`](https://github.com/muneebs/csrf-armor/commit/e33c1aeacd29803c9d3f0eb3c539404a92b177c8) Thanks [@muneebs](https://github.com/muneebs)! - **🚀 Initial release**

  **Features:**

  - **Next.js Package**: Complete CSRF protection integration for Next.js applications

    - App Router and Pages Router support
    - React hooks and components for client-side integration
    - Middleware adapter for seamless integration
    - TypeScript definitions and comprehensive documentation

  - **Core Package**: Improved framework-agnostic CSRF protection
    - Multiple validation strategies (double-submit cookies, synchronizer tokens)
    - Robust cryptographic utilities with secure token generation
    - Comprehensive error handling and validation
    - Flexible configuration options

  **📚 Documentation & Tooling:**

  - Comprehensive README and security documentation
  - GitHub workflows documentation with usage examples
  - Biome integration for consistent code formatting and linting
  - TypeScript configurations across packages

- [`2de5727218eab60e904f638b1777f91a056e204f`](https://github.com/muneebs/csrf-armor/commit/2de5727218eab60e904f638b1777f91a056e204f) - Rename packages from csrf-lite due to csrf-armor due to a conflict with an existing npm package named csrf-lite

  - Rename all packages to @csrf-armor scope
  - Update repository URLs and imports
  - Update documentation and workspace config

### Patch Changes

- [`8417485ec45588f2ab8cb3563b6b954f77b7d605`](https://github.com/muneebs/csrf-armor/commit/8417485ec45588f2ab8cb3563b6b954f77b7d605) - Add comprehensive security analysis and automated scanning

  - Add CodeQL GitHub Actions workflow for automated security analysis
  - Add local security check script with CSRF-specific vulnerability detection
  - Add security-focused npm scripts for development workflow
  - Implement automated scanning for hardcoded secrets, timing attacks, and weak cryptography
  - Add weekly scheduled security scans and PR-based security analysis

- [`bff5ff56921381659e37529660bf0061505a2738`](https://github.com/muneebs/csrf-armor/commit/bff5ff56921381659e37529660bf0061505a2738) - Clean up and format package.json files

  - Format package.json files for consistent structure
  - Remove unused fields (keywords, publishConfig, bugs)

- [`8417485ec45588f2ab8cb3563b6b954f77b7d605`](https://github.com/muneebs/csrf-armor/commit/8417485ec45588f2ab8cb3563b6b954f77b7d605) - - Updated core CSRF logic, constants, types, and validation.

  - Improved and expanded documentation for core package.
  - Enhanced Next.js adapter, middleware, and client logic.
  - Added and improved test coverage for both packages.
  - Updated package metadata and internal scripts.

- [`2de5727218eab60e904f638b1777f91a056e204f`](https://github.com/muneebs/csrf-armor/commit/2de5727218eab60e904f638b1777f91a056e204f) - Fix TypeScript compilation and CI workflow build order issues

  **🔧 Fixes:**

  - **Build Order**: Updated CI workflows to build core package before type checking dependent packages
  - **TypeScript Issues**: Fixed type errors in NextJS adapter for cookie and header handling
  - **Project References**: Removed invalid TypeScript project reference to non-existent vite package
  - **Workflow Dependencies**: Ensured proper build sequence across all GitHub Actions workflows

  **🚀 Improvements:**

  - CI pipeline now builds `@csrf-armor/core` first to generate types for dependent packages
  - Enhanced type safety in NextJS adapter with proper type assertions
  - Streamlined TypeScript project configuration for monorepo structure

  **📦 Changes:**

  - Updated `.github/workflows/ci.yml` to build core package before type checking
  - Updated `.github/workflows/release-changesets.yml` with proper build order
  - Updated `.github/workflows/prerelease.yml` with dependency management
  - Fixed TypeScript errors in `packages/nextjs/src/adapter.ts`
  - Cleaned up root `tsconfig.json` project references

- [`dbb3f73aca3f3b190f96edf386990953985b3a96`](https://github.com/muneebs/csrf-armor/commit/dbb3f73aca3f3b190f96edf386990953985b3a96) - - Update logo image source in README.md
  - update CI workflow permissions
