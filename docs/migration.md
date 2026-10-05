# Migrating from other CSRF libraries

## Before you start

- Note your current token header name, form field name and cookie name. You can keep them with `token.headerName`, `token.fieldName` and `cookie.name`, so existing frontend code keeps working.
- Find every place your frontend reads or sends the token.
- Pick a strategy. `signed-double-submit` (the default) suits most apps; see [Strategies](./strategies.md).
- Set `CSRF_SECRET` in every environment. See [Secrets](./configuration.md#secrets).

Tokens from your old library won't validate, so users with a page open during the deploy may need to reload once.

## From csurf (Express)

`csurf` is deprecated. Replace it with [`@csrf-armor/express`](../packages/express/README.md).

```typescript
// Before
import csrf from 'csurf';
app.use(cookieParser());
app.use(csrf({ cookie: true }));
app.get('/form', (req, res) => res.render('form', { csrfToken: req.csrfToken() }));
```

```typescript
// After
import cookieParser from 'cookie-parser';
import { csrfMiddleware } from '@csrf-armor/express';

app.use(cookieParser());
app.use(express.urlencoded({ extended: false }));
app.use(csrfMiddleware({
  secret: process.env.CSRF_SECRET,
  token: { fieldName: '_csrf' }, // keep csurf's field name
}));
app.get('/form', (req, res) => res.render('form', { csrfToken: req.csrfToken }));
```

| csurf | CSRF Armor |
|---|---|
| `req.csrfToken()` | `req.csrfToken` (a property, not a function) |
| `_csrf` body field | `token.fieldName` (default `csrf_token`) |
| `csrf-token` / `xsrf-token` / `x-csrf-token` headers | `token.headerName` (default `X-CSRF-Token`) |
| `cookie: true` | Always cookie-based; configure with `cookie` |
| `ignoreMethods` | `GET`, `HEAD` and `OPTIONS` are always treated as safe |
| `EBADCSRFTOKEN` error code | `CSRF_VERIFICATION_ERROR` |

## From lusca (Express)

Use `@csrf-armor/express` for CSRF and [helmet](https://helmetjs.github.io/) for lusca's other headers.

| lusca `csrf` option | CSRF Armor |
|---|---|
| `key: '_csrf'` | `token: { fieldName: '_csrf' }` |
| `header: 'x-csrf-token'` | `token: { headerName: 'x-csrf-token' }` |
| `secret` | `secret: process.env.CSRF_SECRET` |
| `impl` | `strategy` |

## From next-csrf (Next.js)

Use [`@csrf-armor/nextjs`](../packages/nextjs/README.md). Protection moves from individual API routes into `middleware.ts`, so routes no longer call a wrapper; follow the README's quick start, then remove the `next-csrf` calls from your handlers.

## From the `csrf` package

The `csrf` package only creates and verifies tokens. If that's all you need, the core helpers do the same with an expiry built in:

```typescript
import { generateSignedToken, parseSignedToken } from '@csrf-armor/core';

const token = await generateSignedToken(process.env.CSRF_SECRET, 3600);
await parseSignedToken(token, process.env.CSRF_SECRET); // throws if invalid or expired
```

For request protection, use an adapter package instead.

## From @fastify/csrf-protection, koa-csrf or a custom implementation

There's no official adapter for these frameworks yet. Write a small one following [Writing an adapter](./custom-adapters.md); the Fastify example there is a drop-in starting point.

## Checklist

- [ ] `CSRF_SECRET` set in every environment
- [ ] Frontend sends the token from the cookie or `X-CSRF-Token` response header
- [ ] Webhooks and other server-to-server endpoints in `excludePaths`
- [ ] Failed checks return 403 and are logged
- [ ] Old CSRF library and its cookies removed
