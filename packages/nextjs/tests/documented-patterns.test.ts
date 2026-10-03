import { NextRequest, NextResponse } from 'next/server';
import { describe, expect, it } from 'vitest';
import { createCsrfMiddleware } from '../src';

// Mirrors the top-level middleware documented in src/middleware.ts and the
// README "Security Headers" section. Keep these in sync with the docs.
const secret = 'test-secret-key-32-chars-long-good';
const csrfProtect = createCsrfMiddleware({ secret });

async function documentedMiddleware(request: NextRequest) {
  const result = await csrfProtect(request, NextResponse.next());

  if (!result.success) {
    return NextResponse.json(
      { error: 'CSRF validation failed' },
      { status: 403 }
    );
  }

  result.response.headers.set('X-Content-Type-Options', 'nosniff');
  return result.response;
}

const continues = (response: Response) =>
  response.headers.get('x-middleware-next') === '1';

describe('documented Next.js middleware patterns', () => {
  it('reports failure but still carries the continue response', async () => {
    // This is why callers must branch on result.success.
    const result = await csrfProtect(
      new NextRequest('http://localhost/api', { method: 'POST' }),
      NextResponse.next()
    );

    expect(result.success).toBe(false);
    expect(continues(result.response)).toBe(true);
  });

  it('blocks an invalid POST with 403 instead of continuing', async () => {
    const response = await documentedMiddleware(
      new NextRequest('http://localhost/api', { method: 'POST' })
    );

    expect(response.status).toBe(403);
    expect(continues(response)).toBe(false);
  });

  it('continues a valid POST with CSRF headers and security headers', async () => {
    const getResponse = await documentedMiddleware(
      new NextRequest('http://localhost/form')
    );
    expect(continues(getResponse)).toBe(true);
    const nextResponse = getResponse as NextResponse;
    const clientToken = nextResponse.cookies.get('csrf-token')?.value;
    const serverToken = nextResponse.cookies.get('csrf-token-server')?.value;
    if (!clientToken || !serverToken) throw new Error('Missing issued cookies');

    const response = await documentedMiddleware(
      new NextRequest('http://localhost/api', {
        method: 'POST',
        headers: {
          'x-csrf-token': clientToken,
          cookie: `csrf-token=${clientToken}; csrf-token-server=${serverToken}`,
        },
      })
    );

    expect(response.status).toBe(200);
    expect(continues(response)).toBe(true);
    // Unsafe requests are issued a fresh token for the next submission.
    expect(response.headers.get('x-csrf-token')).toMatch(/^[a-f0-9]+$/);
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
  });
});
