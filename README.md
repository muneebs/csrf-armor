# next-csrf-protect
[![Checked with Biome](https://img.shields.io/badge/Checked_with-Biome-60a5fa?style=flat&logo=biome)](https://biomejs.dev)
[![CI](https://github.com/muneebs/next-csrf-protect/workflows/CI/badge.svg)](https://github.com/muneebs/next-csrf-protect/actions/workflows/ci.yml)
[![npm version](https://badge.fury.io/js/next-csrf-protect.svg)](https://badge.fury.io/js/next-csrf-protect)
[![npm downloads](https://img.shields.io/npm/dm/next-csrf-protect.svg)](https://npmjs.com/package/next-csrf-protect)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A flexible and secure CSRF protection middleware for Next.js 13+ App Router with multiple protection strategies.

## Features

* 🔒 **Multiple Protection Strategies**: Choose from signed tokens, double-submit cookies, origin checking, or hybrid approach
* 🚀 **Optimized for Next.js App Router**: Built specifically for Next.js 13+ middleware
* 🎯 **TypeScript First**: Full type safety with strict TypeScript
* 🔧 **Highly Configurable**: Customize tokens, cookies, paths, and validation logic
* 🪶 **Lightweight**: Zero dependencies except Next.js
* ✅ **Well Tested**: Comprehensive test coverage with Vitest
* 📦 **ESM Only**: Modern ESM package for better tree-shaking

## Installation

```bash
npm install next-csrf-protect
# or
yarn add next-csrf-protect
# or
pnpm add next-csrf-protect
```

## Quick Start

### 1. Create `middleware.ts` in your project root:

```typescript
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createCsrfProtect } from 'next-csrf-protect';

const csrfProtect = createCsrfProtect({
  secret: process.env.CSRF_SECRET!, // 32+ character secret
});

export async function middleware(request: NextRequest) {
  const response = NextResponse.next();
  const result = await csrfProtect(request, response);

  if (!result.success) {
    return new NextResponse('CSRF validation failed', { status: 403 });
  }

  return result.response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
```

### 2. Use in your components:

```typescript
'use client';

import { useCsrf } from 'next-csrf-protect/client';

export function MyForm() {
  const { token, csrfFetch } = useCsrf();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const response = await csrfFetch('/api/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'John' }),
    });

    if (response.ok) {
      console.log('Success!');
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input type="text" name="name" required />
      <button type="submit">Submit</button>
    </form>
  );
}
```

## Configuration Options

```typescript
createCsrfProtect({
  strategy: 'signed-token',
  secret: process.env.CSRF_SECRET,
  tokenExpiry: 3600,
  cookie: {
    name: 'csrf-token',
    secure: true,
    httpOnly: false,
    sameSite: 'lax',
    path: '/',
    domain: '.example.com',
    maxAge: undefined,
  },
  allowedOrigins: [
    'https://example.com',
    'https://app.example.com',
  ],
  excludePaths: ['/api/webhooks', '/api/health'],
  skipContentTypes: ['multipart/form-data'],
  getTokenFromRequest: (request) => {
    return request.headers.get('x-csrf-token') ||
           request.nextUrl.searchParams.get('_csrf');
  },
});
```

## Protection Strategies

### 1. Signed Token

```typescript
{
  strategy: 'signed-token',
  secret: process.env.CSRF_SECRET!,
  tokenExpiry: 3600,
}
```

* Stateless, self-contained tokens with expiration
* Ideal for serverless/multi-instance apps

### 2. Double Submit Cookie

```typescript
{
  strategy: 'double-submit',
}
```

* Compares submitted token with cookie
* Simpler but cookie-dependent

### 3. Origin Check

```typescript
{
  strategy: 'origin-check',
  allowedOrigins: ['https://yourdomain.com'],
}
```

* Validates Origin/Referer headers
* Good supplemental strategy

### 4. Hybrid

```typescript
{
  strategy: 'hybrid',
}
```

* Combines signed-token + origin-check for extra security

## Client-Side Usage

### React Hook

```typescript
import { useCsrf } from 'next-csrf-protect/client';

function MyComponent() {
  const { token, csrfFetch } = useCsrf();
  // Use csrfFetch like fetch with CSRF token automatically included
}
```

### Manual Token Handling

```typescript
import { getCsrfToken, createCsrfHeaders } from 'next-csrf-protect/client';

const token = getCsrfToken();
const headers = createCsrfHeaders();

fetch('/api/endpoint', {
  method: 'POST',
  headers: {
    ...headers,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(data),
});
```

## Security Best Practices

1. Use HTTPS in production (`cookie.secure: true`)
2. Generate strong secrets (32+ chars)
3. Rotate secrets periodically
4. Validate origin strictly
5. Set short token expiry (e.g., 1 hour)
6. Use session cookies by default

## Cookie vs Token Expiry

```typescript
// Session cookie, 1-hour token
createCsrfProtect({
  tokenExpiry: 3600,
  cookie: { maxAge: undefined },
});

// Persistent cookie
createCsrfProtect({
  tokenExpiry: 3600,
  cookie: { maxAge: 86400 },
});
```

## API Routes

```typescript
export async function POST(request: Request) {
  const data = await request.json();
  return Response.json({ success: true });
}
```

## Error Handling

```typescript
if (!result.success) {
  switch (result.reason) {
    case 'Token expired':
      return new NextResponse('Session expired', { status: 401 });
    case 'Origin not allowed':
      return new NextResponse('Forbidden', { status: 403 });
    default:
      return new NextResponse('Invalid request', { status: 400 });
  }
}
```

## Testing

```bash
npm test
npm run test:coverage
npm run test -- --watch
```

## TypeScript

```typescript
import type { CsrfConfig, CsrfProtectResult } from 'next-csrf-protect';
```

## License

MIT

## Support

* 📚 [Documentation](README.md)
* 🐛 [Issue Tracker](https://github.com/muneebs/next-csrf-protect/issues)

---

## Acknowledgements

This project is inspired by the excellent work done by [@amorey](https://github.com/amorey) on [edge-csrf](https://github.com/amorey/edge-csrf).

I extend my gratitude to [@amorey](https://github.com/amorey) for the foundational work on edge-csrf. Their approach to CSRF protection in edge environments has significantly influenced the development of next-csrf-protect, and I appreciate the insights and solutions provided through their project.
