import type {
  CookieOptions,
  CsrfAdapter,
  CsrfRequest,
  CsrfResponse,
  RequiredCsrfConfig,
} from '@csrf-armor/core';
import type { NextRequest, NextResponse } from 'next/server';

export class NextjsAdapter implements CsrfAdapter<NextRequest, NextResponse> {
  extractRequest(req: NextRequest): CsrfRequest {
    const cookies = new Map<string, string>();
    for (const { name, value } of req.cookies.getAll()) {
      cookies.set(name, value);
    }

    return {
      method: req.method,
      url: req.url,
      headers: req.headers,
      cookies,
      body: req,
    };
  }

  applyResponse(res: NextResponse, csrfResponse: CsrfResponse): NextResponse {
    // Set headers
    if (csrfResponse.headers instanceof Map) {
      for (const [key, value] of csrfResponse.headers) {
        res.headers.set(key, value);
      }
    } else {
      for (const [key, value] of Object.entries(csrfResponse.headers)) {
        res.headers.set(key, String(value));
      }
    }

    // Set cookies
    if (csrfResponse.cookies instanceof Map) {
      for (const [name, cookieData] of csrfResponse.cookies) {
        const { value, options } = cookieData as {
          value: string;
          options?: CookieOptions;
        };
        res.cookies.set(name, value, this.adaptCookieOptions(options));
      }
    } else {
      for (const [name, cookieData] of Object.entries(csrfResponse.cookies)) {
        const { value, options } = cookieData as {
          value: string;
          options?: CookieOptions;
        };
        res.cookies.set(name, value, this.adaptCookieOptions(options));
      }
    }

    return res;
  }

  async getTokenFromRequest(
    request: CsrfRequest,
    config: RequiredCsrfConfig
  ): Promise<string | undefined> {
    const headers = request.headers as Headers;
    // Try header first
    const headerValue = headers.get(config.token.headerName.toLowerCase());
    if (headerValue) return headerValue;

    const contentType = headers.get('content-type') ?? 'text/plain';

    const cookieValue = (request as unknown as NextRequest).cookies.get(
      config.token.headerName.toLowerCase()
    )?.value;
    if (cookieValue) return cookieValue;

    if (
      contentType.startsWith('application/x-www-form-urlencoded') ||
      contentType.startsWith('multipart/form-data')
    ) {
      const formData = await (request.body as Body).formData();
      for (const [key, value] of formData.entries()) {
        if (key.includes(config.token.fieldName)) {
          return value.toString();
        }
      }
    }

    if (
      contentType === 'application/json' ||
      contentType === 'application/ld+json'
    ) {
      try {
        let json: unknown;
        const nextRequest = request as unknown as NextRequest;
        if (typeof nextRequest.json === 'function') {
          json = await nextRequest.json();
        } else if (typeof request.body === 'string') {
          json = JSON.parse(request.body);
        } else if (typeof request.body === 'object' && request.body !== null) {
          json = request.body;
        }

        if (json && typeof json === 'object') {
          const jsonVal = (json as Record<string, unknown>)[config.token.fieldName];
          if (typeof jsonVal === 'string') return jsonVal;
        }
      } catch {
        // JSON parsing failed, continue to next extraction method
      }
    }

    // Try to get raw text for plain text content
    let rawVal = '';
    try {
      const nextRequest = request as unknown as NextRequest;
      if (typeof nextRequest.text === 'function') {
        rawVal = await nextRequest.text();
      } else if (typeof request.body === 'string') {
        rawVal = request.body;
      }
    } catch {
      // Text extraction failed, continue
    }
    // non-form server actions
    if (contentType.startsWith('text/plain') && rawVal) {
      try {
        const parsedData = JSON.parse(rawVal);

        if (Array.isArray(parsedData) && parsedData.length > 0) {
          return this.extractTokenFromServerActionArgs(parsedData, config);
        }

        if (parsedData && typeof parsedData === 'object') {
          const token = (parsedData as Record<string, unknown>)[config.token.fieldName];
          return typeof token === 'string' ? token : undefined;
        }

        if (typeof parsedData === 'string') {
          return parsedData;
        }

        return rawVal;
      } catch {
        // Not valid JSON, treat as raw text
        return rawVal;
      }
    }

    if (request.body && typeof request.body === 'object') {
      // Try form data if available
      const body = request.body as Record<string, unknown>;
      const formValue = body[config.token.fieldName];
      if (typeof formValue === 'string') return formValue;
    }

    return undefined;
  }

  /**
   * Extracts CSRF token from server action arguments array
   * Handles various argument patterns used by Next.js server actions
   */
  private extractTokenFromServerActionArgs(
    args: unknown[],
    config: RequiredCsrfConfig
  ): string | undefined {
    const firstArg = args[0];

    // First argument is a string (direct token)
    if (typeof firstArg === 'string') {
      return firstArg;
    }

    // First argument is an object containing the token
    if (firstArg && typeof firstArg === 'object') {
      const token = (firstArg as Record<string, unknown>)[config.token.fieldName];
      if (typeof token === 'string') {
        return token;
      }
    }

    // Search through all arguments for a token field
    for (const arg of args) {
      if (arg && typeof arg === 'object') {
        const token = (arg as Record<string, unknown>)[config.token.fieldName];
        if (typeof token === 'string') {
          return token;
        }
      }
    }

    // No token found in arguments
    return undefined;
  }

  private adaptCookieOptions(options?: CookieOptions): Record<string, unknown> {
    if (!options) return {};

    return {
      secure: options.secure,
      httpOnly: options.httpOnly,
      sameSite: options.sameSite,
      path: options.path,
      domain: options.domain,
      maxAge: options.maxAge,
    };
  }
}
