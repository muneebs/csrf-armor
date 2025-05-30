#!/usr/bin/env node

import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Get the project root directory (one level up from scripts)
const projectRoot = join(__dirname, "..");
const packageJsonPath = join(projectRoot, "package.json");

/**
 * Parse semantic version string into components
 * @param {string} version - Version string (e.g., "1.2.3")
 * @returns {Object} Object with major, minor, patch numbers
 */
function parseVersion(version) {
  const [major, minor, patch] = version.split(".").map(Number);
  return { major, minor, patch };
}

/**
 * Increment version based on type
 * @param {string} currentVersion - Current version string
 * @param {string} type - Type of update: 'major', 'minor', or 'patch'
 * @returns {string} New version string
 */
function incrementVersion(currentVersion, type) {
  const { major, minor, patch } = parseVersion(currentVersion);

  switch (type.toLowerCase()) {
    case "major":
      return `${major + 1}.0.0`;
    case "minor":
      return `${major}.${minor + 1}.0`;
    case "patch":
      return `${major}.${minor}.${patch + 1}`;
    default:
      throw new Error(
        `Invalid version type: ${type}. Must be 'major', 'minor', or 'patch'`,
      );
  }
}

/**
 * Set specific version
 * @param {string} version - Version string to set
 * @returns {string} Validated version string
 */
function setVersion(version) {
  // Basic validation for semantic versioning
  const versionRegex = /^\d+\.\d+\.\d+$/;
  if (!versionRegex.test(version)) {
    throw new Error(
      `Invalid version format: ${version}. Must be in format 'x.y.z'`,
    );
  }
  return version;
}

/**
 * Update package.json version
 * @param {string} newVersion - New version to set
 */
function updatePackageJson(newVersion) {
  try {
    // Read current package.json
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
    const oldVersion = packageJson.version;

    // Update version
    packageJson.version = newVersion;

    // Write back to file with proper formatting
    writeFileSync(
      packageJsonPath,
      `${JSON.stringify(packageJson, null, "\t")}\n`,
    );

    console.log(`✅ Version updated: ${oldVersion} → ${newVersion}`);
  } catch (error) {
    console.error("❌ Error updating package.json:", error.message);
    process.exit(1);
  }
}

/**
 * Display current version
 */
function showCurrentVersion() {
  try {
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
    console.log(`Current version: ${packageJson.version}`);
  } catch (error) {
    console.error("❌ Error reading package.json:", error.message);
    process.exit(1);
  }
}

/**
 * Display usage information
 */
function showHelp() {
  console.log(`
📦 Package Version Update Script

Usage:
  node scripts/update-version.js <command> [version]

Commands:
  major                 Increment major version (x.0.0)
  minor                 Increment minor version (x.y.0)
  patch                 Increment patch version (x.y.z)
  set <version>         Set specific version (e.g., 2.1.0)
  current               Show current version
  help                  Show this help message

Examples:
  node scripts/update-version.js patch     # 1.0.0 → 1.0.1
  node scripts/update-version.js minor     # 1.0.1 → 1.1.0
  node scripts/update-version.js major     # 1.1.0 → 2.0.0
  node scripts/update-version.js set 3.2.1 # Set to 3.2.1
  node scripts/update-version.js current   # Show current version
`);
}

// Main execution
function main() {
  const args = process.argv.slice(2);

  if (
    args.length === 0 ||
    args[0] === "help" ||
    args[0] === "--help" ||
    args[0] === "-h"
  ) {
    showHelp();
    return;
  }

  const command = args[0].toLowerCase();

  try {
    // Read current package.json to get current version
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
    const currentVersion = packageJson.version;

    switch (command) {
      case "current":
        showCurrentVersion();
        break;

      case "major":
      case "minor":
      case "patch":
        // biome-ignore lint/correctness/noSwitchDeclarations:
        const newVersion = incrementVersion(currentVersion, command);
        updatePackageJson(newVersion);
        break;

      case "set":
        if (!args[1]) {
          console.error(
            '❌ Error: Please provide a version number when using "set" command',
          );
          console.log("Example: node scripts/update-version.js set 2.1.0");
          process.exit(1);
        }
        // biome-ignore lint/correctness/noSwitchDeclarations:
        const specificVersion = setVersion(args[1]);
        updatePackageJson(specificVersion);
        break;

      default:
        console.error(`❌ Unknown command: ${command}`);
        showHelp();
        process.exit(1);
    }
  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
}

main();
