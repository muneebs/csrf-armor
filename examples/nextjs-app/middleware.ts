import {NextResponse} from 'next/server';
import type {NextRequest} from 'next/server';
import {createCsrfMiddleware, type CsrfStrategy} from '@csrf-armor/nextjs';
import {SESSION_COOKIE} from './lib/session';
import {STRATEGIES, demoCookieName, isStrategy} from './lib/strategies';

// Validate secret in production
if (process.env.NODE_ENV === 'production' && !process.env.CSRF_SECRET) {
    throw new Error('CSRF_SECRET environment variable is required in production');
}

// Demo-only knobs so every strategy can be tried without editing code.
// See README.md for the full list.
const strategy = (process.env.CSRF_STRATEGY ?? 'signed-double-submit') as CsrfStrategy;
const port = process.env.PORT ?? '3000';
const expiry = process.env.CSRF_TOKEN_EXPIRY ? Number(process.env.CSRF_TOKEN_EXPIRY) : 3600;
const sessionBinding = process.env.CSRF_SESSION_BINDING === 'true';

// Dev-only fallback. Never ship a hardcoded secret.
const secret = process.env.CSRF_SECRET ?? 'dev-only-secret-change-me-32-chars-minimum';
const cookie = {
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const, // Use 'strict' for higher security if cross-origin not needed
};
// Used by origin-check and hybrid
const allowedOrigins = (process.env.CSRF_ALLOWED_ORIGINS ?? `http://localhost:${port}`).split(',');

const csrfProtect = createCsrfMiddleware({
    strategy,
    secret,
    token: {expiry},
    cookie,
    allowedOrigins,
    // Bind signed tokens to the (fake) login session. Real apps should return
    // a server-side session id, never a value the client can choose.
    getSessionId: sessionBinding
        ? (_csrfRequest, req) => (req as NextRequest).cookies.get(SESSION_COOKIE)?.value
        : undefined,
});

// One protector per /demo/<strategy> page, each with its own cookie. A real
// app would pick a single strategy.
const demoProtectors = new Map(
    STRATEGIES.map((s) => [
        s,
        createCsrfMiddleware({
            strategy: s,
            secret,
            cookie: {...cookie, name: demoCookieName(s)},
            allowedOrigins,
        }),
    ])
);

function protectorFor(pathname: string) {
    const match = /^\/(?:api\/)?demo\/([a-z-]+)/.exec(pathname);
    return (match && isStrategy(match[1]) && demoProtectors.get(match[1])) || csrfProtect;
}

export async function middleware(request: NextRequest) {
    const response = NextResponse.next();
    const result = await protectorFor(request.nextUrl.pathname)(request, response);

    if (!result.success) {
        // Security logging
        console.warn('CSRF validation failed:', {
            url: request.url,
            method: request.method,
            reason: result.reason,
            ip: request.headers.get('x-forwarded-for') ?? 'unknown',
            userAgent: request.headers.get('user-agent') || 'unknown',
        });

        return NextResponse.json(
            {error: 'CSRF validation failed'},
            {status: 403}
        );
    }

    return result.response;
}

export const config = {
    matcher: [
        // Protect all routes except static files
        '/((?!_next/static|_next/image|favicon.ico).*)',
    ],
};
