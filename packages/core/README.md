# @csrf-armor/core

<img src="https://cdn.nebz.dev/csrf-armor/logo.jpeg" alt="CSRF Armor" />

[![CodeQL](https://github.com/muneebs/csrf-armor/workflows/CodeQL%20Security%20Analysis/badge.svg)](https://github.com/muneebs/csrf-armor/actions/workflows/codeql-analysis.yml)
[![CI](https://github.com/muneebs/csrf-armor/workflows/CI/badge.svg)](https://github.com/muneebs/csrf-armor/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/@csrf-armor/core.svg)](https://www.npmjs.com/package/@csrf-armor/core)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**Framework-agnostic CSRF protection with multiple security strategies and zero runtime dependencies.**

Built for modern web applications that need flexible, high-performance CSRF protection without vendor lock-in.

## 🚀 Quick Start

```bash
npm install @csrf-armor/core
```

```typescript
import { generateSignedToken, parseSignedToken } from '@csrf-armor/core';

// Generate a secure, session-bound token
const token = await generateSignedToken('your-32-character-secret-key', 3600);

// Validate the token later
const payload = await parseSignedToken(submittedToken, 'your-32-character-secret-key');
console.log('Token valid until:', new Date(payload.exp * 1000));
```

> **⚠️ SECURITY WARNING**: Use a strong secret in production! Generate with `crypto.getRandomValues(new Uint8Array(32))`.

---

## 🛡️ Choose Your Strategy

| Strategy | Security | Performance | Best For | Setup Complexity |
|----------|----------|-------------|----------|------------------|
| **Hybrid** ⭐ (default) | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | Maximum security | Medium |
| **Signed Double Submit** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | E-commerce, finance | Medium |
| **Signed Token** | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | APIs, microservices | Medium |
| **Origin Check** | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | Mobile backends | Easy |
| **Fetch Metadata** | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | Defense-in-depth only | Easy |

> **Note:** `double-submit` (plain token comparison) has been removed in v2. Use `signed-double-submit` or `hybrid`.

---

## 🔧 Framework Integration

- **[@csrf-armor/express](../express)** — Express.js middleware adapter
- **[@csrf-armor/nextjs](../nextjs)** — Next.js App Router middleware + React hooks
- **[@csrf-armor/nuxt](../nuxt)** — Nuxt module + composables
- **[@csrf-armor/hono](../hono)** — Hono middleware adapter (v2.0 staged)
- **[@csrf-armor/sveltekit](../sveltekit)** — SvelteKit `handle` hook (v2.0 staged)

For custom frameworks, implement the `CsrfAdapter<TRequest, TResponse>` interface.

---

## ⚙️ Configuration

### Basic Setup

```typescript
import { createCsrfProtection } from '@csrf-armor/core';

// Recommended for most applications
const csrfProtection = createCsrfProtection(adapter, {
  strategy: 'hybrid',               // or 'signed-double-submit', 'signed-token', 'origin-check', 'fetch-metadata'
  secret: process.env.CSRF_SECRET!,   // ⚠️ Required in production (min 32 chars)
  cookie: {
    secure: true,                     // HTTPS only
    sameSite: 'lax'
  }
});
```

### Strategy-Specific Configuration

```typescript
// Maximum security (Financial, Healthcare)
{ strategy: 'hybrid', secret: process.env.CSRF_SECRET!, allowedOrigins: ['https://app.com'] }

// High Performance (Public APIs)
{ strategy: 'origin-check', allowedOrigins: ['https://mobile.app'] }

// Balanced (Most Web Apps)
{ strategy: 'signed-double-submit', secret: process.env.CSRF_SECRET! }

// Defense-in-depth (requires modern browser)
{ strategy: 'fetch-metadata' }
```

### New v2 Options

```typescript
{
  // Bind tokens to the user session to prevent token replay across sessions
  getSessionId: (req) => req.cookies.get('session') ?? undefined,

  // Rotate tokens after every successful state-changing request
  rotateOnUse: true,

  // Accept tokens signed with a previous secret during key rotation
  previousSecrets: [process.env.OLD_CSRF_SECRET!],

  // Prefix the cookie name with __Host- to enforce path=/ and no domain
  hostCookiePrefix: true,

  // Enforce a whitelist of Content-Types for state-changing requests
  contentType: {
    enforcePresence: true,
    allowedTypes: ['application/json', 'application/x-www-form-urlencoded'],
  },

  // Security observability hooks
  logger: console,
  metrics: {
    onAccept: ({ strategy, method, path }) => { /* ... */ },
    onReject: ({ strategy, method, path, reason }) => { /* ... */ },
    onTokenRotated: ({ strategy, path }) => { /* ... */ },
  },
  onFailure: ({ strategy, method, path, reason, origin, secFetchSite }) => { /* ... */ },
}
```

---

## 🔍 Common Issues

### ❓ Getting "Token mismatch" errors?

Ensure your adapter extracts tokens from all sources (header, cookie, body) and does not lowercase cookie names:

```typescript
async getTokenFromRequest(request: CsrfRequest, config: RequiredCsrfConfig) {
  const headers = request.headers instanceof Map
    ? request.headers
    : new Map(Object.entries(request.headers ?? {}));

  const headerValue = headers.get(config.token.headerName.toLowerCase());
  if (headerValue) return headerValue;

  const cookies = request.cookies instanceof Map
    ? request.cookies
    : new Map(Object.entries(request.cookies ?? {}));
  const cookieValue = cookies.get(config.cookie.name); // exact case
  if (cookieValue) return cookieValue;

  if (request.body && typeof request.body === 'object') {
    const value = request.body[config.token.fieldName];
    if (typeof value === 'string') return value;
  }

  return undefined;
}
```

### ❓ Tokens not working across subdomains?

```typescript
const config = {
  cookie: {
    domain: '.yourdomain.com', // Note the leading dot
    sameSite: 'lax'            // 'strict' blocks cross-subdomain
  }
};
```

### ❓ CSRF blocking legitimate requests?

```typescript
const config = {
  excludePaths: ['/api/webhooks', '/api/public', '/health'],
  contentType: {
    skipValidation: ['multipart/form-data'] // For file uploads
  }
};
```

### ❓ Performance issues?

Choose a faster strategy or exclude read-only endpoints:

```typescript
// Option 1: Faster strategy
{ strategy: 'origin-check', allowedOrigins: ['https://app.example.com'] }

// Option 2: Exclude read-only paths
{ excludePaths: ['/api/read', '/api/search'] }
```

---

## 🧠 Core API

### Token Functions

```typescript
// Generate signed tokens
const token = await generateSignedToken(secret, 3600);

// Generate session-bound signed tokens
const token = await generateSignedToken(secret, 3600, sessionId);

// Parse and validate
const payload = await parseSignedToken(token, secret, previousSecrets);
console.log('Expires:', new Date(payload.exp * 1000));

// Generate random nonces
const nonce = generateNonce(32);
```

### Protection Class

```typescript
const protection = createCsrfProtection(adapter, config);
const result = await protection.protect(request, response);

if (result.success) {
  console.log('CSRF token:', result.token);
} else {
  console.error('Validation failed:', result.reason);
}
```

### Error Handling

```typescript
import { TokenExpiredError, TokenInvalidError, OriginMismatchError } from '@csrf-armor/core';

try {
  await parseSignedToken(token, secret);
} catch (error) {
  if (error instanceof TokenExpiredError) {
    // Handle expired token
  } else if (error instanceof TokenInvalidError) {
    // Handle invalid signature
  }
}
```

---

## 📚 Documentation

- **[Advanced Configuration Guide](./docs/ADVANCED.md)** — Complex setups, custom adapters, all config options
- **[Security Analysis](./docs/SECURITY.md)** — Security model deep-dive and best practices
- **[Migration Guide](./docs/MIGRATION.md)** — Migrating from v1 and other CSRF libraries

---

## 🤝 Contributing

Community contributions welcome! High-impact areas include framework adapters, performance optimizations, security enhancements, and developer experience improvements.

---

## 📦 Related Packages

- **[@csrf-armor/nextjs](../nextjs)** — Next.js App Router middleware and React hooks
- **[@csrf-armor/express](../express)** — Express.js middleware adapter
- **[@csrf-armor/nuxt](../nuxt)** — Nuxt module and composables

---

## 📄 License

MIT © [Muneeb Samuels](https://github.com/muneebs)
