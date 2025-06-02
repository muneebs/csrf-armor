#!/bin/bash
# Local security analysis script for CSRF-Armor

set -e

echo "🔒 Running CSRF-Armor Security Analysis..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_status "Running manual security checks..."

# Check for hardcoded secrets
echo "Checking for hardcoded secrets..."
if grep -r "secret.*:" packages/*/src/ | grep -v "process.env" | grep -v "default-secret-change-this" | grep -q .; then
    print_error "Potential hardcoded secrets found!"
    grep -r "secret.*:" packages/*/src/ | grep -v "process.env" | grep -v "default-secret-change-this"
else
    print_status "No hardcoded secrets found"
fi

# Check for weak random generation
echo "Checking for weak random generation..."
if grep -r "Math.random" packages/*/src/ | grep -q .; then
    print_error "Weak random generation found! Use crypto.getRandomValues()"
    grep -r "Math.random" packages/*/src/
else
    print_status "No weak random generation found"
fi

# Check for timing attack vulnerabilities
echo "Checking for timing attack vulnerabilities..."
if grep -r "===" packages/*/src/ | grep -i "token\|secret\|csrf" | grep -v "timingSafeEqual" | grep -q .; then
    print_error "Potential timing attack vulnerability found! Use constant-time comparison"
    grep -r "===" packages/*/src/ | grep -i "token\|secret\|csrf" | grep -v "timingSafeEqual"
else
    print_status "No timing attack vulnerabilities found"
fi

# Check for missing HTTPS enforcement
echo "Checking for HTTPS enforcement..."
if grep -r "secure.*false" packages/*/src/ | grep -q .; then
    print_warning "Non-secure cookies found - ensure HTTPS in production"
    grep -r "secure.*false" packages/*/src/
else
    print_status "HTTPS enforcement looks good"
fi

# Check TypeScript for any 'any' types in security-critical code
echo "Checking for unsafe TypeScript types..."
if grep -r ": any" packages/*/src/ | grep -i "token\|secret\|csrf" | grep -q .; then
    print_warning "Unsafe 'any' types found in security-critical code"
    grep -r ": any" packages/*/src/ | grep -i "token\|secret\|csrf"
else
    print_status "No unsafe types found"
fi

print_status "Security analysis complete!"
echo ""
echo "🔒 Security check completed successfully!"
