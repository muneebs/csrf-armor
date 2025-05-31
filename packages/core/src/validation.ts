import type {
  ValidationResult,
  RequiredCsrfConfig,
  CsrfRequest,
} from "./types.js";
import { parseSignedToken, verifySignedToken } from "./crypto.js";
import { OriginMismatchError } from "./errors.js";
import { SAFE_METHODS } from "./constants.js";

export async function validateSignedToken(
  request: CsrfRequest,
  config: RequiredCsrfConfig,
  getTokenFromRequest: (
    req: CsrfRequest,
    config: RequiredCsrfConfig,
  ) => Promise<string | undefined>,
): Promise<ValidationResult> {
  try {
    const token = await getTokenFromRequest(request, config);

    if (!token) {
      return { isValid: false, reason: "No CSRF token provided" };
    }

    await parseSignedToken(token, config.secret);
    return { isValid: true };
  } catch (error) {
    if (error instanceof Error) {
      return { isValid: false, reason: error.message };
    }
    return { isValid: false, reason: "Unknown error" };
  }
}

export function validateOrigin(
  request: CsrfRequest,
  config: RequiredCsrfConfig,
): ValidationResult {
  const headers =
    request.headers instanceof Map
      ? request.headers
      : new Map(Object.entries(request.headers));
  const origin = headers.get("origin");
  const referer = headers.get("referer");

  if (!origin && !referer && !SAFE_METHODS.includes(request.method as never)) {
    return { isValid: false, reason: "Missing origin and referer headers" };
  }

  const requestOrigin = origin ?? (referer ? new URL(referer).origin : null);

  if (!requestOrigin) {
    return { isValid: false, reason: "No origin or referer header" };
  }

  if (config.allowedOrigins.includes(requestOrigin)) {
    return { isValid: true };
  }

  return {
    isValid: false,
    reason: new OriginMismatchError(requestOrigin).message,
  };
}

export async function validateDoubleSubmit(
  request: CsrfRequest,
  config: RequiredCsrfConfig,
  getTokenFromRequest: (
    req: CsrfRequest,
    config: RequiredCsrfConfig,
  ) => Promise<string | undefined>,
): Promise<ValidationResult> {
  const cookies =
    request.cookies instanceof Map
      ? request.cookies
      : new Map(Object.entries(request.cookies));
  const cookieName = config.cookie.name;
  const cookieToken = cookies.get(cookieName);
  const submittedToken = await getTokenFromRequest(request, config);

  if (!cookieToken) {
    return { isValid: false, reason: "No CSRF cookie found" };
  }

  if (!submittedToken) {
    return { isValid: false, reason: "No CSRF token submitted" };
  }

  if (cookieToken !== submittedToken) {
    return { isValid: false, reason: "Token mismatch" };
  }

  return { isValid: true };
}

export async function validateSignedDoubleSubmit(
  request: CsrfRequest,
  config: RequiredCsrfConfig,
  getTokenFromRequest: (
    req: CsrfRequest,
    config: RequiredCsrfConfig,
  ) => Promise<string | undefined>,
): Promise<ValidationResult> {
  const cookies =
    request.cookies instanceof Map
      ? request.cookies
      : new Map(Object.entries(request.cookies));

  const cookieName = config.cookie.name;
  const unsignedCookieToken = cookies.get(cookieName);
  const signedCookieToken = cookies.get(`${cookieName}-server`);
  const submittedToken = await getTokenFromRequest(request, config);

  if (!unsignedCookieToken || !signedCookieToken) {
    return { isValid: false, reason: "Missing CSRF cookies" };
  }

  if (!submittedToken) {
    return { isValid: false, reason: "No CSRF token submitted" };
  }

  try {
    // 1. Verify the server cookie signature
    const verifiedUnsignedToken = await verifySignedToken(
      signedCookieToken,
      config.secret,
    );

    // 2. Ensure client cookie matches the verified token
    if (unsignedCookieToken !== verifiedUnsignedToken) {
      return { isValid: false, reason: "Cookie integrity check failed" };
    }

    // 3. Ensure submitted token matches the unsigned token
    if (submittedToken !== unsignedCookieToken) {
      return { isValid: false, reason: "Token mismatch" };
    }

    return { isValid: true };
  } catch (error) {
    if (error instanceof Error) {
      return { isValid: false, reason: error.message };
    }
    return { isValid: false, reason: "Token validation failed" };
  }
}

export async function validateRequest(
  request: CsrfRequest,
  config: RequiredCsrfConfig,
  getTokenFromRequest: (
    req: CsrfRequest,
    config: RequiredCsrfConfig,
  ) => Promise<string | undefined>,
): Promise<ValidationResult> {
  switch (config.strategy) {
    case "signed-token":
      return await validateSignedToken(request, config, getTokenFromRequest);

    case "origin-check":
      return validateOrigin(request, config);

    case "double-submit":
      return await validateDoubleSubmit(request, config, getTokenFromRequest);

    case "signed-double-submit":
      return await validateSignedDoubleSubmit(
        request,
        config,
        getTokenFromRequest,
      );

    case "hybrid": {
      const originResult = validateOrigin(request, config);
      if (!originResult.isValid) return originResult;

      return await validateSignedToken(request, config, getTokenFromRequest);
    }

    default:
      return { isValid: false, reason: "Invalid strategy" };
  }
}
