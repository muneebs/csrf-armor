# @csrf-armor/nuxt

<img src="https://cdn.nebz.dev/csrf-armor/logo.jpeg" alt="CSRF Armor" />

[![CI](https://github.com/muneebs/csrf-armor/workflows/CI/badge.svg)](https://github.com/muneebs/csrf-armor/actions/workflows/ci.yml)
[![npm version](https://badge.fury.io/js/@csrf-armor%2Fnuxt.svg)](https://badge.fury.io/js/@csrf-armor%2Fnuxt)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)
[![Nuxt](https://img.shields.io/badge/Nuxt-3%2B%20%7C%204%2B-00DC82.svg)](https://nuxt.com/)

**Complete CSRF protection for Nuxt 3/4 applications with automatic server middleware, Vue composables, and SSR-safe token management.**

## Contents

- [Features](#-features)
- [Quick Start](#-quick-start)
- [Configuration](#-configuration)
- [Composables](#-composables)
- [Security Strategies](#-security-strategies)
- [Security Best Practices](#-security-best-practices)

## ✨ Features

- 🛡️ **Multiple Security Strategies** - Choose from 5 different CSRF protection methods
- 🔄 **Auto-registered Middleware** - Server middleware applied automatically to all routes
- 🪝 **Vue Composables** - `useCsrfToken` and `useCsrfFetch` auto-imported in your components
- 🎯 **TypeScript First** - Fully typed with comprehensive TypeScript support
- 📱 **SSR-Safe** - Uses Nuxt's `useState` for request-isolated server-side state
- ⚡ **Zero Runtime Dependencies** - Uses H3Event native API with no extra runtime packages

---

## 🚀 Quick Start

### 1. Installation

```bash
npm install @csrf-armor/nuxt
# or
yarn add @csrf-armor/nuxt
# or
pnpm add @csrf-armor/nuxt
```

### 2. Register the Module

Add `@csrf-armor/nuxt` to your `nuxt.config.ts`:

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  modules: ['@csrf-armor/nuxt'],

  csrfArmor: {
    strategy: 'signed-double-submit',
    secret: process.env.CSRF_SECRET,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
    },
  },
});
```

### 3. Environment Setup

Add to your `.env`:

```bash
# Generate with: openssl rand -base64 32
CSRF_SECRET=your-super-secret-csrf-key-min-32-chars-long
```

> **⚠️ Security Warning**: Never use a default or weak secret in production!

That's it. The module automatically registers a Nitro server middleware that enforces CSRF protection on all mutating requests (POST, PUT, PATCH, DELETE).

### 4. Use in Components

`useCsrfToken` and `useCsrfFetch` are auto-imported — no explicit import needed:

```vue
<script setup lang="ts">
const { csrfToken, csrfFetch } = useCsrfToken();

async function handleSubmit(data: Record<string, unknown>) {
  const response = await csrfFetch('/api/contact', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}
</script>

<template>
  <form @submit.prevent="handleSubmit({ message: 'Hello' })">
    <input name="message" placeholder="Your message" />
    <button type="submit" :disabled="!csrfToken">Send</button>
  </form>
</template>
```

### 5. Using with useFetch

For data fetching with Nuxt's `useFetch`, use `useCsrfFetch` instead:

```vue
<script setup lang="ts">
const { data, pending } = await useCsrfFetch('/api/items', {
  method: 'POST',
  body: { name: 'New Item' },
});
</script>
```

---

## ⚙️ Configuration

Configuration is set via `csrfArmor` in `nuxt.config.ts`. All options from `@csrf-armor/core` are supported.

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  modules: ['@csrf-armor/nuxt'],

  csrfArmor: {
    strategy: 'signed-double-submit', // CSRF strategy
    secret: process.env.CSRF_SECRET,  // Required for signed strategies

    token: {
      expiry: 3600,                   // Token lifetime in seconds (default: 3600)
      headerName: 'x-csrf-token',     // Header to read/send token (default: 'x-csrf-token')
      fieldName: 'csrf_token',        // Form field name (default: 'csrf_token')
    },

    cookie: {
      name: 'csrf-token',             // Cookie name (default: 'csrf-token')
      secure: true,                   // HTTPS only (default: true in production)
      httpOnly: false,                // Allow client access (default: false)
      sameSite: 'lax',               // SameSite policy (default: 'lax')
      path: '/',                      // Cookie path (default: '/')
      maxAge: 86400,                  // Max age in seconds (optional)
    },

    excludePaths: ['/api/webhooks'],  // Paths excluded from CSRF protection
    allowedOrigins: ['https://yourdomain.com'], // For origin-check strategy
  },
});
```

### Environment-Specific Configuration

```typescript
// nuxt.config.ts
const isDev = process.env.NODE_ENV !== 'production';

export default defineNuxtConfig({
  modules: ['@csrf-armor/nuxt'],

  csrfArmor: {
    strategy: isDev ? 'double-submit' : 'signed-double-submit',
    secret: process.env.CSRF_SECRET,
    cookie: {
      secure: !isDev,
      sameSite: 'lax',
    },
  },
});
```

### Accessing the Token Server-Side

The middleware stores the issued token on `event.context.csrfToken` for use in server routes:

```typescript
// server/api/example.post.ts
export default defineEventHandler((event) => {
  const csrfToken = event.context.csrfToken;
  // token available if needed
  return { success: true };
});
```

### Excluding Paths

```typescript
csrfArmor: {
  excludePaths: [
    '/api/webhooks/stripe', // External webhooks
    '/api/public',          // Public API endpoints
    '/health',              // Health checks
  ],
},
```

---

## 🪝 Composables

Both composables are automatically imported by the module — no import statement needed.

### `useCsrfToken()`

Reactive CSRF token management using Nuxt's `useState` for SSR-safe, request-isolated state.

```typescript
const { csrfToken, updateToken, csrfFetch } = useCsrfToken();
```

**Returns:**

- `csrfToken: Ref<string | null>` — Reactive CSRF token, shared across all components in the same request/session
- `updateToken: () => void` — Manually re-reads the token from cookies
- `csrfFetch: (input, init?) => Promise<Response>` — Native `fetch` wrapper that automatically attaches the CSRF header and updates the token from response headers

Route changes and browser history navigation are observed automatically to keep the token fresh.

### `useCsrfFetch<T>(url, opts?)`

A wrapper around Nuxt's `useFetch` that automatically injects the CSRF header on every request.

```typescript
const { data, pending, error } = await useCsrfFetch<MyType>('/api/items', {
  method: 'POST',
  body: { name: 'New Item' },
});
```

Existing `onRequest` interceptors in `opts` are preserved and chained correctly.

---

## 🛡️ Security Strategies

| Strategy                   | Security  | Performance | Best For              |
|----------------------------|-----------|-------------|-----------------------|
| **Signed Double Submit** ⭐ | ⭐⭐⭐⭐⭐   | ⭐⭐⭐⭐       | Most web apps         |
| **Double Submit**          | ⭐         | ⭐⭐⭐⭐⭐      | Local development     |
| **Signed Token**           | ⭐⭐⭐⭐     | ⭐⭐⭐⭐       | APIs, SPAs            |
| **Origin Check**           | ⭐⭐⭐      | ⭐⭐⭐⭐⭐      | Known origins         |
| **Hybrid**                 | ⭐⭐⭐⭐⭐   | ⭐⭐⭐        | Maximum security      |

### Signed Double Submit (Recommended)

```typescript
csrfArmor: {
  strategy: 'signed-double-submit',
  secret: process.env.CSRF_SECRET,
}
```

Client receives an unsigned token in the response header and a readable cookie. The server stores a signed copy in an httpOnly cookie and verifies submissions against it. Combines cryptographic protection with the double-submit pattern.

### Double Submit Cookie

```typescript
csrfArmor: {
  strategy: 'double-submit',
}
```

Same token stored in cookie and sent in header. Relies on Same-Origin Policy. Suitable for local development only.

### Signed Token

```typescript
csrfArmor: {
  strategy: 'signed-token',
  secret: process.env.CSRF_SECRET,
  token: { expiry: 3600 },
}
```

HMAC-signed tokens with expiration timestamps. Stateless validation. Best for APIs and SPAs.

### Origin Check

```typescript
csrfArmor: {
  strategy: 'origin-check',
  allowedOrigins: [
    'https://yourdomain.com',
    'https://www.yourdomain.com',
  ],
}
```

Validates `Origin`/`Referer` headers against an allowlist. Lightweight with minimal overhead.

### Hybrid

```typescript
csrfArmor: {
  strategy: 'hybrid',
  secret: process.env.CSRF_SECRET,
  allowedOrigins: ['https://yourdomain.com'],
}
```

Combines signed token validation with origin checking for maximum security depth.

---

## 🔒 Security Best Practices

### Strong Secret Management

```bash
# Generate a strong secret
openssl rand -base64 32

# Or using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  modules: ['@csrf-armor/nuxt'],

  csrfArmor: {
    strategy: 'signed-double-submit',
    secret: process.env.CSRF_SECRET, // Never hardcode secrets
  },
});
```

### Cookie Security

```typescript
csrfArmor: {
  cookie: {
    secure: process.env.NODE_ENV === 'production', // HTTPS only in production
    sameSite: 'strict', // Strictest protection if cross-origin not needed
    httpOnly: false,    // Must be false so the client plugin can read it
    path: '/',
    maxAge: 60 * 60 * 24, // 24 hours
  },
},
```

---

## 🤝 Contributing

We welcome contributions! Areas where help is needed:

- **Additional framework integrations**
- **Performance optimizations**
- **Security enhancements**
- **Documentation improvements**
- **Test coverage expansion**

---

## 📄 License

MIT © [Jordan Labrosse](https://github.com/Jorgagu)

## 📦 Related Packages

- **[@csrf-armor/core](../core)** - Framework-agnostic CSRF protection
- **[@csrf-armor/nextjs](../nextjs)** - Next.js adapter

---

**Questions?** [Open an issue](https://github.com/muneebs/csrf-armor/issues)
or [start a discussion](https://github.com/muneebs/csrf-armor/discussions)!
