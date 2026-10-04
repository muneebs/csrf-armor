import { CsrfConfigError } from './errors.js';
import type { CookieOptions, CookiePrefix } from './types.js';

/** Default CSRF cookie name, before any prefix is applied. */
const DEFAULT_NAME = 'csrf-token';

/**
 * Prefixes browsers give special meaning to. Matched case-insensitively,
 * since some browsers enforce them regardless of case.
 */
const RESERVED_PREFIXES = ['__host-', '__secure-', '__http-'] as const;

/**
 * Returns the full cookie name for the given options: `prefix` + `name`.
 *
 * Client-side code that reads the CSRF cookie must use this name.
 *
 * @param cookie - Cookie options as passed in `CsrfConfig.cookie`
 * @returns The cookie name the browser will store, e.g. `__Host-csrf-token`
 *
 * @public
 * @example
 * ```typescript
 * resolveCookieName({ prefix: '__Host-' }); // '__Host-csrf-token'
 * resolveCookieName({ name: 'xsrf' });       // 'xsrf'
 * ```
 */
export function resolveCookieName(cookie?: CookieOptions): string {
  const name = cookie?.name ?? DEFAULT_NAME;
  return cookie?.prefix ? `${cookie.prefix}${name}` : name;
}

/**
 * Throws a {@link CsrfConfigError} when the cookie options would make the
 * browser reject the CSRF cookie because of its name prefix.
 *
 * Checks both an explicit `prefix` and a prefix written into `name` by hand.
 *
 * @param cookie - Cookie options with defaults already applied
 *
 * @internal
 */
export function validateCookiePrefix(
  cookie: Readonly<{
    name: string;
    prefix?: CookiePrefix | false | undefined;
    secure: boolean;
    path: string;
    domain?: string;
  }>
): void {
  const lowerName = cookie.name.toLowerCase();
  const namePrefix = RESERVED_PREFIXES.find((p) => lowerName.startsWith(p));

  if (cookie.prefix && namePrefix) {
    throw new CsrfConfigError(
      `cookie.name "${cookie.name}" already starts with a cookie prefix; ` +
        'set either cookie.prefix or a prefixed cookie.name, not both'
    );
  }

  const displayName = `${cookie.prefix || ''}${cookie.name}`;
  const fullName = displayName.toLowerCase();

  if (fullName.startsWith('__http-') || fullName.startsWith('__host-http-')) {
    throw new CsrfConfigError(
      `cookie name "${displayName}" requires HttpOnly, but the ` +
        'CSRF cookie must be readable by client-side JavaScript'
    );
  }

  const isHost = fullName.startsWith('__host-');
  const isSecure = fullName.startsWith('__secure-');
  if (!isHost && !isSecure) return;

  const label = isHost ? '__Host-' : '__Secure-';
  if (!cookie.secure) {
    throw new CsrfConfigError(
      `cookie prefix ${label} requires cookie.secure to be true`
    );
  }
  if (isHost && cookie.domain) {
    throw new CsrfConfigError(
      'cookie prefix __Host- cannot be used with cookie.domain; ' +
        'remove domain or use the __Secure- prefix'
    );
  }
  if (isHost && cookie.path !== '/') {
    throw new CsrfConfigError(
      `cookie prefix __Host- requires cookie.path to be "/" (got "${cookie.path}")`
    );
  }
}
