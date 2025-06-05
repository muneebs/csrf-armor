# @csrf-armor/nextjs

<img src="https://cdn.nebz.dev/csrf-armor/logo.jpeg" alt="CSRF Armor" />

[![CI](https://github.com/muneebs/csrf-armor/workflows/CI/badge.svg)](https://github.com/muneebs/csrf-armor/actions/workflows/ci.yml)
[![npm version](https://badge.fury.io/js/@csrf-armor%2Fnextjs.svg)](https://badge.fury.io/js/@csrf-armor%2Fnextjs)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-13%2B-black.svg)](https://nextjs.org/)

**Complete CSRF protection for Next.js applications with App Router and Pages Router support, middleware integration, and React hooks.**

Built for Next.js 12+ with support for both App Router and Pages Router, Edge Runtime compatibility, and modern React patterns.

## Contents

- [Features](#-features)
- [Quick Start](#-quick-start)
- [Routing System Setup](#-routing-system-setup)
- [Context Provider Setup (App Router)](#4-context-provider-setup-app-router)
- [Context Provider Setup (Pages Router)](#4b-context-provider-setup-pages-router)
- [Usage in Components](#5-usage-in-components)
- [API Route Example](#6-api-route-example)
- [Security Best Practices](#-security-best-practices)

## ✨ Features

- 🛡️ **Multiple Security Strategies** - Choose from 5 different CSRF protection methods
- 🔄 **App Router & Pages Router** - Full support for both Next.js routing systems
- 🪝 **React Hooks** - `useCsrf` hook for seamless client-side integration
- ⚡ **Edge Runtime Compatible** - Works in Vercel Edge Runtime and serverless environments
- 🎯 **TypeScript First** - Fully typed with comprehensive TypeScript support
- 📱 **SSR & Client-Side** - Full support for server-side and client-side rendering
- 🔄 **Automatic Token Management** - Smart token refresh and validation

---

## 🚀 Quick Start

The middleware setup works for both App Router and Pages Router. **Provider setup differs:**
- App Router: Use `app/layout.tsx` with `CsrfProvider`.
- Pages Router: Use `_app.tsx` with `CsrfProvider`.

### 1. Installation

```bash
npm install @csrf-armor/nextjs
# or
yarn add @csrf-armor/nextjs
# or
pnpm add @csrf-armor/nextjs
```

### 2. Environment Setup

Add to your `.env.local`:

```bash
# Generate with: openssl rand -base64 32
CSRF_SECRET=your-super-secret-csrf-key-min-32-chars-long
```

> **⚠️ Security Warning**: Never use a default or weak secret in production!

### 3. Create Middleware

Create `middleware.ts` in your project root:

```typescript
import {NextResponse} from 'next/server';
import type {NextRequest} from 'next/server';
import {createCsrfMiddleware} from '@csrf-armor/nextjs';

// Validate secret in production
if (process.env.NODE_ENV === 'production' && !process.env.CSRF_SECRET) {
    throw new Error('CSRF_SECRET environment variable is required in production');
}

const csrfProtect = createCsrfMiddleware({
    strategy: 'signed-double-submit',
    secret: process.env.CSRF_SECRET!,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax' // Use 'strict' for higher security if cross-origin not needed
    }
});

export async function middleware(request: NextRequest) {
    const response = NextResponse.next();
    const result = await csrfProtect(request, response);

    if (!result.success) {
        // Security logging
        console.warn('CSRF validation failed:', {
            url: request.url,
            method: request.method,
            reason: result.reason,
            ip: request.ip || 'unknown',
            userAgent: request.headers.get('user-agent') || 'unknown',
        });

        return NextResponse.json(
            {error: 'CSRF validation failed'},
            {status: 403}
        );
    }

    return result.response;
}
```

### 4. Context Provider Setup (App Router)

Wrap your app with the CSRF provider in `app/layout.tsx` (Next.js 13+ App Router):

```typescript jsx
// app/layout.tsx
import {CsrfProvider} from '@csrf-armor/nextjs';
import type {Metadata} from 'next';

export const metadata: Metadata = {
    title: 'Your App',
    description: 'Your app description',
};

export default function RootLayout({children}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en">
        <body>
        <CsrfProvider>{children}</CsrfProvider>
        </body>
        </html>
    );
}
```

### 4b. Context Provider Setup (Pages Router)

Wrap your app in `_app.tsx` (Next.js 12+ Pages Router):

```typescript jsx
// pages/_app.tsx
import {CsrfProvider} from '@csrf-armor/nextjs';

export default function MyApp({Component, pageProps}) {
    return (
        <CsrfProvider>
            <Component {...pageProps} />
        </CsrfProvider>
    );
}
```

### 5. Usage in Components

```typescript jsx
'use client';
import {useCsrf} from '@csrf-armor/nextjs/client';
import {useState} from 'react';

export function ContactForm() {
    const {csrfToken, csrfFetch} = useCsrf();
    const [message, setMessage] = useState('');

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        const formData = new FormData(e.currentTarget);
        const response = await csrfFetch('/api/contact', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                name: formData.get('name'),
                email: formData.get('email'),
                message: formData.get('message'),
            }),
        });
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div>
                <textarea
                    name="message"
                    placeholder="Your Message"
                    required
                    rows={4}
                    className="w-full p-2 border rounded"
                />
            </div>
            <button
                type="submit"
                disabled={!csrfToken}
                className="bg-blue-500 text-white px-4 py-2 rounded disabled:opacity-50">
                {isSubmitting ? 'Sending...' : 'Send Message'}
            </button>
        </form>
    );
}
```

### 6. API Route Example

```typescript
// app/api/your-route
import {NextRequest, NextResponse} from 'next/server';

export async function POST(request: NextRequest) {
    // CSRF validation happens automatically in middleware
}
```

---

## 🔄 Routing System Setup

CSRF Armor supports both Next.js routing systems using the same root `middleware.ts` file. See [Quick Start](#quick-start).

### Universal Middleware (Both App Router & Pages Router)

```typescript
// middleware.ts (project root) - works for both routing systems
import {NextResponse} from 'next/server';
import type {NextRequest} from 'next/server';
import {createCsrfMiddleware} from '@csrf-armor/nextjs';

const csrfProtect = createCsrfMiddleware({
    strategy: 'signed-double-submit',
    secret: process.env.CSRF_SECRET!,
});

export async function middleware(request: NextRequest) {
    const response = NextResponse.next();
    const result = await csrfProtect(request, response);

    if (!result.success) {
        return NextResponse.json(
            {error: 'CSRF validation failed'},
            {status: 403}
        );
    }

    return result.response;
}

export const config = {
    matcher: [
        // Protect all routes except static files
        '/((?!_next/static|_next/image|favicon.ico).*)',
    ],
};
```

### App Router Provider Setup

```typescript jsx
// app/layout.tsx
import {CsrfProvider} from '@csrf-armor/nextjs';

export default function RootLayout({children}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en">
        <body>
        <CsrfProvider>{children}</CsrfProvider>
        </body>
        </html>
    );
}
```

### Pages Router Provider Setup

```typescript jsx
// pages/_app.tsx
import type {AppProps} from 'next/app';
import {CsrfProvider} from '@csrf-armor/nextjs';

export default function App({Component, pageProps}: AppProps) {
    return (
        <CsrfProvider>
            <Component {...pageProps} />
        </CsrfProvider>
    );
}
```

### Using Hooks in Both Routing Systems

The React hooks work identically in both App Router and Pages Router:

```typescript jsx
'use client'; // Only needed in App Router

import {useCsrf} from '@csrf-armor/nextjs/client';

export function ContactForm() {
    const {csrfToken, csrfFetch} = useCsrf();

    const handleSubmit = async (e: React.FormEvent) => {
        //...
        try {
            const response = await csrfFetch('/api/contact', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({message: 'Hello'}),
            });

            if (response.ok) {
                console.log('Success!');
            }
        } catch (error) {
            console.error('Error:', error);
        }
    };

    return (
        <form onSubmit={handleSubmit}>
            <input name="message" placeholder="Your message" />
            <button type="submit">Send</button>
        </form>
    );
}
```

---

## 🛡️ Security Strategies

Choose the strategy that best fits your security and performance requirements:

| Strategy                   | Security | Performance | Best For         | Setup Complexity |
|----------------------------|----------|-------------|------------------|------------------|
| **Signed Double Submit** ⭐ | ⭐⭐⭐⭐⭐    | ⭐⭐⭐⭐        | Most web apps    | Medium           |
| **Double Submit**          | ⭐      | ⭐⭐⭐⭐⭐       | Local development      | Easy             |
| **Signed Token**           | ⭐⭐⭐⭐     | ⭐⭐⭐⭐        | APIs, SPAs       | Medium           |
| **Origin Check**           | ⭐⭐⭐      | ⭐⭐⭐⭐⭐       | Known origins    | Easy             |
| **Hybrid**                 | ⭐⭐⭐⭐⭐    | ⭐⭐⭐         | Maximum security | Hard             |

### Signed Double Submit (Recommended)

```typescript
const csrfProtect = createCsrfMiddleware({
    strategy: 'signed-double-submit',
    secret: process.env.CSRF_SECRET!,
});
```

**How it works:**

- Client receives unsigned token in response header and accessible cookie
- Server stores signed token in httpOnly cookie
- Client submits unsigned token, server verifies against signed cookie
- Combines cryptographic protection with double-submit pattern

**Best for:** E-commerce, financial services, general web applications

### Double Submit Cookie

```typescript
const csrfProtect = createCsrfMiddleware({
    strategy: 'double-submit',
});
```

**How it works:**

- Same token stored in cookie and sent in header/form
- Relies on Same-Origin Policy for protection

**Best for:** Local development (Not recommended for production)

### Signed Token

```typescript
const csrfProtect = createCsrfMiddleware({
    strategy: 'signed-token',
    secret: process.env.CSRF_SECRET!,
    token: {expiry: 3600}, // 1 hour
});
```

**How it works:**

- HMAC-signed tokens with expiration timestamps
- Stateless validation using cryptographic signatures

**Best for:** APIs, SPAs, microservices

### Origin Check

```typescript
const csrfProtect = createCsrfMiddleware({
    strategy: 'origin-check',
    allowedOrigins: [
        'https://yourdomain.com',
        'https://www.yourdomain.com',
    ],
});
```

**How it works:**

- Validates Origin/Referer headers against whitelist
- Lightweight validation with minimal overhead

**Best for:** Mobile app backends, known client origins

### Hybrid Protection

```typescript
const csrfProtect = createCsrfMiddleware({
    strategy: 'hybrid',
    secret: process.env.CSRF_SECRET!,
    allowedOrigins: ['https://yourdomain.com'],
});
```

**How it works:**

- Combines signed token validation with origin checking
- Multiple layers of protection for maximum security

**Best for:** Banking, healthcare, enterprise applications

---

## ⚙️ Configuration

### Complete Configuration Reference

```typescript
interface CsrfConfig {
    strategy?: 'double-submit' | 'signed-double-submit' | 'signed-token' | 'origin-check' | 'hybrid';
    secret?: string;                    // Required for signed strategies

    token?: {
        expiry?: number;                  // Token expiry in seconds (default: 3600)
        headerName?: string;              // Header name (default: 'x-csrf-token')
        fieldName?: string;               // Form field name (default: 'csrf_token')
    };

    cookie?: {
        name?: string;                    // Cookie name (default: 'csrf-token')
        secure?: boolean;                 // Secure flag (default: true in production)
        httpOnly?: boolean;               // HttpOnly flag (default: false)
        sameSite?: 'strict' | 'lax' | 'none'; // SameSite (default: 'lax')
        path?: string;                    // Path (default: '/')
        domain?: string;                  // Domain (optional)
        maxAge?: number;                  // Max age in seconds (optional)
    };

    allowedOrigins?: string[];          // Allowed origins for origin-check
    excludePaths?: string[];            // Paths to exclude from protection
    skipContentTypes?: string[];        // Content types to skip
}
```

### Environment-Specific Configuration

```typescript
// Development configuration
const developmentConfig = {
    strategy: 'double-submit' as const,
    cookie: {
        secure: false,      // Allow HTTP in development
        sameSite: 'lax' as const
    }
};

// Production configuration
const productionConfig = {
    strategy: 'signed-double-submit' as const,
    secret: process.env.CSRF_SECRET!,
    cookie: {
        secure: true,       // HTTPS only
        sameSite: 'strict' as const,
        domain: '.yourdomain.com'
    }
};

const csrfProtect = createCsrfMiddleware(
    process.env.NODE_ENV === 'production'
        ? productionConfig
        : developmentConfig
);
```

### Path Exclusions

```typescript
const csrfProtect = createCsrfMiddleware({
    strategy: 'signed-double-submit',
    secret: process.env.CSRF_SECRET!,
    excludePaths: [
        '/api/webhooks',     // External webhooks
        '/api/public',       // Public API endpoints
        '/health',           // Health checks
        '/api/auth/callback' // Auth callbacks
    ],
});
```

---

## 🪝 React Hooks API

### CsrfProvider

The context provider that manages CSRF state across your application.

```typescript
interface CsrfProviderProps {
    children: React.ReactNode;
    config?: CsrfClientConfig;
}

interface CsrfClientConfig {
    cookieName?: string;    // Cookie name to read token from (default: 'csrf-token')
    headerName?: string;    // Header name to send token in (default: 'x-csrf-token')
    autoRefresh?: boolean;  // Auto-refresh on focus/visibility (default: true)
}
```

**Features:**

- ✅ Event-driven updates (no polling)
- ✅ Automatic token refresh from response headers
- ✅ Shared state across components
- ✅ Performance optimized with React.memo

**Usage:**

```typescript jsx
<CsrfProvider config={{
    cookieName: 'my-csrf',
    headerName: 'X-My-CSRF',
    autoRefresh: true
}}>
    <App/>
</CsrfProvider>
```

### useCsrf Hook

Main hook for accessing CSRF functionality.

```typescript
const {csrfToken, csrfFetch, updateToken} = useCsrf();
```

**Returns:**

- `csrfToken: string | null` - Current CSRF token
- `csrfFetch: (input, init?) => Promise<Response>` - Fetch with automatic CSRF headers
- `updateToken: () => void` - Manually refresh token

---

## 🔒 Security Best Practices

### 1. Strong Secret Management

```bash
# Generate a strong secret
openssl rand -base64 32

# Or using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

```typescript
// Validate secret at startup
if (process.env.NODE_ENV === 'production') {
    const secret = process.env.CSRF_SECRET;
    if (!secret || secret.length < 32) {
        throw new Error('CSRF_SECRET must be at least 32 characters in production');
    }
}
```

### 2. Cookie Security Configuration

```typescript
const csrfProtect = createCsrfMiddleware({
    strategy: 'signed-double-submit',
    secret: process.env.CSRF_SECRET!,
    cookie: {
        secure: process.env.NODE_ENV === 'production', // HTTPS only in production
        sameSite: 'strict',    // Strictest protection
        httpOnly: false,       // Required for client access
        path: '/',
        maxAge: 60 * 60 * 24,  // 24 hours
        // For subdomains:
        // domain: '.yourdomain.com'
    },
});
```

### 3. Security Headers

```typescript
// middleware.ts
export async function middleware(request: NextRequest) {
    const response = NextResponse.next();
    const result = await csrfProtect(request, response);

    if (result.success) {
        // Add security headers
        result.response.headers.set('X-Content-Type-Options', 'nosniff');
        result.response.headers.set('X-Frame-Options', 'DENY');
        result.response.headers.set('X-XSS-Protection', '1; mode=block');
        result.response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    }

    return result.response;
}
```

---

## 🔧 Advanced Usage

### Multiple CSRF Strategies

```typescript
// middleware.ts
import {createCsrfMiddleware} from '@csrf-armor/nextjs';

const apiCsrf = createCsrfMiddleware({
    strategy: 'signed-token',
    secret: process.env.CSRF_SECRET!,
    token: {expiry: 3600}
});

const webCsrf = createCsrfMiddleware({
    strategy: 'signed-double-submit',
    secret: process.env.CSRF_SECRET!,
});

export async function middleware(request: NextRequest) {
    const response = NextResponse.next();
    const {pathname} = request.nextUrl;

    let result;
    if (pathname.startsWith('/api/')) {
        result = await apiCsrf(request, response);
    } else {
        result = await webCsrf(request, response);
    }

    return result.success ? result.response :
        NextResponse.json({error: 'Forbidden'}, {status: 403});
}
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

MIT © [Muneeb Samuels](https://github.com/muneebs)

## 📦 Related Packages

- **[@csrf-armor/core](../core)** - Framework-agnostic CSRF protection

---

**Questions?** [Open an issue](https://github.com/muneebs/csrf-armor/issues)
or [start a discussion](https://github.com/muneebs/csrf-armor/discussions)!
