import {NextResponse} from 'next/server';
import type {NextRequest} from 'next/server';
import {createCsrfMiddleware, type CsrfStrategy} from '@csrf-armor/nextjs';
import {SESSION_COOKIE} from './lib/session';

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

const csrfProtect = createCsrfMiddleware({
    strategy,
    // Dev-only fallback. Never ship a hardcoded secret.
    secret: process.env.CSRF_SECRET ?? 'dev-only-secret-change-me-32-chars-minimum',
    token: {expiry},
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax' // Use 'strict' for higher security if cross-origin not needed
    },
    // Used by origin-check and hybrid
    allowedOrigins: (process.env.CSRF_ALLOWED_ORIGINS ?? `http://localhost:${port}`).split(','),
    // Bind signed tokens to the (fake) login session. Real apps should return
    // a server-side session id, never a value the client can choose.
    getSessionId: sessionBinding
        ? (_csrfRequest, req) => (req as NextRequest).cookies.get(SESSION_COOKIE)?.value
        : undefined,
});

export async function middleware(request: NextRequest) {
    const response = NextResponse.next();
    const result = await csrfProtect(request, response);

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
