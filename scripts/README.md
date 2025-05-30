# Version Update Scripts

This directory contains scripts to help manage package version updates for the project.

## Available Scripts

### 1. Node.js Script (`update-version.js`)

A comprehensive Node.js script that provides version management functionality.

**Usage:**
```bash
node scripts/update-version.js <command> [version]
```

**Commands:**
- `major` - Increment major version (x.0.0)
- `minor` - Increment minor version (x.y.0)
- `patch` - Increment patch version (x.y.z)
- `set <version>` - Set specific version (e.g., 2.1.0)
- `current` - Show current version
- `help` - Show help message

**Examples:**
```bash
node scripts/update-version.js patch     # 1.0.0 → 1.0.1
node scripts/update-version.js minor     # 1.0.1 → 1.1.0
node scripts/update-version.js major     # 1.1.0 → 2.0.0
node scripts/update-version.js set 3.2.1 # Set to 3.2.1
node scripts/update-version.js current   # Show current version
```

### 2. Bash Script (`update-version.sh`)

A shell script alternative that provides the same functionality as the Node.js script.

**Usage:**
```bash
./scripts/update-version.sh <command> [version]
```

**Requirements:**
- `jq` (recommended for best JSON manipulation)
- Falls back to `sed` if `jq` is not available

**Examples:**
```bash
./scripts/update-version.sh patch     # 1.0.0 → 1.0.1
./scripts/update-version.sh minor     # 1.0.1 → 1.1.0
./scripts/update-version.sh major     # 1.1.0 → 2.0.0
./scripts/update-version.sh set 3.2.1 # Set to 3.2.1
./scripts/update-version.sh current   # Show current version
```

## NPM Scripts

For convenience, the following npm scripts are available in `package.json`:

```bash
npm run version:current  # Show current version
npm run version:patch    # Increment patch version
npm run version:minor    # Increment minor version
npm run version:major    # Increment major version
npm run version:set      # Set specific version (requires additional argument)
```

**Examples:**
```bash
npm run version:patch
npm run version:minor
npm run version:major
npm run version:set 2.1.0
```

## Features

- ✅ Semantic versioning support (major.minor.patch)
- ✅ Version validation
- ✅ Current version display
- ✅ Error handling and validation
- ✅ Colored output (bash script)
- ✅ Cross-platform compatibility
- ✅ Automatic JSON formatting preservation

## Installation of Dependencies

### For Bash Script (Optional)

Install `jq` for better JSON manipulation:

**macOS:**
```bash
brew install jq
```

**Ubuntu/Debian:**
```bash
sudo apt-get install jq
```

**Other systems:**
See [jq installation guide](https://stedolan.github.io/jq/download/)

## Integration with Git Workflow

You can integrate these scripts into your release workflow:

```bash
# Example release workflow
npm run version:patch
git add package.json
git commit -m "chore: bump version to $(node -p "require('./package.json').version")"
git tag "v$(node -p "require('./package.json').version")"
git push && git push --tags
```

## Error Handling

Both scripts include comprehensive error handling for:
- Invalid version formats
- Missing package.json file
- File read/write permissions
- Invalid command arguments

## Contributing

When adding new features to these scripts, ensure:
1. Both Node.js and Bash versions are updated
2. Error handling is comprehensive
3. Help documentation is updated
4. Examples are provided