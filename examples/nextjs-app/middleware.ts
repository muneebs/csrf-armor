import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createCsrfMiddleware } from '@csrf-armor/nextjs';
import {
  APP_COOKIE_NAME,
  allowedOrigins,
  sessionBinding,
  strategy,
  tokenExpiry,
} from './lib/config';
import { SESSION_COOKIE } from './lib/session';
import { STRATEGIES, demoCookieName } from './lib/strategies';

// Validate secret in production
if (process.env.NODE_ENV === 'production' && !process.env.CSRF_SECRET) {
  throw new Error('CSRF_SECRET environment variable is required in production');
}

const secret =
  process.env.CSRF_SECRET ?? 'dev-only-secret-change-me-32-chars-minimum';
const cookie = {
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const, // Use 'strict' for higher security if cross-origin not needed
};

const csrfProtect = createCsrfMiddleware({
  strategy,
  secret,
  token: { expiry: tokenExpiry },
  cookie: { ...cookie, name: APP_COOKIE_NAME },
  allowedOrigins,
  getSessionId: sessionBinding
    ? (_csrfRequest, req) =>
        (req as NextRequest).cookies.get(SESSION_COOKIE)?.value
    : undefined,
});

const demoProtectors = new Map(
  STRATEGIES.map((s) => [
    s,
    createCsrfMiddleware({
      strategy: s,
      secret,
      cookie: { ...cookie, name: demoCookieName(s) },
      allowedOrigins,
    }),
  ])
);

function protectorFor(pathname: string) {
  const segment = /^\/(?:api\/)?demo\/([^/]+)/.exec(pathname)?.[1];
  const demoStrategy = STRATEGIES.find((s) => s === segment);
  return (demoStrategy && demoProtectors.get(demoStrategy)) || csrfProtect;
}

export async function middleware(request: NextRequest) {
  const response = NextResponse.next();
  const result = await protectorFor(request.nextUrl.pathname)(
    request,
    response
  );

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
      { error: 'CSRF validation failed' },
      { status: 403 }
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
