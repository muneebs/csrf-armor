import type {CsrfStrategy} from '@csrf-armor/nextjs';
import {isStrategy} from './strategies';

const strategyName = process.env.CSRF_STRATEGY ?? 'signed-double-submit';
if (!isStrategy(strategyName)) {
    throw new Error(`Unknown CSRF_STRATEGY "${strategyName}"`);
}
export const strategy: CsrfStrategy = strategyName;
export const tokenExpiry = process.env.CSRF_TOKEN_EXPIRY ? Number(process.env.CSRF_TOKEN_EXPIRY) : 3600;
export const sessionBinding = process.env.CSRF_SESSION_BINDING === 'true';

export const APP_COOKIE_NAME = 'csrf-token';

const port = process.env.PORT ?? '3000';
export const APP_ORIGIN = `http://localhost:${port}`;
export const ATTACKER_ORIGIN = `http://127.0.0.1:${port}`;

export const allowedOrigins = (process.env.CSRF_ALLOWED_ORIGINS ?? APP_ORIGIN).split(',');
