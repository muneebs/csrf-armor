#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get script directory and project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
PACKAGE_JSON="$PROJECT_ROOT/package.json"

# Check if package.json exists
if [ ! -f "$PACKAGE_JSON" ]; then
    echo -e "${RED}❌ Error: package.json not found at $PACKAGE_JSON${NC}"
    exit 1
fi

# Function to get current version
get_current_version() {
    if command -v jq >/dev/null 2>&1; then
        jq -r '.version' "$PACKAGE_JSON"
    else
        # Fallback using grep and sed if jq is not available
        grep '"version"' "$PACKAGE_JSON" | sed 's/.*"version": *"\([^"]*\)".*/\1/'
    fi
}

# Function to update version in package.json
update_version() {
    local new_version="$1"
    
    if command -v jq >/dev/null 2>&1; then
        # Use jq for clean JSON manipulation
        jq --arg version "$new_version" '.version = $version' "$PACKAGE_JSON" > "$PACKAGE_JSON.tmp" && mv "$PACKAGE_JSON.tmp" "$PACKAGE_JSON"
    else
        # Fallback using sed
        sed -i.bak "s/\"version\": *\"[^\"]*\"/\"version\": \"$new_version\"/" "$PACKAGE_JSON" && rm "$PACKAGE_JSON.bak"
    fi
}

# Function to increment version
increment_version() {
    local current_version="$1"
    local increment_type="$2"
    
    # Parse version components
    IFS='.' read -r major minor patch <<< "$current_version"
    
    case "$increment_type" in
        "major")
            echo "$((major + 1)).0.0"
            ;;
        "minor")
            echo "$major.$((minor + 1)).0"
            ;;
        "patch")
            echo "$major.$minor.$((patch + 1))"
            ;;
        *)
            echo -e "${RED}❌ Error: Invalid increment type: $increment_type${NC}"
            exit 1
            ;;
    esac
}

# Function to validate version format
validate_version() {
    local version="$1"
    if [[ ! "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
        echo -e "${RED}❌ Error: Invalid version format: $version. Must be in format 'x.y.z'${NC}"
        exit 1
    fi
}

# Function to show help
show_help() {
    echo -e "${BLUE}📦 Package Version Update Script (Bash)${NC}"
    echo ""
    echo "Usage:"
    echo "  ./scripts/update-version.sh <command> [version]"
    echo ""
    echo "Commands:"
    echo "  major                 Increment major version (x.0.0)"
    echo "  minor                 Increment minor version (x.y.0)"
    echo "  patch                 Increment patch version (x.y.z)"
    echo "  set <version>         Set specific version (e.g., 2.1.0)"
    echo "  current               Show current version"
    echo "  help                  Show this help message"
    echo ""
    echo "Examples:"
    echo "  ./scripts/update-version.sh patch     # 1.0.0 → 1.0.1"
    echo "  ./scripts/update-version.sh minor     # 1.0.1 → 1.1.0"
    echo "  ./scripts/update-version.sh major     # 1.1.0 → 2.0.0"
    echo "  ./scripts/update-version.sh set 3.2.1 # Set to 3.2.1"
    echo "  ./scripts/update-version.sh current   # Show current version"
    echo ""
    echo -e "${YELLOW}Note: This script requires 'jq' for best results, but will fallback to sed if jq is not available.${NC}"
}

# Main execution
main() {
    if [ $# -eq 0 ] || [ "$1" = "help" ] || [ "$1" = "--help" ] || [ "$1" = "-h" ]; then
        show_help
        exit 0
    fi
    
    local command="$1"
    local current_version
    current_version=$(get_current_version)
    
    if [ -z "$current_version" ] || [ "$current_version" = "null" ]; then
        echo -e "${RED}❌ Error: Could not read current version from package.json${NC}"
        exit 1
    fi
    
    case "$command" in
        "current")
            echo -e "${BLUE}Current version: $current_version${NC}"
            ;;
        "major"|"minor"|"patch")
            local new_version
            new_version=$(increment_version "$current_version" "$command")
            update_version "$new_version"
            echo -e "${GREEN}✅ Version updated: $current_version → $new_version${NC}"
            ;;
        "set")
            if [ -z "$2" ]; then
                echo -e "${RED}❌ Error: Please provide a version number when using 'set' command${NC}"
                echo "Example: ./scripts/update-version.sh set 2.1.0"
                exit 1
            fi
            validate_version "$2"
            update_version "$2"
            echo -e "${GREEN}✅ Version updated: $current_version → $2${NC}"
            ;;
        *)
            echo -e "${RED}❌ Unknown command: $command${NC}"
            show_help
            exit 1
            ;;
    esac
}

main "$@"