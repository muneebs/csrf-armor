# Configuration

Every package accepts the same `CsrfConfig` object from `@csrf-armor/core`:

- Express: `csrfMiddleware(config)`
- Next.js: `createCsrfMiddleware(config)`
- Nuxt: the `csrfArmor` key in `nuxt.config.ts` (see the [Nuxt README](../packages/nuxt/README.md#configuration) for the two Nuxt-specific differences)
- Core: `createCsrfProtection(adapter, config)`

All options are optional.

## Reference

```typescript
interface CsrfConfig {
  strategy?: 'signed-double-submit' | 'hybrid' | 'signed-token' | 'origin-check' | 'double-submit';
  secret?: string;
  token?: {
    expiry?: number;           // Token lifetime in seconds
    reissueThreshold?: number; // Issue a new token when this many seconds remain
    headerName?: string;       // Header the token is sent and read in
    fieldName?: string;        // Query parameter / body field the token is read from
  };
  cookie?: {
    name?: string;
    secure?: boolean;
    httpOnly?: boolean;
    sameSite?: 'strict' | 'lax' | 'none';
    path?: string;
    domain?: string;
    maxAge?: number;           // Seconds
  };
  allowedOrigins?: string[];
  excludePaths?: string[];
  skipContentTypes?: string[];
  getSessionId?: (csrfRequest, frameworkRequest) => string | undefined | Promise<string | undefined>;
}
```

| Option | Default | Notes |
|---|---|---|
| `strategy` | `'signed-double-submit'` | See [Strategies](./strategies.md). |
| `secret` | Random per process | **Set this in production.** See [Secrets](#secrets). |
| `token.expiry` | `3600` | Seconds. |
| `token.reissueThreshold` | `500` | Seconds before expiry when a safe request gets a fresh token. |
| `token.headerName` | `'X-CSRF-Token'` | Matched case-insensitively. |
| `token.fieldName` | `'csrf_token'` | Used for query parameters and body fields. |
| `cookie.name` | `'csrf-token'` | `signed-double-submit` also sets `<name>-server`. |
| `cookie.secure` | `true` | Set `false` only for local HTTP development. |
| `cookie.httpOnly` | `false` | Must stay `false` so client code can read the token. The `-server` cookie is always `httpOnly`. |
| `cookie.sameSite` | `'lax'` | `'strict'` adds protection if you don't need cross-site navigation with the cookie. |
| `cookie.path` | `'/'` | |
| `cookie.domain` | unset | Set to share the cookie across subdomains. |
| `cookie.maxAge` | unset | Session cookie when unset. |
| `allowedOrigins` | `[]` | Required for `origin-check` and `hybrid`. Exact origins, e.g. `https://app.example.com`. |
| `excludePaths` | `[]` | See [Excluding requests](#excluding-requests). |
| `skipContentTypes` | `[]` | See [Excluding requests](#excluding-requests). |
| `getSessionId` | unset | See [Session binding](#session-binding). Not available in Nuxt config. |

## Secrets

The signed strategies (`signed-double-submit`, `signed-token`, `hybrid`) sign tokens with `secret`. If you don't set one, a random secret is generated when the process starts, which means:

- every token becomes invalid when the server restarts, and
- tokens issued by one instance fail on another behind a load balancer.

Generate a secret once and load it from the environment:

```bash
openssl rand -base64 32
```

```typescript
if (process.env.NODE_ENV === 'production' && !process.env.CSRF_SECRET) {
  throw new Error('CSRF_SECRET is required in production');
}
```

## Where tokens are read from

On unsafe requests the adapters look for the token in this order and use the first one found:

1. The `token.headerName` header.
2. The `token.fieldName` query parameter.
3. The `token.fieldName` field in the request body.

Body support differs by adapter:

| Adapter | Body formats read |
|---|---|
| Express | Whatever your body parser put on `req.body` (e.g. `express.json()`, `express.urlencoded()`) |
| Next.js | `multipart/form-data`, `application/x-www-form-urlencoded`, JSON, `text/plain`, and Server Action payloads |
| Nuxt | JSON, `application/x-www-form-urlencoded`, `text/plain` (not `multipart/form-data`; send the header instead) |

Prefer the header. Query-string tokens can end up in server logs, browser history and `Referer` headers.

## Excluding requests

```typescript
{
  excludePaths: ['/api/webhooks', '/health'],
  skipContentTypes: [],
}
```

**`excludePaths`** matches whole path segments:

- `'/api/webhooks'` matches `/api/webhooks` and `/api/webhooks/stripe`, but not `/api/webhooks-v2`.
- `'/api/'` (trailing slash) matches only paths under `/api/`.

Exclude as little as possible. Webhooks and health checks are typical; whole API prefixes are not.

**`skipContentTypes`** skips validation for requests whose media type exactly matches an entry (case-insensitive, parameters such as `charset` ignored, no prefix matching).

> **Warning:** Never skip `text/plain`, `application/x-www-form-urlencoded` or `multipart/form-data`. A cross-site HTML form can send any of them, so skipping them turns off CSRF protection for exactly the requests an attacker can forge. Skipping `application/json` is only safe if your CORS policy blocks cross-origin JSON requests, and it removes protection if that ever changes.

## Session binding

By default, a valid token and cookie pair works for any visitor. Session binding mixes your application's session ID into the signature, so a pair issued in one session fails in any other. This stops an attacker from planting a pair they obtained themselves, for example from a sibling subdomain.

It applies to `signed-double-submit`, `signed-token` and `hybrid`, and is ignored by `double-submit` and `origin-check`.

```typescript
{
  strategy: 'signed-double-submit',
  secret: process.env.CSRF_SECRET,
  // Express example; return undefined for anonymous visitors
  getSessionId: (_csrfRequest, req) => (req as express.Request).session?.id,
}
```

- Return a stable, server-side identifier, never a value the client chooses.
- Tokens issued before login stop working after login; the next safe request issues new ones automatically.
- Nuxt registers the resolver differently; see the [Nuxt README](../packages/nuxt/README.md#session-binding).

## Recipes

**Local development over HTTP**

```typescript
{ cookie: { secure: process.env.NODE_ENV === 'production' } }
```

**Sharing tokens across subdomains**

```typescript
{
  cookie: { domain: '.example.com', sameSite: 'lax' },
  allowedOrigins: ['https://app.example.com', 'https://admin.example.com'],
}
```

`sameSite: 'strict'` still works across subdomains of the same site; it blocks the cookie on cross-*site* requests.

**Different strategies per route** — create two protectors and pick one per request. See the [Next.js README](../packages/nextjs/README.md#different-strategies-per-route) for an example.

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| Every unsafe request fails after a deploy or restart | No `secret` set, so a new random one was generated. |
| Fails behind a load balancer but not locally | Instances have different secrets. Share one `CSRF_SECRET`. |
| `No CSRF token submitted` | The client isn't sending the header or field, or (Express) no body parser is installed. |
| `Missing CSRF cookies` / `No CSRF cookie found` | The cookie wasn't sent: check `cookie.domain`, `cookie.path`, `secure` on HTTP, or `credentials` on cross-origin `fetch`. In Express, check that `cookie-parser` is installed. |
| `Token mismatch` after a while | The client cached an old token. Read the latest one from the cookie or response header. |
| `Missing origin and referer headers` | `origin-check`/`hybrid` with a client that sends neither header (e.g. some server-to-server calls). |
| Origin rejected on a valid site | The origin isn't listed exactly: scheme, host and port must match. |
