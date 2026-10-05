# @csrf-armor/express

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://cdn.nebz.dev/csrf-armor/logo-large-dark.webp" />
  <img src="https://cdn.nebz.dev/csrf-armor/logo-light.webp" alt="CSRF Armor" width="480" />
</picture>

[![CI](https://github.com/muneebs/csrf-armor/workflows/CI/badge.svg)](https://github.com/muneebs/csrf-armor/actions/workflows/ci.yml)
[![npm version](https://badge.fury.io/js/@csrf-armor%2Fexpress.svg)](https://badge.fury.io/js/@csrf-armor%2Fexpress)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Express.js](https://img.shields.io/badge/Express.js-4%20%7C%205-black.svg)](https://expressjs.com)

CSRF protection middleware for Express 4 and 5.

## Install

```bash
npm install @csrf-armor/express cookie-parser
```

`cookie-parser` is required: the middleware reads the CSRF cookie from `req.cookies`. To accept tokens in form or JSON bodies, also install the matching body parser (`express.urlencoded()` / `express.json()`).

## Usage

```typescript
import express from 'express';
import cookieParser from 'cookie-parser';
import { csrfMiddleware } from '@csrf-armor/express';

const app = express();

app.use(cookieParser());
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

app.use(csrfMiddleware({
  secret: process.env.CSRF_SECRET,
  excludePaths: ['/webhooks'],
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
  },
}));

app.post('/api/data', (req, res) => {
  res.json({ success: true }); // only reached with a valid token
});
```

Register the body parsers **before** the middleware so it can read tokens from the body.

### Sending the token to the client

After the middleware runs, the current token is available three ways:

- `req.csrfToken`, for server-rendered pages
- the `X-CSRF-Token` response header
- the readable `csrf-token` cookie, for client-side code

```typescript
app.get('/form', (req, res) => {
  res.send(`
    <form method="POST" action="/api/data">
      <input type="hidden" name="csrf_token" value="${req.csrfToken}">
      <button>Submit</button>
    </form>
  `);
});
```

From JavaScript, send it in a header:

```typescript
await fetch('/api/data', {
  method: 'POST',
  headers: { 'X-CSRF-Token': tokenFromCookie, 'Content-Type': 'application/json' },
  body: JSON.stringify({ message: 'Hello' }),
});
```

### Handling failures

Failed checks are passed to `next()` as a `CsrfError` with code `CSRF_VERIFICATION_ERROR`, so they reach your error handler on both Express 4 and 5:

```typescript
app.use((err, req, res, next) => {
  if (err.code === 'CSRF_VERIFICATION_ERROR') {
    return res.status(403).json({ error: 'Invalid CSRF token' });
  }
  next(err);
});
```

## Configuration

`csrfMiddleware()` accepts the shared `CsrfConfig`. All options are optional; `secret` is required in production.

- [Configuration reference](https://github.com/muneebs/csrf-armor/blob/main/docs/configuration.md): every option, defaults, exclusions and session binding (`getSessionId` receives the Express `req`)
- [Strategies](https://github.com/muneebs/csrf-armor/blob/main/docs/strategies.md)
- [Security guide](https://github.com/muneebs/csrf-armor/blob/main/docs/security.md)
- [Migrating from csurf or lusca](https://github.com/muneebs/csrf-armor/blob/main/docs/migration.md)

## License

MIT © [Muneeb Samuels](https://github.com/muneebs)
