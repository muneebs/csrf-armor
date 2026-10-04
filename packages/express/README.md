# @csrf-armor/express

<img src="https://cdn.nebz.dev/csrf-armor/logo.jpeg" alt="CSRF Armor" />

[![CI](https://github.com/muneebs/csrf-armor/workflows/CI/badge.svg)](https://github.com/muneebs/csrf-armor/actions/workflows/ci.yml)
[![npm version](https://badge.fury.io/js/@csrf-armor%2Fexpress.svg)](https://badge.fury.io/js/@csrf-armor%2Fexpress)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)
[![Express.js](https://img.shields.io/badge/Express.js-4%2B-black.svg)](https://expressjs.com)

Express.js adapter for CSRF Armor - Advanced CSRF protection for Express.js applications.

---
## Installation

```bash
npm install @csrf-armor/express
# or
yarn add @csrf-armor/express
# or
pnpm add @csrf-armor/express
```
---
## Usage

```typescript
import express from 'express';
import { csrfMiddleware } from '@csrf-armor/express';

const app = express();

// Create the CSRF middleware
const csrfProtect = csrfMiddleware({
  // Optional configuration
  excludePaths: ['/webhook'], // Paths to exclude from CSRF protection
  strategy: 'signed-double-submit', // CSRF protection strategy
  secret: 'your-secret-key', // Required for signed strategies
  cookie: {
    prefix: '__Host-', // Cookie becomes __Host-csrf-token (needs HTTPS, see below)
    secure: true,
    sameSite: 'strict'
  }
});

// Apply the middleware to protected routes
app.use('/api', csrfProtect);

// Your routes here
app.post('/api/data', (req, res) => {
  res.json({ success: true });
});
```
---
## Configuration

The middleware accepts all configuration options from `@csrf-armor/core`. See the [core documentation](../core) for detailed configuration options.

### Quick Configuration Reference
```typescript
csrfMiddleware({
  strategy: 'signed-double-submit',    // Security strategy
  secret: process.env.CSRF_SECRET,     // Required for signed strategies
  token: {
    expiry: 3600,                      // Token lifetime (seconds)
    reissueThreshold: 500,             // Auto-renewal threshold (seconds)
    headerName: 'X-CSRF-Token',        // Header name
    fieldName: 'csrf_token'            // Form field name
  },
  cookie: {
    name: 'csrf-token',                // Cookie name
    prefix: '__Host-',                 // Browser-enforced name prefix (default: none)
    secure: true,                      // HTTPS only
    httpOnly: false,                   // Allow client access
    sameSite: 'strict'                 // CSRF protection
  },
  excludePaths: ['/api/public'],       // Skip protection
  allowedOrigins: ['https://yourdomain.com'] // Origin allowlist
})
```

### Cookie Prefixes (`__Host-`)

`cookie.prefix: '__Host-'` makes the browser reject CSRF cookies set by sibling
subdomains or plain-HTTP origins (cookie tossing). It requires `secure: true`,
`path: '/'` and no `domain`; other combinations throw a `CsrfConfigError` when
`csrfMiddleware()` is called. Front-end code that reads the cookie must use the
full name (`__Host-csrf-token`); `resolveCookieName(config.cookie)` from
`@csrf-armor/core` returns it. Safari rejects `Secure` (and so prefixed)
cookies over `http://localhost`, so you may want to enable the prefix in
production only. See the
[core guide](../core/README.md#cookie-prefixes-__host---__secure-).

---

## 📄 License

MIT © [Muneeb Samuels](https://github.com/muneebs)

---

## 📦 Related Packages

- **[@csrf-armor/core](../core)** - Framework-agnostic CSRF protection

---

**Questions?** [Open an issue](https://github.com/muneebs/csrf-armor/issues)
or [start a discussion](https://github.com/muneebs/csrf-armor/discussions)!
