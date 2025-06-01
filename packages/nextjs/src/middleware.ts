import type { NextRequest, NextResponse } from "next/server";
import type { CsrfConfig } from "@csrf-armor/core";
import { createCsrfProtection } from "@csrf-armor/core";
import { NextjsAdapter } from "./adapter.js";

export function createCsrfMiddleware(config?: CsrfConfig) {
  const adapter = new NextjsAdapter();
  const csrfProtection = createCsrfProtection(adapter, config);

  return async function csrfMiddleware(
    request: NextRequest,
    response: NextResponse,
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
} from "@csrf-armor/core";
