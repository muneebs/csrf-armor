# Strategies

CSRF Armor supports five strategies. Every adapter uses the same core, so the strategies behave the same in Express, Next.js and Nuxt.

All strategies share one lifecycle:

1. **Safe requests** (`GET`, `HEAD`, `OPTIONS`) are never blocked. They issue a token: it is set in a cookie and returned in the `X-CSRF-Token` response header.
2. **Unsafe requests** (`POST`, `PUT`, `PATCH`, `DELETE`, …) must pass validation for the configured strategy, unless the path is in `excludePaths` or the media type is in `skipContentTypes`.
3. The client submits the token in the `X-CSRF-Token` header, a `csrf_token` query parameter, or a `csrf_token` body field. Names are configurable; see [Configuration](./configuration.md).

## Choosing a strategy

| Strategy | Needs `secret` | Needs `allowedOrigins` | Use it for |
|---|---|---|---|
| `signed-double-submit` (default) | Yes | No | Most web apps |
| `hybrid` | Yes | Yes | Apps that want token **and** origin checks |
| `signed-token` | Yes | No | APIs and SPAs that send the token explicitly |
| `origin-check` | No | Yes | Backends whose clients always send `Origin` |
| `double-submit` | No | No | Local development only |

For any signed strategy, also consider [session binding](./configuration.md#session-binding). Without it, a token and cookie pair is valid for any visitor, so an attacker who can write cookies for your domain (for example from a sibling subdomain) can plant a pair they obtained themselves.

## `signed-double-submit` (default)

```typescript
{ strategy: 'signed-double-submit', secret: process.env.CSRF_SECRET }
```

- The client receives an unsigned token in a readable cookie (`csrf-token`) and the response header.
- The server stores an HMAC-signed copy in an `httpOnly` cookie (`csrf-token-server`).
- On unsafe requests the submitted token must match the readable cookie, and its signature must verify against the server cookie.

The signature means an attacker can't forge a valid pair without the secret.

## `hybrid`

```typescript
{
  strategy: 'hybrid',
  secret: process.env.CSRF_SECRET,
  allowedOrigins: ['https://app.example.com'],
}
```

Runs the `signed-token` checks and requires the request's origin to be in `allowedOrigins`. Both must pass.

## `signed-token`

```typescript
{ strategy: 'signed-token', secret: process.env.CSRF_SECRET, token: { expiry: 3600 } }
```

Tokens have the form `{expiry}.{nonce}.{signature}`, signed with HMAC-SHA256.

Unsafe requests must submit the current signed token **and** send the matching cookie named by `cookie.name`. A token copied from another browser, or submitted without the cookie, is rejected. `hybrid` has the same requirement.

- Get the token and cookie from a safe request first.
- When a response rotates the cookie, use the new token for later submissions. Cached form or header tokens may need refreshing.
- Rejected unsafe requests also rotate the cookie. Their result has no `token`, but the response carries the replacement cookie and token header. Before retrying, refresh the token from the browser's current cookie or from a safe request.
- With concurrent responses, a separately cached token can go stale; use the cookie the browser currently holds.

This binds the token to the browser's CSRF cookie, not to an application login session. For that, add [session binding](./configuration.md#session-binding). The low-level `generateSignedToken` and `parseSignedToken` helpers only do the cryptography; use request protection to get cookie binding.

## `origin-check`

```typescript
{ strategy: 'origin-check', allowedOrigins: ['https://app.example.com'] }
```

Validates the `Origin` header (falling back to the origin of `Referer`) against `allowedOrigins`, by exact match. Unsafe requests with neither header, or with a malformed `Referer`, are rejected. No token is required, so it's the cheapest strategy, but it relies on the browser and any proxies preserving those headers. List exact origins such as `https://app.example.com`; wildcards are not supported.

## `double-submit`

```typescript
{ strategy: 'double-submit' }
```

The same random token goes in a cookie and in the request; the server checks they match. There is no signature, so anyone who can set a cookie on your domain can defeat it. Use it for local development only.

## Comparing cost

`origin-check` and `double-submit` do no cryptography. The signed strategies do one HMAC operation per check using the Web Crypto API, and `hybrid` adds the origin check on top. The difference is rarely significant next to the rest of a request.
