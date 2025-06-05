import type {
  CookieOptions,
  CsrfAdapter,
  CsrfRequest,
  CsrfResponse,
  RequiredCsrfConfig,
} from '@csrf-armor/core';
import type express from 'express';

export class ExpressAdapter
  implements CsrfAdapter<express.Request, express.Response>
{
  extractRequest(req: express.Request): CsrfRequest {
    // Create a Map for headers with proper type handling
    const headers = new Map<string, string>();

    // Safely process headers, handling string, string[], and undefined values
    if (req.headers) {
      Object.entries(req.headers).forEach(([key, value]) => {
        if (Array.isArray(value)) {
          // Join array values into a single string
          headers.set(key.toLowerCase(), value.join(', '));
        } else if (value !== undefined) {
          // Set string values directly
          headers.set(key.toLowerCase(), value);
        }
        // Skip undefined values
      });
    }

    return {
      method: req.method,
      url: req.url,
      headers,
      cookies: new Map(Object.entries(req.cookies ?? {})),
      body: req.body,
    };
  }

  private setCookie(
    res: express.Response,
    name: string,
    value: string,
    options?: CookieOptions
  ): void {
    res.cookie(name, value, {
      secure: options?.secure,
      httpOnly: options?.httpOnly,
      sameSite: options?.sameSite,
      path: options?.path,
      domain: options?.domain,
      maxAge: options?.maxAge ? options.maxAge * 1000 : undefined, // Express expects milliseconds
    });
  }

  private setHeaders(
    res: express.Response,
    headers: CsrfResponse['headers']
  ): void {
    const entries =
      headers instanceof Map ? headers : Object.entries(headers || {});
    for (const [key, value] of entries) {
      res.setHeader(key, value);
    }
  }

  applyResponse(
    res: express.Response,
    csrfResponse: CsrfResponse
  ): express.Response {
    this.setHeaders(res, csrfResponse.headers);

    if (csrfResponse.cookies) {
      const entries =
        csrfResponse.cookies instanceof Map
          ? Array.from(csrfResponse.cookies.entries())
          : Object.entries(csrfResponse.cookies);

      for (const [name, { value, options }] of entries) {
        this.setCookie(res, name, value, options);
      }
    }

    return res;
  }

  async getTokenFromRequest(
    request: CsrfRequest,
    config: RequiredCsrfConfig
  ): Promise<string | undefined> {
    const headers =
      request.headers instanceof Map
        ? request.headers
        : new Map(Object.entries(request.headers));

    // Try header first (most common for APIs)
    const headerValue = headers.get(config.token.headerName.toLowerCase());
    if (headerValue) return headerValue;

    // Try query parameter
    if (request.url) {
      const url = new URL(request.url);
      const queryValue = url.searchParams.get(config.token.fieldName);
      if (queryValue) return queryValue;
    }

    // Try form body
    if (request.body && typeof request.body === 'object') {
      const body = request.body as Record<string, unknown>;
      const formValue = body[config.token.fieldName];
      if (typeof formValue === 'string') return formValue;
    }

    return undefined;
  }
}
