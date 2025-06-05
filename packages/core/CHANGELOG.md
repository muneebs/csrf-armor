# @csrf-armor/core

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
