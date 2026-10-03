import type { CsrfStrategy } from '@csrf-armor/nextjs';

export const STRATEGY_NOTES: Record<CsrfStrategy, string> = {
  'double-submit':
    'Compares the token in a cookie with the token sent in the form or header. No secret. Not recommended for production.',
  'signed-double-submit':
    'Like double-submit, but an httpOnly cookie holds a signed, expiring copy of the token. Requires a secret.',
  'signed-token':
    'An HMAC-signed, expiring token that must match the CSRF cookie. Requires a secret.',
  'origin-check':
    'Checks the Origin or Referer header against allowedOrigins. No token is checked.',
  hybrid:
    'origin-check plus signed-token. Requires a secret and allowedOrigins.',
};

export const STRATEGIES = Object.keys(STRATEGY_NOTES) as CsrfStrategy[];

export function isStrategy(value: string): value is CsrfStrategy {
  return (STRATEGIES as readonly string[]).includes(value);
}

export function demoCookieName(strategy: CsrfStrategy): string {
  return `csrf-${strategy}`;
}
