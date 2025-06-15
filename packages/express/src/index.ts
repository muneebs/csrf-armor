import {
  type CsrfConfig,
  CsrfError,
  createCsrfProtection,
} from '@csrf-armor/core';
import type express from 'express';
import { ExpressAdapter } from './adapter.js';

export type { ExpressAdapter };

/**
 * Returns Express middleware that enforces CSRF protection on incoming HTTP requests.
 *
 * The middleware validates CSRF tokens on state-changing HTTP methods (such as POST, PUT, DELETE) and generates tokens for safe methods (GET, HEAD, OPTIONS). It attaches the current CSRF token to `req.csrfToken` for use in views or responses, and can skip protection for routes specified in the `excludePaths` configuration.
 *
 * Tokens are accepted from HTTP headers, cookies, URL query parameters, and the request body, in that order of precedence.
 *
 * @param config - Optional configuration for CSRF protection. If omitted, secure defaults are used.
 * @returns An Express middleware function that manages CSRF token validation and lifecycle.
 *
 * @throws {CsrfError} If CSRF token validation fails, with code `'CSRF_VERIFICATION_ERROR'`.
 *
 * @example
 * import express from 'express';
 * import { csrfMiddleware } from '@csrf-armor/express';
 *
 * const app = express();
 * app.use(csrfMiddleware());
 *
 * app.get('/form', (req, res) => {
 *   res.render('form', { csrfToken: req.csrfToken });
 * });
 *
 * app.use((err, req, res, next) => {
 *   if (err.code === 'CSRF_VERIFICATION_ERROR') {
 *     res.status(403).json({ error: 'CSRF token validation failed' });
 *   } else {
 *     next(err);
 *   }
 * });
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
