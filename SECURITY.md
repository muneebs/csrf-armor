# Security Policy

## Reporting a vulnerability

**Please don't report security vulnerabilities through public GitHub issues.**

Email **security@nebz.dev** with:

- the type of issue (for example a token validation bypass)
- the affected package, files or functions
- steps to reproduce, and proof-of-concept code if you have it
- the impact as you understand it

## What to expect

CSRF Armor is maintained in spare time, but security reports take priority.

- **Acknowledgement** within 3 days
- **Assessment** within a week, with progress updates after that
- **Fix**: critical issues as soon as possible, others within 2–4 weeks
- **Disclosure**: details are published after a fixed release is available
- **Credit** to the reporter, unless you'd prefer to stay anonymous

Actively exploited vulnerabilities are handled immediately.

## Supported versions

| Version | Supported |
|---|---|
| 1.x | ✅ |

Security fixes are released for the latest 1.x version of each package. Please stay on the latest release.

## Scope

In scope:

- the published `@csrf-armor/*` packages
- code and examples in this repository

Out of scope:

- applications that use CSRF Armor (report those to their maintainers)
- unofficial forks
- third-party dependencies (report those upstream)

When researching, only test against systems you own or have permission to test.

## Using CSRF Armor securely

Deployment guidance, including a production checklist, is in the [security guide](./docs/security.md).
