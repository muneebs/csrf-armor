import type { H3Event } from 'h3';

/**
 * Returns the authenticated session identifier for a request, or `undefined`
 * for anonymous requests. See `getSessionId` in `@csrf-armor/core`.
 */
export type CsrfSessionResolver = (
  event: H3Event
) => string | undefined | Promise<string | undefined>;

interface CsrfSessionRegistry {
  resolver?: CsrfSessionResolver;
}

// Shared through globalThis so the resolver registered by a user's Nitro
// plugin reaches the module's middleware even if the bundler ends up with
// two copies of this file.
const REGISTRY_KEY = Symbol.for('@csrf-armor/nuxt/session-resolver');

function registry(): CsrfSessionRegistry {
  const store = globalThis as typeof globalThis & {
    [REGISTRY_KEY]?: CsrfSessionRegistry;
  };
  store[REGISTRY_KEY] ??= {};
  return store[REGISTRY_KEY];
}

/**
 * Binds signed CSRF tokens to the current session.
 *
 * Call this from a Nitro plugin so it runs before the first request. Once
 * registered, `signed-token`, `hybrid` and `signed-double-submit` tokens are
 * signed with the returned session identifier, so a token or cookie pair
 * issued in one session fails validation in any other. Tokens are reissued
 * on the next safe request after the session changes (for example after
 * login).
 *
 * Return a stable, server-side value, never one the client can choose.
 *
 * @example
 * ```typescript
 * // server/plugins/csrf-session.ts
 * export default defineNitroPlugin(() => {
 *   defineCsrfSessionResolver(async (event) => {
 *     const session = await getUserSession(event);
 *     return session.id;
 *   });
 * });
 * ```
 */
export function defineCsrfSessionResolver(resolver: CsrfSessionResolver): void {
  registry().resolver = resolver;
}

/** Returns the registered session resolver, if any. @internal */
export function getCsrfSessionResolver(): CsrfSessionResolver | undefined {
  return registry().resolver;
}

/** Removes the registered session resolver. Intended for tests. @internal */
export function clearCsrfSessionResolver(): void {
  delete registry().resolver;
}
