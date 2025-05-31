# GitHub Workflows

This repository uses GitHub Actions workflows for continuous integration, testing, and automated releases using [Changesets](https://github.com/changesets/changesets).

## Workflows Overview

### 🔧 CI (`ci.yml`)

**Triggers:** Push to `main`/`develop`, Pull Requests

**Purpose:** Validates code quality and ensures packages build correctly

**Jobs:**
- **test**: Runs tests, linting, type checking, and builds on multiple Node.js versions (20.x, 22.x)
- **build-check**: Creates build artifacts for verification
- **changeset-check**: Ensures changesets are included when package files are modified (PR only)

### 🚀 Release (`release-changesets.yml`)

**Triggers:** Push to `main` branch

**Purpose:** Handles automated releases using Changesets

**Features:**
- Automatically creates "Version Packages" PRs when changesets are present
- Publishes packages to NPM when version PR is merged
- Creates GitHub releases with generated changelogs
- Supports monorepo with multiple packages

**Workflow:**
1. Detects pending changesets
2. Creates/updates a "Version Packages" PR with version bumps
3. When PR is merged, publishes packages to NPM
4. Creates GitHub releases with changelogs

### 🧪 Prerelease (`prerelease.yml`)

**Triggers:** Push to `develop`/`beta`/`alpha` branches, Manual dispatch

**Purpose:** Creates snapshot releases for testing

**Features:**
- Publishes snapshot versions with branch-specific tags
- No version bumping in git history
- Useful for testing changes before official release

**Tags:**
- `develop` branch → `dev` tag
- `beta` branch → `beta` tag  
- `alpha` branch → `alpha` tag
- Manual → custom tag

## Using Changesets

### Adding a Changeset

When you make changes to packages, add a changeset:

```bash
pnpm changeset
```

This will:
1. Prompt you to select which packages changed
2. Ask for the type of change (patch, minor, major)
3. Request a description of the changes
4. Create a changeset file in `.changeset/`

### Types of Changes

- **patch**: Bug fixes, documentation updates
- **minor**: New features, non-breaking changes
- **major**: Breaking changes

### Example Changeset Flow

1. Make changes to `packages/core/src/index.ts`
2. Run `pnpm changeset`
3. Select `@csrf-lite/core` package
4. Choose `minor` for a new feature
5. Write: "Add new validateToken method"
6. Commit the changeset file with your changes
7. Push to main branch
8. Workflow creates "Version Packages" PR
9. Merge PR to trigger release

## Release Process

### Automatic Release (Recommended)

1. **Make Changes**: Modify package code
2. **Add Changeset**: Run `pnpm changeset`
3. **Commit & Push**: Include changeset in your commit
4. **Review PR**: Workflow creates "Version Packages" PR
5. **Merge**: Merging triggers automatic publication

### Manual Snapshot Release

For testing unreleased changes:

```bash
# Trigger prerelease workflow manually
gh workflow run prerelease.yml -f snapshot_tag=testing
```

## Package Installation

### Published Packages

```bash
# Latest stable versions
npm install @csrf-lite/core
npm install @csrf-lite/nextjs

# Specific version
npm install @csrf-lite/core@1.2.3
```

### Snapshot Packages

```bash
# Development snapshots
npm install @csrf-lite/core@dev
npm install @csrf-lite/nextjs@dev

# Beta snapshots
npm install @csrf-lite/core@beta
npm install @csrf-lite/nextjs@beta
```

## Required Secrets

Configure these secrets in your GitHub repository:

- `NPM_TOKEN`: NPM authentication token for publishing packages
- `GITHUB_TOKEN`: Automatically provided by GitHub Actions

## Optional Variables

- `SLACK_WEBHOOK_URL`: For release notifications (optional)

## Monorepo Structure

```
packages/
├── core/           # @csrf-lite/core
└── nextjs/         # @csrf-lite/nextjs
```

Each package:
- Has its own `package.json`
- Can be versioned independently
- Published with `@csrf-lite/` scope
- Follows semantic versioning

## Troubleshooting

### Changeset Not Required

If you see a "changeset not required" message, it means you only modified:
- Test files
- Documentation
- Configuration files
- Files outside `packages/`

### Failed Publication

Check:
1. NPM_TOKEN is valid and has publish permissions
2. Package names don't conflict with existing packages
3. All packages build successfully
4. No syntax errors in package.json files

### Version Conflicts

If version conflicts occur:
1. Delete the "Version Packages" PR
2. Add a new changeset with correct version bump
3. Push to trigger new version PR creation