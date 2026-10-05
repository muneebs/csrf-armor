# API reference: `@csrf-armor/core`

Everything below is exported from `@csrf-armor/core`. Most applications only need an adapter package; this reference is for writing adapters and for the low-level token helpers. Configuration options are documented in [Configuration](./configuration.md).

## Protection

### `createCsrfProtection(adapter, config?)`

```typescript
function createCsrfProtection<TRequest, TResponse>(
  adapter: CsrfAdapter<TRequest, TResponse>,
  config?: CsrfConfig
): CsrfProtection<TRequest, TResponse>;
```

Equivalent to `new CsrfProtection(adapter, config)`. Missing options are filled from `DEFAULT_CONFIG`.

### `CsrfProtection#protect(request, response)`

```typescript
protect(request: TRequest, response: TResponse): Promise<{
  success: boolean;
  response: TResponse;   // with token cookies and headers applied by the adapter
  token?: string;        // the current token, when one was issued or reused
  reason?: string;       // why validation failed
}>;
```

- Safe methods (`GET`, `HEAD`, `OPTIONS`) always succeed and issue or reuse a token.
- Unsafe methods are validated with the configured strategy.
- Requests matched by `excludePaths` or `skipContentTypes` succeed with the original `response` and no token.
- `protect()` never sends a response. The caller decides what to do when `success` is `false`.

Every response that carries a token sets:

| Header / cookie | Value |
|---|---|
| `x-csrf-token` header | The token the client should submit |
| `x-csrf-strategy` header | The configured strategy |
| `<cookie.name>` cookie | The client-readable token |
| `<cookie.name>-server` cookie | `signed-double-submit` only: the signed copy, always `httpOnly` |

## Adapter types

See [Writing an adapter](./custom-adapters.md) for a full example.

```typescript
interface CsrfAdapter<TRequest = unknown, TResponse = unknown> {
  extractRequest(req: TRequest): CsrfRequest;
  applyResponse(res: TResponse, csrfResponse: CsrfResponse): TResponse;
  getTokenFromRequest(req: CsrfRequest, config: RequiredCsrfConfig): Promise<string | undefined>;
}

interface CsrfRequest {
  method: string;
  url: string; // absolute or relative
  headers: Map<string, string> | Record<string, string> | Headers;
  cookies: Map<string, string> | Record<string, string>;
  body?: unknown;
}

interface CsrfResponse {
  headers: Map<string, string> | Record<string, string>;
  cookies:
    | Map<string, { value: string; options?: CookieOptions }>
    | Record<string, { value: string; options?: CookieOptions }>;
}
```

`RequiredCsrfConfig` is `CsrfConfig` with every option resolved (`token.reissueThreshold` included), as passed to `getTokenFromRequest`.

## Configuration types

| Type | Shape |
|---|---|
| `CsrfConfig` | All options, all optional. See [Configuration](./configuration.md). |
| `CsrfStrategy` | `'double-submit' \| 'signed-double-submit' \| 'signed-token' \| 'origin-check' \| 'hybrid'` |
| `TokenOptions` | `{ expiry?, reissueThreshold?, headerName?, fieldName? }` |
| `CookieOptions` | `{ name?, secure?, httpOnly?, sameSite?, path?, domain?, maxAge? }` (`maxAge` in seconds) |
| `SessionIdResolver` | `(request: CsrfRequest, frameworkRequest: unknown) => string \| undefined \| Promise<string \| undefined>` |
| `CsrfProtectResult` | `{ success, token?, reason? }`. Note: no `response`; `protect()` returns its own wider type shown above. |

## Token helpers

These handle cryptography only. They don't bind tokens to cookies; use `protect()` for request protection. Every helper takes an optional `context` string that is mixed into the HMAC, which is how session binding works: a token signed with one context only verifies with the same context.

| Function | Returns | Notes |
|---|---|---|
| `generateSignedToken(secret, expirySeconds, context?)` | `Promise<string>` | Format `{expiry}.{nonce}.{signature}`; expiry is a Unix timestamp in seconds, the signature is HMAC-SHA256 in hex |
| `parseSignedToken(token, secret, context?)` | `Promise<{ exp: number; nonce: string }>` | Throws `TokenInvalidError` on a bad format or signature, `TokenExpiredError` once `exp` has passed |
| `signNonceWithExpiry(nonce, secret, expirySeconds, context?)` | `Promise<string>` | Like `generateSignedToken` with your own nonce (which must not contain `.`) |
| `signUnsignedToken(token, secret, context?)` | `Promise<string>` | `{token}.{signature}`, no expiry |
| `verifySignedToken(signedToken, secret, context?)` | `Promise<string>` | Returns the original token; throws `TokenInvalidError` |
| `generateNonce(length = 16)` | `string` | `length` random bytes as hex, so `2 × length` characters |
| `timingSafeEqual(a, b)` | `boolean` | Constant-time string comparison |

```typescript
import { generateSignedToken, parseSignedToken, TokenExpiredError } from '@csrf-armor/core';

const token = await generateSignedToken(process.env.CSRF_SECRET, 3600);

try {
  const { exp, nonce } = await parseSignedToken(token, process.env.CSRF_SECRET);
} catch (error) {
  if (error instanceof TokenExpiredError) {
    // issue a new token
  }
}
```

## Validation functions

`protect()` calls these for you. They're exported for adapters that need to validate outside the normal flow; each returns `{ isValid: boolean; reason?: string }`.

```typescript
validateRequest(request, config, getTokenFromRequest, sessionContext?)   // dispatches on config.strategy
validateSignedDoubleSubmit(request, config, getTokenFromRequest, sessionContext?)
validateSignedToken(request, config, getTokenFromRequest, sessionContext?)
validateDoubleSubmit(request, config, getTokenFromRequest)
validateOrigin(request, config)
```

## Errors

All errors extend `CsrfError`, which has a machine-readable `code` and an HTTP `statusCode`.

| Class | Constructor | `code` | `statusCode` |
|---|---|---|---|
| `CsrfError` | `(message, code, statusCode = 403)` | as given | as given |
| `TokenExpiredError` | `()` | `TOKEN_EXPIRED` | 403 |
| `TokenInvalidError` | `(reason = 'Invalid token format')` | `TOKEN_INVALID` | 403 |
| `OriginMismatchError` | `(origin)` | `ORIGIN_MISMATCH` | 403 |

`protect()` doesn't throw these for failed validation; it returns `success: false` with a `reason`. The Express adapter turns failures into a `CsrfError` with code `CSRF_VERIFICATION_ERROR`.

## Constants

| Constant | Value |
|---|---|
| `SAFE_METHODS` | `['GET', 'HEAD', 'OPTIONS']` |
| `DEFAULT_CONFIG` | The defaults listed in [Configuration](./configuration.md#reference). Its `secret` is generated randomly when the module loads, so always set your own. |

## Runtime requirements

The core uses the global Web Crypto API (`crypto.subtle`, `crypto.getRandomValues`), `TextEncoder` and `btoa`. These are available without flags on Node.js 19+, Deno, Bun, browsers and edge runtimes such as Vercel Edge and Cloudflare Workers.
