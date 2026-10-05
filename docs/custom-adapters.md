# Writing an adapter

The official packages cover Express, Next.js and Nuxt. For any other framework, implement the `CsrfAdapter` interface from `@csrf-armor/core` and hand it to `createCsrfProtection`. The core does everything else: strategies, token generation and rotation, exclusions and session binding.

```bash
npm install @csrf-armor/core
```

## The interface

```typescript
interface CsrfAdapter<TRequest, TResponse> {
  // Turn the framework request into the normalized shape the core expects.
  extractRequest(req: TRequest): CsrfRequest;

  // Write the headers and cookies the core produced onto the framework response.
  applyResponse(res: TResponse, csrfResponse: CsrfResponse): TResponse;

  // Find the token the client submitted.
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

Rules that matter for security:

- **Header names must be lowercase** in a `Map` or plain object. A Web `Headers` object handles this for you.
- **Never read the submitted token from a cookie.** The token must come from the header, query string or body; reading it from the CSRF cookie would make every request pass.
- Read the token in this order: `config.token.headerName` header, then `config.token.fieldName` query parameter, then the same field in the body.
- `cookie.maxAge` is in **seconds**. Convert it if your framework expects milliseconds (Express does).

## Using it

```typescript
import { createCsrfProtection } from '@csrf-armor/core';

const csrf = createCsrfProtection(new MyAdapter(), {
  secret: process.env.CSRF_SECRET,
});

const result = await csrf.protect(request, response);
// result: { success: boolean; response: TResponse; token?: string; reason?: string }

if (!result.success) {
  // Reject with 403. result.response still carries a rotated cookie and token header.
}
```

`protect()` never sends a response itself; your middleware decides what to do with the result. The second argument to `getSessionId` (see [Session binding](./configuration.md#session-binding)) is the original framework request you passed to `protect()`.

## Example: Fastify

Requires [`@fastify/cookie`](https://github.com/fastify/fastify-cookie) and a body parser for the content types you accept.

```typescript
import type { FastifyReply, FastifyRequest } from 'fastify';
import {
  type CsrfAdapter,
  type CsrfConfig,
  type CsrfRequest,
  type CsrfResponse,
  type RequiredCsrfConfig,
  createCsrfProtection,
} from '@csrf-armor/core';

class FastifyAdapter implements CsrfAdapter<FastifyRequest, FastifyReply> {
  extractRequest(req: FastifyRequest): CsrfRequest {
    const headers = new Map<string, string>();
    for (const [key, value] of Object.entries(req.headers)) {
      if (value !== undefined) {
        headers.set(key.toLowerCase(), Array.isArray(value) ? value.join(', ') : value);
      }
    }

    return {
      method: req.method,
      url: req.url,
      headers,
      cookies: new Map(Object.entries(req.cookies ?? {}).map(([k, v]) => [k, String(v)])),
      body: req.body,
    };
  }

  applyResponse(reply: FastifyReply, csrfResponse: CsrfResponse): FastifyReply {
    const headers = csrfResponse.headers instanceof Map
      ? csrfResponse.headers
      : Object.entries(csrfResponse.headers);
    for (const [key, value] of headers) {
      reply.header(key, value);
    }

    const cookies = csrfResponse.cookies instanceof Map
      ? csrfResponse.cookies
      : Object.entries(csrfResponse.cookies);
    for (const [name, { value, options }] of cookies) {
      reply.setCookie(name, value, options); // @fastify/cookie maxAge is in seconds
    }

    return reply;
  }

  async getTokenFromRequest(
    req: CsrfRequest,
    config: RequiredCsrfConfig
  ): Promise<string | undefined> {
    const headers = req.headers as Map<string, string>;
    const fromHeader = headers.get(config.token.headerName.toLowerCase());
    if (fromHeader) return fromHeader;

    const fromQuery = new URL(req.url, 'http://localhost').searchParams.get(config.token.fieldName);
    if (fromQuery) return fromQuery;

    if (req.body && typeof req.body === 'object') {
      const fromBody = (req.body as Record<string, unknown>)[config.token.fieldName];
      if (typeof fromBody === 'string') return fromBody;
    }

    return undefined;
  }
}

export function csrfHook(config?: CsrfConfig) {
  const csrf = createCsrfProtection(new FastifyAdapter(), config);

  return async (request: FastifyRequest, reply: FastifyReply) => {
    const result = await csrf.protect(request, reply);
    if (!result.success) {
      return reply.code(403).send({ error: 'CSRF validation failed' });
    }
  };
}

// fastify.addHook('preHandler', csrfHook({ secret: process.env.CSRF_SECRET }));
```

For Koa, Hono or another framework the shape is the same: map the request into `CsrfRequest`, write headers and cookies back in `applyResponse`, and read the token from header, query, then body.

## Low-level helpers

If you only need the cryptography, `@csrf-armor/core` also exports:

```typescript
import { generateNonce, generateSignedToken, parseSignedToken } from '@csrf-armor/core';

const token = await generateSignedToken(secret, 3600); // "{expiry}.{nonce}.{signature}"
const { exp, nonce } = await parseSignedToken(token, secret); // throws on bad or expired tokens
const random = generateNonce(32); // 32 random bytes as 64 hex characters
```

`parseSignedToken` throws `TokenExpiredError` or `TokenInvalidError`, both subclasses of `CsrfError` with `code` and `statusCode` properties. These helpers don't bind tokens to cookies or sessions; use `createCsrfProtection` for request protection.
