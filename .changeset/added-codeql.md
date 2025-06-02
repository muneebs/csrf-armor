---
"@csrf-armor/core": patch
"@csrf-armor/nextjs": patch
---

Add comprehensive security analysis and automated scanning

- Add CodeQL GitHub Actions workflow for automated security analysis
- Add local security check script with CSRF-specific vulnerability detection
- Add security-focused npm scripts for development workflow
- Implement automated scanning for hardcoded secrets, timing attacks, and weak cryptography
- Add weekly scheduled security scans and PR-based security analysis
