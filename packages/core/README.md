# @csrf-armor/core

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://cdn.nebz.dev/csrf-armor/logo-large-dark.webp" />
  <img src="https://cdn.nebz.dev/csrf-armor/logo-light.webp" alt="CSRF Armor" width="480" />
</picture>

[![CodeQL](https://github.com/muneebs/csrf-armor/workflows/CodeQL%20Security%20Analysis/badge.svg)](https://github.com/muneebs/csrf-armor/actions/workflows/codeql-analysis.yml)
[![CI](https://github.com/muneebs/csrf-armor/workflows/CI/badge.svg)](https://github.com/muneebs/csrf-armor/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/@csrf-armor/core.svg)](https://www.npmjs.com/package/@csrf-armor/core)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

The framework-agnostic engine behind CSRF Armor. It has no dependencies and uses only Web APIs, so it runs on Node.js and edge runtimes.

**Using Next.js, Express or Nuxt?** Install the adapter instead; it includes this package:
[`@csrf-armor/nextjs`](https://www.npmjs.com/package/@csrf-armor/nextjs) ·
[`@csrf-armor/express`](https://www.npmjs.com/package/@csrf-armor/express) ·
[`@csrf-armor/nuxt`](https://www.npmjs.com/package/@csrf-armor/nuxt)

Use the core directly to support another framework, or for the low-level token helpers.

## Install

```bash
npm install @csrf-armor/core
```

## Usage

Implement `CsrfAdapter` for your framework, then create a protector:

```typescript
import { createCsrfProtection } from '@csrf-armor/core';

const csrf = createCsrfProtection(new MyFrameworkAdapter(), {
  secret: process.env.CSRF_SECRET,
});

const result = await csrf.protect(request, response);

if (!result.success) {
  // Respond with 403. result.reason says why.
}
// Otherwise continue with result.response, which carries the token cookie and header.
```

The [adapter guide](https://github.com/muneebs/csrf-armor/blob/main/docs/custom-adapters.md) covers the interface and includes a complete Fastify adapter.

## Token helpers

```typescript
import { generateNonce, generateSignedToken, parseSignedToken } from '@csrf-armor/core';

const token = await generateSignedToken(secret, 3600);   // "{expiry}.{nonce}.{signature}"
const { exp } = await parseSignedToken(token, secret);   // throws TokenExpiredError / TokenInvalidError
const nonce = generateNonce(32);                         // 64 hex characters
```

These only handle cryptography. They don't bind tokens to cookies or sessions; use `createCsrfProtection` for request protection.

## Documentation

- [Strategies](https://github.com/muneebs/csrf-armor/blob/main/docs/strategies.md)
- [Configuration](https://github.com/muneebs/csrf-armor/blob/main/docs/configuration.md)
- [Security guide](https://github.com/muneebs/csrf-armor/blob/main/docs/security.md)
- [Writing an adapter](https://github.com/muneebs/csrf-armor/blob/main/docs/custom-adapters.md)
- [API reference](https://github.com/muneebs/csrf-armor/blob/main/docs/api.md)
- [Migration](https://github.com/muneebs/csrf-armor/blob/main/docs/migration.md)

## License

MIT © [Muneeb Samuels](https://github.com/muneebs)
