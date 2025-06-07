---
"@csrf-armor/core": minor
"@csrf-armor/express": minor
"@csrf-armor/nextjs": minor
---

Add JSR publishing support for dual npm/JSR distribution

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
