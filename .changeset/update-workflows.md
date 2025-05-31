---
"@csrf-lite/core": patch
"@csrf-lite/nextjs": patch
---

Update GitHub workflows to use changesets for automated releases

- Replaced manual version management with changesets
- Updated CI workflow to check for changesets on PRs
- Simplified release process with automated version bumping
- Added snapshot releases for prerelease testing
- Improved monorepo support across all workflows