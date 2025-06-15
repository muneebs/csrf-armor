import {
  type CsrfConfig,
  CsrfError,
  createCsrfProtection,
} from '@csrf-armor/core';
import type express from 'express';
import { ExpressAdapter } from './adapter.js';

export type { ExpressAdapter };

/**
 * Creates Express middleware that enforces CSRF protection on incoming requests.
 *
 * This middleware automatically validates CSRF tokens on state-changing requests
 * (POST, PUT, DELETE, etc.) while allowing safe methods (GET, HEAD, OPTIONS) to pass through.
 * It integrates seamlessly with Express applications and provides comprehensive CSRF protection.
 *
 * **Behavior:**
 * - For safe methods (GET, HEAD, OPTIONS): Generates and sets CSRF tokens, calls `next()`
 * - For state-changing methods: Validates CSRF tokens, calls `next()` on success or throws on failure
 * - Attaches `req.csrfToken` property containing the current CSRF token for use in views/responses
 * - Respects `excludePaths` configuration to skip protection for specified routes
 * - Handles multiple token sources: headers, cookies, query parameters, and request body
 *
 * **Token Sources (in order of precedence):**
 * 1. HTTP headers (e.g., `X-CSRF-Token`)
 * 2. Cookies (for double-submit strategies)
 * 3. URL query parameters
 * 4. Request body (form data or JSON)
 *
 * @public
 * @param config - Optional CSRF protection configuration (uses secure defaults if not provided)
 * @returns Express middleware function that validates CSRF tokens and manages token lifecycle
 *
 * @throws {CsrfError} If CSRF token validation fails, with code `'CSRF_VERIFICATION_ERROR'`
 *
 * @example
 * ```typescript
 * import express from 'express';
 * import { csrfMiddleware } from '@csrf-armor/express';
 *
 * const app = express();
 *
 * // Basic usage with default configuration
 * app.use(csrfMiddleware());
 *
 * // Custom configuration
 * app.use(csrfMiddleware({
 *   strategy: 'signed-double-submit',
 *   secret: process.env.CSRF_SECRET,
 *   excludePaths: ['/api/public', '/webhook'],
 *   allowedOrigins: ['https://yourdomain.com'],
 *   cookie: {
 *     name: 'csrf-token',
 *     secure: process.env.NODE_ENV === 'production',
 *     httpOnly: false, // Allow client-side access for SPA
 *     sameSite: 'strict'
 *   }
 * }));
 *
 * // Access token in route handlers
 * app.get('/form', (req, res) => {
 *   res.render('form', {
 *     csrfToken: req.csrfToken // Available after middleware runs
 *   });
 * });
 *
 * // Error handling
 * app.use((err, req, res, next) => {
 *   if (err.code === 'CSRF_VERIFICATION_ERROR') {
 *     res.status(403).json({ error: 'CSRF token validation failed' });
 *   } else {
 *     next(err);
 *   }
 * });
 * ```
 *
 * @example
 * ```typescript
 * // Integration with different strategies
 *
 * // Double-submit strategy (good for SPAs)
 * app.use(csrfMiddleware({
 *   strategy: 'double-submit',
 *   cookie: { httpOnly: false } // Allow client JS access
 * }));
 *
 * // Origin-check strategy (simple, less robust)
 * app.use(csrfMiddleware({
 *   strategy: 'origin-check',
 *   allowedOrigins: ['https://app.example.com', 'https://admin.example.com']
 * }));
 *
 * // Hybrid strategy (maximum security)
 * app.use(csrfMiddleware({
 *   strategy: 'hybrid',
 *   secret: 'your-secret-key'
 * }));
 * ```
 */
export function csrfMiddleware(config?: CsrfConfig) {
  const adapter = new ExpressAdapter();
  const protection = createCsrfProtection(adapter, config);

  return async (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    const result = await protection.protect(req, res);

    if (result.success) {
      req.csrfToken = result.token ?? undefined;
      next();
    } else {
      throw new CsrfError(
        result.reason ?? 'CSRF: Token validation failed.',
        'CSRF_VERIFICATION_ERROR'
      );
    }
  };
}
