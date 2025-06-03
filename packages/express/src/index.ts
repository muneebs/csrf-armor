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
 * If CSRF validation succeeds, attaches the CSRF token (if present) to `req.csrfToken` and proceeds to the next middleware. If validation fails, throws a `CsrfError` with an error code of `'CSRF_VERIFICATION_ERROR'`.
 *
 * @param config - Optional CSRF protection configuration.
 * @returns An asynchronous Express middleware function that validates CSRF tokens.
 *
 * @throws {CsrfError} If CSRF token validation fails for the request.
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
