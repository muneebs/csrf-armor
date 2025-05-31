import type { NextRequest, NextResponse } from "next/server";
import type {
  CsrfAdapter,
  CsrfRequest,
  CsrfResponse,
  RequiredCsrfConfig,
  CookieOptions,
} from "@csrf-lite/core";

export class NextjsAdapter implements CsrfAdapter<NextRequest, NextResponse> {
  extractRequest(req: NextRequest): CsrfRequest {
    const headers = new Map<string, string>();
    req.headers.forEach((value, key) => {
      headers.set(key.toLowerCase(), value);
    });

    const cookies = new Map<string, string>();
    for (const { name, value } of req.cookies.getAll()) {
      cookies.set(name, value);
    }

    return {
      method: req.method,
      url: req.url,
      headers,
      cookies,
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
        res.headers.set(key, value);
      }
    }

    // Set cookies
    if (csrfResponse.cookies instanceof Map) {
      for (const [name, { value, options }] of csrfResponse.cookies) {
        res.cookies.set(name, value, this.adaptCookieOptions(options));
      }
    } else {
      for (const [name, { value, options }] of Object.entries(
        csrfResponse.cookies,
      )) {
        res.cookies.set(name, value, this.adaptCookieOptions(options));
      }
    }

    return res;
  }

  async getTokenFromRequest(
    request: CsrfRequest,
    config: RequiredCsrfConfig,
  ): Promise<string | undefined> {
    const headers =
      request.headers instanceof Map
        ? request.headers
        : new Map(Object.entries(request.headers));

    // Try header first
    const headerValue = headers.get(config.token.headerName.toLowerCase());
    if (headerValue) return headerValue;

    // Try form data if available
    if (request.body && typeof request.body === "object") {
      const body = request.body as Record<string, unknown>;
      const formValue = body[config.token.fieldName];
      if (typeof formValue === "string") return formValue;
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
