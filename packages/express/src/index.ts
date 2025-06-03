import {
  type CsrfConfig,
  CsrfError,
  createCsrfProtection,
} from '@csrf-armor/core';
import type express from 'express';
import { ExpressAdapter } from './adapter.js';

export type { ExpressAdapter };

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
