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

    const cookieValue = (request as unknown as NextRequest).cookies.get(
      config.token.headerName.toLowerCase()
    )?.value;
    if (cookieValue) return cookieValue;

    if (headers.get('content-type')?.includes('multipart/form-data')) {
      const formData = await (request.body as Body).formData();
      for (const entry of formData.entries().toArray()) {
        const [key, value] = entry;
        if (key.includes(config.token.fieldName)) {
          return value.toString();
        }
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
