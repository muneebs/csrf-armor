# Security guide

How to deploy CSRF Armor safely, and what it does and doesn't protect against. To report a vulnerability, see the [security policy](../SECURITY.md).

## What it protects against

- Cross-site request forgery: another site causing a user's browser to send a state-changing request to yours.
- Cross-site form submissions, including `text/plain` "JSON" forms and multipart uploads.
- Forged or tampered tokens, when using a signed strategy.
- Token and cookie pairs planted from a sibling subdomain, when using a signed strategy with [session binding](./configuration.md#session-binding).

## What it doesn't protect against

- **Cross-site scripting (XSS).** Script running on your origin can read the token and send valid requests. Use a Content Security Policy and output encoding.
- Authentication and authorization bugs, injection flaws, or anything else outside CSRF.

CSRF Armor is one layer in your security stack, not the whole stack.

## Production checklist

- [ ] **Use a signed strategy.** Keep the default `signed-double-submit`, or use `hybrid` if you also want origin checks. Don't run `double-submit` in production. See [Strategies](./strategies.md).
- [ ] **Set a strong, stable `secret`** from the environment, shared by every instance. Without one, a random secret is generated per process. See [Secrets](./configuration.md#secrets).
- [ ] **Serve over HTTPS** and keep `cookie.secure: true`.
- [ ] **Keep `cookie.sameSite` at `'lax'` or `'strict'`.** Avoid `'none'`.
- [ ] **Enable session binding** (`getSessionId`) if users log in, especially if other subdomains of your site are less trusted.
- [ ] **Keep exclusions minimal.** Exclude specific paths such as webhooks, never broad prefixes, and never skip form-capable content types. See [Excluding requests](./configuration.md#excluding-requests).
- [ ] **List exact origins** in `allowedOrigins` for `origin-check` and `hybrid`.
- [ ] **Block failed checks.** The Next.js helper returns a result instead of responding; return a 403 when `success` is `false`.
- [ ] **Log failures** with the `reason`, method and URL. A spike from one client can indicate an attack, or a client sending stale tokens.

## Secrets

- Generate with a CSPRNG, for example `openssl rand -base64 32`.
- Store it in your environment or secret manager, never in source control.
- Rotating the secret invalidates all outstanding tokens; clients get new ones on their next safe request.

## Cookies

```typescript
cookie: {
  secure: true,       // HTTPS only
  sameSite: 'lax',    // or 'strict'
  httpOnly: false,    // the client needs to read the token
  path: '/',
}
```

The readable cookie only holds the token the client has to send back anyway. With `signed-double-submit`, the signed copy lives in a separate `httpOnly` cookie that scripts can't read.

Set `cookie.domain` only if you need to share tokens across subdomains. Every subdomain that can receive the cookie can also overwrite it, which is what session binding defends against.

## Tokens in URLs

Tokens are accepted in a query parameter for compatibility, but URLs end up in logs, browser history and `Referer` headers. Send the token in the header or a hidden form field where you can.

## Further reading

- [OWASP Cross-Site Request Forgery Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)
