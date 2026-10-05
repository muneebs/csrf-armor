# @csrf-armor/nuxt

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://cdn.nebz.dev/csrf-armor/logo-large-dark.webp" />
  <img src="https://cdn.nebz.dev/csrf-armor/logo-light.webp" alt="CSRF Armor" width="480" />
</picture>

[![CI](https://github.com/muneebs/csrf-armor/workflows/CI/badge.svg)](https://github.com/muneebs/csrf-armor/actions/workflows/ci.yml)
[![npm version](https://badge.fury.io/js/@csrf-armor%2Fnuxt.svg)](https://badge.fury.io/js/@csrf-armor%2Fnuxt)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Nuxt](https://img.shields.io/badge/Nuxt-3%2B%20%7C%204%2B-00DC82.svg)](https://nuxt.com/)

CSRF protection for Nuxt 3 and 4: a module that registers server middleware automatically, plus auto-imported composables with SSR-safe token state. The server middleware uses Node.js APIs, so deploy with a Node-compatible Nitro preset.

## Quick start

### 1. Install

```bash
npm install @csrf-armor/nuxt
```

### 2. Register the module

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  modules: ['@csrf-armor/nuxt'],

  csrfArmor: {
    secret: process.env.CSRF_SECRET,
    cookie: { secure: process.env.NODE_ENV === 'production' },
  },
});
```

```bash
# .env — generate with: openssl rand -base64 32
CSRF_SECRET=your-generated-secret
```

That's it. Every unsafe request (`POST`, `PUT`, `PATCH`, `DELETE`) now needs a valid token.

### 3. Send the token

`useCsrfToken` and `useCsrfFetch` are auto-imported.

```vue
<script setup lang="ts">
const { csrfToken, csrfFetch } = useCsrfToken();

async function send() {
  await csrfFetch('/api/contact', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: 'Hello' }),
  });
}
</script>

<template>
  <button :disabled="!csrfToken" @click="send">Send</button>
</template>
```

Or, with Nuxt's `useFetch`:

```vue
<script setup lang="ts">
const { data, pending } = await useCsrfFetch('/api/items', {
  method: 'POST',
  body: { name: 'New Item' },
});
</script>
```

## Composables

### `useCsrfToken()`

Returns `{ csrfToken, updateToken, csrfFetch }`:

- `csrfToken: Ref<string | null>`: reactive token, stored with `useState` so it's isolated per request during SSR
- `updateToken()`: re-read the token from the cookie
- `csrfFetch(input, init?)`: native `fetch` that sends the token header and stores any new token from the response; headers from a `Request` argument are preserved

The token is refreshed on route changes and back/forward navigation.

### `useCsrfFetch<T>(url, opts?)`

`useFetch` with the CSRF header added to every request. Your own `onRequest` interceptors are kept and run as well.

## Configuration

Options go under `csrfArmor` in `nuxt.config.ts` and accept the shared `CsrfConfig`, with two Nuxt-specific differences:

- `getSessionId` can't be set here, because `runtimeConfig` only holds serializable values. Use [`defineCsrfSessionResolver`](#session-binding) instead.
- `sessionBinding: true` makes a missing resolver fail closed.

See the [configuration reference](https://github.com/muneebs/csrf-armor/blob/main/docs/configuration.md) for every option and its default, and [Strategies](https://github.com/muneebs/csrf-armor/blob/main/docs/strategies.md) to choose a strategy.

**Body tokens:** the server middleware reads the token from JSON, URL-encoded and `text/plain` bodies. For `multipart/form-data` uploads, send it in the `X-CSRF-Token` header (`csrfFetch` and `useCsrfFetch` do this for you).

### Session binding

Binds signed tokens to the logged-in session, so a token and cookie pair from one session fails in any other (see [why](https://github.com/muneebs/csrf-armor/blob/main/docs/configuration.md#session-binding)). Register the lookup in a Nitro plugin; `defineCsrfSessionResolver` is auto-imported in server code:

```typescript
// server/plugins/csrf-session.ts
export default defineNitroPlugin(() => {
  defineCsrfSessionResolver(async (event) => {
    const session = await getUserSession(event); // your auth library
    return session?.id; // undefined for anonymous visitors
  });
});
```

To make a missing plugin fail closed instead of silently leaving tokens unbound:

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  csrfArmor: {
    sessionBinding: true, // every request fails with 500 until a resolver is registered
  },
});
```

`defineCsrfSessionResolver` can also be imported explicitly from `@csrf-armor/nuxt/server`.

### Reading the token in server routes

The middleware stores the current token on `event.context.csrfToken`:

```typescript
// server/api/example.get.ts
export default defineEventHandler((event) => {
  return { csrfToken: event.context.csrfToken };
});
```

## More

- [Security guide](https://github.com/muneebs/csrf-armor/blob/main/docs/security.md)
- [Configuration troubleshooting](https://github.com/muneebs/csrf-armor/blob/main/docs/configuration.md#troubleshooting)

## License

MIT © [Jordan Labrosse](https://github.com/Jorgagu)
