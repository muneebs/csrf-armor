---
"@csrf-armor/core": patch
"@csrf-armor/nextjs": patch
---

Fix TypeScript compilation and CI workflow build order issues

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