# @csrf-armor/nextjs

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://cdn.nebz.dev/csrf-armor/logo-large-dark.webp" />
  <img src="https://cdn.nebz.dev/csrf-armor/logo-light.webp" alt="CSRF Armor" width="480" />
</picture>

[![CI](https://github.com/muneebs/csrf-armor/workflows/CI/badge.svg)](https://github.com/muneebs/csrf-armor/actions/workflows/ci.yml)
[![npm version](https://badge.fury.io/js/@csrf-armor%2Fnextjs.svg)](https://badge.fury.io/js/@csrf-armor%2Fnextjs)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Next.js](https://img.shields.io/badge/Next.js-13%2B-black.svg)](https://nextjs.org/)

CSRF protection for Next.js 13+ with middleware, a React provider and a `useCsrf` hook. Works with the App Router, the Pages Router and Server Actions. The middleware uses only Web APIs, so it runs in the Edge Runtime.

## Quick start

### 1. Install

```bash
npm install @csrf-armor/nextjs
```

### 2. Set a secret

```bash
# .env.local — generate with: openssl rand -base64 32
CSRF_SECRET=your-generated-secret
```

### 3. Add the middleware

Create `middleware.ts` in your project root (or in `src/`). On Next.js 16 you can name it `proxy.ts` and export `proxy` instead; the code is the same.

```typescript
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createCsrfMiddleware } from '@csrf-armor/nextjs';

if (process.env.NODE_ENV === 'production' && !process.env.CSRF_SECRET) {
  throw new Error('CSRF_SECRET is required in production');
}

const csrfProtect = createCsrfMiddleware({
  secret: process.env.CSRF_SECRET,
  cookie: { secure: process.env.NODE_ENV === 'production' },
});

export async function middleware(request: NextRequest) {
  const result = await csrfProtect(request, NextResponse.next());

  // The helper only reports the outcome; you must block failures yourself.
  // On failure result.response is still the NextResponse.next() you passed in.
  if (!result.success) {
    console.warn('CSRF validation failed', {
      method: request.method,
      url: request.url,
      reason: result.reason,
    });
    return NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 });
  }

  return result.response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
```

### 4. Add the provider

```tsx
// App Router: app/layout.tsx
import { CsrfProvider } from '@csrf-armor/nextjs/client';

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <CsrfProvider>{children}</CsrfProvider>
      </body>
    </html>
  );
}
```

```tsx
// Pages Router: pages/_app.tsx
import type { AppProps } from 'next/app';
import { CsrfProvider } from '@csrf-armor/nextjs/client';

export default function App({ Component, pageProps }: AppProps) {
  return (
    <CsrfProvider>
      <Component {...pageProps} />
    </CsrfProvider>
  );
}
```

### 5. Send the token

Use `csrfFetch` from the hook; it adds the token header and picks up rotated tokens from responses:

```tsx
'use client'; // App Router only
import { useCsrf } from '@csrf-armor/nextjs/client';

export function ContactForm() {
  const { csrfToken, csrfFetch } = useCsrf();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    await csrfFetch('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: data.get('message') }),
    });
  }

  return (
    <form onSubmit={handleSubmit}>
      <textarea name="message" required />
      <button type="submit" disabled={!csrfToken}>Send</button>
    </form>
  );
}
```

API routes need no extra code: the middleware has already validated the request before your handler runs.

## Server Actions

Include the token as a hidden field. The action must declare its `FormData` parameter, even if unused, because Next.js only sends declared arguments and the token travels in the form data:

```tsx
'use client';
import { useCsrf } from '@csrf-armor/nextjs/client';
import { saveMessage } from './actions';

export function MessageForm() {
  const { csrfToken } = useCsrf();
  return (
    <form action={saveMessage}>
      <input type="hidden" name="csrf_token" value={csrfToken ?? ''} />
      <input name="message" />
      <button type="submit">Save</button>
    </form>
  );
}
```

```typescript
// actions.ts
'use server';

export async function saveMessage(_formData: FormData) {
  // Only runs if the middleware accepted the token
}
```

## Client API

Import from `@csrf-armor/nextjs/client`.

### `<CsrfProvider config?>`

Keeps the token in React state, re-reads it on route changes and back/forward navigation, and updates it from response headers.

| `config` option | Default | Description |
|---|---|---|
| `cookieName` | `'csrf-token'` | Cookie to read the token from. Match `cookie.name` on the server. |
| `headerName` | `'x-csrf-token'` | Header to send the token in. Match `token.headerName` on the server. |
| `initialToken` | none | Token to start with, e.g. rendered by the server. |
| `refreshEndpoint` | current path | URL fetched to obtain a fresh token. |

### `useCsrf()`

Returns `{ csrfToken, csrfFetch, updateToken }`:

- `csrfToken: string | null`: the current token
- `csrfFetch(input, init?)`: `fetch` that sends the token header and stores any new token from the response
- `updateToken()`: re-read the token from the cookie

Throws if used outside `CsrfProvider`.

## Different strategies per route

Create one protector per strategy and choose per request:

```typescript
const apiCsrf = createCsrfMiddleware({ strategy: 'signed-token', secret: process.env.CSRF_SECRET });
const webCsrf = createCsrfMiddleware({ secret: process.env.CSRF_SECRET });

export async function middleware(request: NextRequest) {
  const protect = request.nextUrl.pathname.startsWith('/api/') ? apiCsrf : webCsrf;
  const result = await protect(request, NextResponse.next());
  return result.success
    ? result.response
    : NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 });
}
```

Give each protector a different `cookie.name` if both can apply to the same browser.

## Configuration

`createCsrfMiddleware()` accepts the shared `CsrfConfig`. All options are optional; `secret` is required in production.

- [Configuration reference](https://github.com/muneebs/csrf-armor/blob/main/docs/configuration.md): every option, defaults, exclusions and session binding (`getSessionId` receives the `NextRequest`)
- [Strategies](https://github.com/muneebs/csrf-armor/blob/main/docs/strategies.md)
- [Security guide](https://github.com/muneebs/csrf-armor/blob/main/docs/security.md)

A complete example app, including an attacker page for testing each strategy, lives in [`examples/nextjs-app`](https://github.com/muneebs/csrf-armor/tree/main/examples/nextjs-app).

## License

MIT © [Muneeb Samuels](https://github.com/muneebs)
