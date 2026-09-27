# @csrf-armor/core

<img src="https://cdn.nebz.dev/csrf-armor/logo.jpeg" alt="CSRF Armor" />

[![CodeQL](https://github.com/muneebs/csrf-armor/workflows/CodeQL%20Security%20Analysis/badge.svg)](https://github.com/muneebs/csrf-armor/actions/workflows/codeql-analysis.yml)
[![CI](https://github.com/muneebs/csrf-armor/workflows/CI/badge.svg)](https://github.com/muneebs/csrf-armor/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/@csrf-armor/core.svg)](https://www.npmjs.com/package/@csrf-armor/core)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**Framework-agnostic CSRF protection with multiple security strategies and zero dependencies.**

Built for modern web applications that need flexible, high-performance CSRF protection without vendor lock-in.

## 🚀 Quick Start

```bash
npm install @csrf-armor/core
```

```typescript
import { generateSignedToken, parseSignedToken } from '@csrf-armor/core';

// Generate a secure token
const token = await generateSignedToken('your-32-char-secret', 3600);

// Validate the token later
const payload = await parseSignedToken(submittedToken, 'your-32-char-secret');
console.log('Token valid until:', new Date(payload.exp * 1000));
```

> **⚠️ SECURITY WARNING**: Use a strong secret in production! Generate with `crypto.getRandomValues(new Uint8Array(32))`.

---

## 🛡️ Choose Your Strategy

| Strategy | Security | Performance | Best For | Setup Complexity |
|----------|----------|-------------|----------|------------------|
| **Signed Double Submit** ⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | E-commerce, finance | Medium |
| **Double Submit** | ⭐ | ⭐⭐⭐⭐⭐ | Local development | Easy |
| **Signed Token** | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | APIs, microservices | Medium |
| **Origin Check** | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | Mobile backends | Easy |
| **Hybrid** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | Maximum security | Hard |

---

## 🔧 Framework Integration

### Express.js

> **💡 Complete Express.js solution**: [@csrf-armor/express](../express) with React hooks and simplified setup.

### Next.js

> **💡 Complete Next.js solution**: [@csrf-armor/nextjs](../nextjs) with React hooks and simplified setup.

**🔌 More framework examples and adapters**: [Advanced Configuration Guide →](./docs/ADVANCED.md)

---

## ⚙️ Configuration

### Basic Setup

```typescript
import { createCsrfProtection } from '@csrf-armor/core';

// Recommended for most applications
const csrfProtection = createCsrfProtection(adapter, {
  strategy: 'signed-double-submit',
  secret: process.env.CSRF_SECRET!, // ⚠️ Required in production
  cookie: {
    secure: true,      // HTTPS only
    sameSite: 'strict' // Strict same-site policy
  }
});
```

### Strategy-Specific Configuration

```typescript
// High Security (Financial, Healthcare)
{ strategy: 'hybrid', secret: process.env.CSRF_SECRET!, allowedOrigins: ['https://app.com'] }

// High Performance (Public APIs)  
{ strategy: 'origin-check', allowedOrigins: ['https://mobile.app'] }

// Balanced (Most Web Apps)
{ strategy: 'signed-double-submit', secret: process.env.CSRF_SECRET! }

// Development
{ strategy: 'double-submit', cookie: { secure: false } }
```

**📚 Complete configuration options**: [Advanced Configuration Guide →](./docs/ADVANCED.md)

---

## 🔍 Common Issues

### ❓ Getting "Token mismatch" errors?

```typescript
// Ensure your adapter extracts tokens from all sources
async getTokenFromRequest(request: CsrfRequest, config: RequiredCsrfConfig) {
  const headers = request.headers instanceof Map 
    ? request.headers 
    : new Map(Object.entries(request.headers));

  // Try header first
  const headerValue = headers.get(config.token.headerName.toLowerCase());
  if (headerValue) return headerValue;

  // Try form data
  if (request.body && typeof request.body === 'object') {
    const body = request.body as Record<string, unknown>;
    const formValue = body[config.token.fieldName];
    if (typeof formValue === 'string') return formValue;
  }

  return undefined;
}
```

### ❓ Tokens not working across subdomains?

```typescript
const config = {
  cookie: {
    domain: '.yourdomain.com', // Note the leading dot
    sameSite: 'lax' // 'strict' blocks cross-subdomain
  }
};
```

### ❓ CSRF blocking legitimate requests?

```typescript
const config = {
  excludePaths: ['/api/webhooks', '/api/public', '/health'],
  skipContentTypes: ['application/json'] // For JSON-only APIs
};
```

### ❓ Performance issues?

Choose a faster strategy or exclude read-only endpoints:

```typescript
// Option 1: Faster strategy
{ strategy: 'double-submit' } // No crypto overhead

// Option 2: Exclude read-only paths  
{ excludePaths: ['/api/read', '/api/search'] }
```

---

## 🧠 Core API

### Signed-token browser binding

For `signed-token` and `hybrid`, unsafe requests must submit the current
signed token in a supported header, query parameter, or body field **and**
send the matching cookie named by `cookie.name`. A token copied from another
browser, or submitted without the cookie, is rejected. Hybrid also requires
an allowed origin.

Obtain the token and cookie from a safe request first. After a response rotates
the cookie, use the updated token for subsequent submissions; cached form or
header tokens may need refreshing. The token format and expiry remain unchanged.

This binds proof to browser CSRF-cookie state, not an application authentication
session. Keep cookies protected from attacker-controlled writes. The low-level
`generateSignedToken` and `parseSignedToken` helpers only handle cryptography;
use request protection to enforce browser binding.

### Token Functions

```typescript
// Generate signed tokens
const token = await generateSignedToken('secret', 3600);

// Parse and validate
const payload = await parseSignedToken(token, 'secret');
console.log('Expires:', new Date(payload.exp * 1000));

// Generate random nonces
const nonce = generateNonce(32); // 64 hex characters
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

**📖 Complete API documentation**: [Advanced Configuration Guide →](./docs/ADVANCED.md)

---

## 📚 Documentation

- **[Advanced Configuration Guide](./docs/ADVANCED.md)** - Complex setups, custom strategies, all config options
- **[Security Analysis](./docs/SECURITY.md)** - Security model deep-dive and best practices
- **[Migration Guide](./docs/MIGRATION.md)** - How to migrate from existing CSRF libraries

---

## 🤝 Contributing

**Community contributions welcome!** This project would benefit from:

**🎯 High-Impact Contributions:**
- **Framework adapters**: Express, Fastify, Koa, SvelteKit, Remix
- **Performance optimizations**: Benchmark improvements, edge cases
- **Security enhancements**: Vulnerability reports, new strategies
- **Developer experience**: Better examples, TypeScript improvements

**🚀 Getting Started:**
1. Fork the repository
2. Create a feature branch: `git checkout -b feature/express-adapter`
3. Make your changes with tests
4. Submit a PR with clear description

**💬 Get Help:**
- 🐛 [Report bugs](https://github.com/muneebs/csrf-armor/issues/new)
- 💡 [Request features](https://github.com/muneebs/csrf-armor/issues/new)
- 💬 [Ask questions](https://github.com/muneebs/csrf-armor/discussions)

---

## 📦 Related Packages

- **[@csrf-armor/nextjs](../nextjs)** - Next.js App Router middleware and React hooks
- **[@csrf-armor/express](../express)** - Express.js middleware adapter

*More framework packages coming based on community demand and contributions!*

---

## 📄 License

MIT © [Muneeb Samuels](https://github.com/muneebs)

**Questions?** Open an issue or start a discussion!
