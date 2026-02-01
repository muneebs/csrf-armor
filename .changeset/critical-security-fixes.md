---
"@csrf-armor/core": patch
"@csrf-armor/express": patch
"@csrf-armor/nextjs": patch
---

**SECURITY FIXES: Critical timing attack vulnerabilities and dependency updates**

This release addresses critical security vulnerabilities and updates all vulnerable dependencies.

## Critical Security Fixes

### Timing Attack Vulnerabilities (CRITICAL)
Fixed three timing attack vulnerabilities in CSRF token validation that could allow attackers to reconstruct valid tokens through timing analysis:

- **validateDoubleSubmit** (validation.ts:104): Replaced non-constant-time string comparison with `timingSafeEqual()`
- **validateSignedDoubleSubmit cookie check** (validation.ts:142): Fixed cookie integrity comparison to use constant-time equality
- **validateSignedDoubleSubmit token matching** (validation.ts:147): Fixed token comparison to prevent timing side-channel attacks

These vulnerabilities could have allowed attackers to bypass CSRF protection entirely by analyzing response timing patterns. All token comparisons now use cryptographically constant-time operations.

### Weak Secret Generation (HIGH)
Fixed default secret generation (constants.ts:146) that produced weak comma-separated decimal strings instead of proper base64-encoded secrets. Now uses `generateSecureSecret()` for high-entropy, properly-encoded secrets.

## Dependency Security Updates

All vulnerable dependencies have been updated to patched versions:

- **qs** (CVE-2025-15284): Updated to >=6.14.1 via pnpm override - fixes DoS vulnerability via memory exhaustion
- **diff** (CVE-2026-24001): Updated to 8.0.3 via tsdown 0.20.1 - fixes denial of service vulnerability
- **js-yaml**: Updated via @changesets/cli 2.29.8 - resolves YAML parsing vulnerabilities
- **next** (npm advisories: 1112593, 1112638, 1112649): Updated to 16.1.6 - fixes multiple security vulnerabilities including CVE-2025-59471, CVE-2025-59472, and CVE-2026-23864

## Other Updates

- Updated `@biomejs/biome` to 2.3.13
- Updated `@types/node` to 20.0.0 (fixes peer dependency warnings)
- Updated vitest and related packages to 4.0.18
- Updated typescript to 5.9.3
- Updated jsdom to 27.4.0
- Updated package exports to match new tsdown output format (.mjs files)

## Security Impact

- ✅ Zero critical vulnerabilities remaining
- ✅ Zero high-severity vulnerabilities remaining
- ✅ No remaining known CVEs after upgrade (verified via pnpm audit)
- ✅ All 66 tests passing across all packages

**Upgrade Priority: CRITICAL** - All users should upgrade immediately to address timing attack vulnerabilities.