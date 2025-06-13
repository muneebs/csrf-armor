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
      contentType === 'application/x-www-form-urlencoded' ||
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
        // Handle JSON body - check if it's already parsed or needs to be parsed
        let json;
        if (typeof request.body === 'object' && request.body !== null) {
          // Body is already parsed (test environment or direct object)
          json = request.body;
        } else {
          // Body needs to be parsed from NextRequest
          const nextRequest = request as unknown as NextRequest;
          if (typeof nextRequest.json === 'function') {
            json = await nextRequest.json();
          } else {
            // Fallback - body might be a string
            json = typeof request.body === 'string' ? JSON.parse(request.body) : request.body;
          }
        }

        if (json && typeof json === 'object') {
          const jsonVal = json[config.token.fieldName];
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
        // handle array of arguments
        const args = JSON.parse(rawVal);

        if (!Array.isArray(args) || args.length === 0) return rawVal;

        const args0 = args[0];
        const typeofArgs0 = typeof args0;

        if (typeofArgs0 === 'string') {
          // treat first string argument as csrf token
          return args0;
        }

        if (typeofArgs0 === 'object') {
          // if first argument is an object, look for token there
          return args0[config.token.fieldName] ?? '';
        }

        return args0;
      } catch (e) {
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
