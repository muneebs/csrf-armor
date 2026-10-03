import type {CsrfStrategy} from '@csrf-armor/nextjs';
import {isStrategy} from './strategies';

// Demo-only knobs so every strategy can be tried without editing code.
// See README.md for the full list. Read by middleware.ts and the home page.
const strategyName = process.env.CSRF_STRATEGY ?? 'signed-double-submit';
if (!isStrategy(strategyName)) {
    throw new Error(`Unknown CSRF_STRATEGY "${strategyName}"`);
}
export const strategy: CsrfStrategy = strategyName;
export const tokenExpiry = process.env.CSRF_TOKEN_EXPIRY ? Number(process.env.CSRF_TOKEN_EXPIRY) : 3600;
export const sessionBinding = process.env.CSRF_SESSION_BINDING === 'true';

// The library's default cookie name, set explicitly because /actions reads it.
export const APP_COOKIE_NAME = 'csrf-token';

const port = process.env.PORT ?? '3000';
export const APP_ORIGIN = `http://localhost:${port}`;
// The same server on a different origin (and site), for forged cross-site posts.
export const ATTACKER_ORIGIN = `http://127.0.0.1:${port}`;

// Used by origin-check and hybrid
export const allowedOrigins = (process.env.CSRF_ALLOWED_ORIGINS ?? APP_ORIGIN).split(',');
