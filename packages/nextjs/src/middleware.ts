import type { NextRequest, NextResponse } from 'next/server';
import type { CsrfConfig } from '@csrf-armor/core';
import { createCsrfProtection } from '@csrf-armor/core';
import { NextjsAdapter } from './adapter.js';

/**
 * Creates Next.js middleware for CSRF protection.
 *
 * This function creates middleware compatible with Next.js 13+ middleware system
 * that automatically protects your application routes from CSRF attacks. It works
 * with both Pages Router and App Router architectures.
 *
 * **Features:**
 * - Automatic token generation and validation
 * - Support for Next.js Server Actions and API routes
 * - Integration with Next.js cookie handling
 * - Compatible with Next.js middleware patterns
 * - Supports all CSRF strategies (double-submit, signed tokens, etc.)
 * - Handles multipart form data from Next.js forms
 *
 * **Usage Patterns:**
 * - Place in `middleware.ts` file for application-wide protection
 * - Use with `matcher` config to target specific routes
 * - Integrate with API routes for AJAX protection
 * - Support Server Actions with automatic token injection
 *
 * @public
 * @param config - Optional CSRF protection configuration
 * @returns Next.js middleware function that can be used in middleware.ts
 *
 * @example
 * ```typescript
 * // middleware.ts - Application-wide protection
 * import { createCsrfMiddleware } from '@csrf-armor/nextjs';
 * import { NextRequest, NextResponse } from 'next/server';
 *
 * const csrfMiddleware = createCsrfMiddleware({
 *   strategy: 'signed-double-submit',
 *   secret: process.env.CSRF_SECRET,
 *   excludePaths: ['/api/public', '/api/webhook'],
 *   cookie: {
 *     secure: process.env.NODE_ENV === 'production',
 *     sameSite: 'lax'
 *   }
 * });
 *
 * export async function middleware(request: NextRequest) {
 *   const response = NextResponse.next();
 *   await csrfMiddleware(request, response);
 *   return response;
 * }
 *
 * export const config = {
 *   matcher: [
 *     '/((?!api/public|_next/static|_next/image|favicon.ico).*)',
 *   ],
 * };
 * ```
 *
 * @example
 * ```typescript
 * // API Route protection
 * import { createCsrfMiddleware } from '@csrf-armor/nextjs';
 * import { NextRequest, NextResponse } from 'next/server';
 *
 * const csrf = createCsrfMiddleware({
 *   strategy: 'double-submit'
 * });
 *
 * export async function POST(request: NextRequest) {
 *   const response = new NextResponse();
 *
 *   try {
 *     const result = await csrf(request, response);
 *     if (!result.success) {
 *       return NextResponse.json(
 *         { error: result.reason },
 *         { status: 403 }
 *       );
 *     }
 *
 *     // Process the request
 *     return NextResponse.json({ message: 'Success' });
 *   } catch (error) {
 *     return NextResponse.json(
 *       { error: 'CSRF validation failed' },
 *       { status: 403 }
 *     );
 *   }
 * }
 * ```
 *
 * @example
 * ```typescript
 * // Server Actions with CSRF protection
 * import { createCsrfMiddleware } from '@csrf-armor/nextjs';
 *
 * const csrf = createCsrfMiddleware();
 *
 * export async function submitForm(formData: FormData) {
 *   'use server';
 *
 *   // CSRF validation happens automatically for Server Actions
 *   // when middleware is properly configured
 *
 *   const name = formData.get('name') as string;
 *   // Process form submission...
 * }
 * ```
 */
export function createCsrfMiddleware(config?: CsrfConfig) {
  const adapter = new NextjsAdapter();
  const csrfProtection = createCsrfProtection(adapter, config);

  return async function csrfMiddleware(
    request: NextRequest,
    response: NextResponse
  ) {
    return csrfProtection.protect(request, response);
  };
}

// Export types for convenience
export type {
  CsrfConfig,
  CsrfStrategy,
  CookieOptions,
  TokenOptions,
} from '@csrf-armor/core';
