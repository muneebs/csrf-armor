import { SAFE_METHODS } from './constants.js';
import {
  hashSessionId,
  parseSignedToken,
  timingSafeEqual,
  verifySignedToken,
} from './crypto.js';
import {
  ContentTypeError,
  FetchMetadataError,
  OriginMismatchError,
  SessionMismatchError,
  TokenInvalidError,
} from './errors.js';
import type {
  CsrfRequest,
  RequiredCsrfConfig,
  ValidationResult,
} from './types.js';

function getHeaders(request: CsrfRequest): Map<string, string> {
  if (request.headers instanceof Map) {
    return request.headers;
  }

  if (request.headers instanceof Headers) {
    const map = new Map<string, string>();
    for (const [key, value] of request.headers.entries()) {
      map.set(key.toLowerCase(), value);
    }
    return map;
  }

  const map = new Map<string, string>();
  for (const [key, value] of Object.entries(request.headers)) {
    if (value !== undefined) {
      map.set(key.toLowerCase(), String(value));
    }
  }
  return map;
}

export function getCookies(request: CsrfRequest): Map<string, string> {
  if (request.cookies instanceof Map) {
    return request.cookies;
  }
  return new Map(Object.entries(request.cookies ?? {}));
}

function getHeader(request: CsrfRequest, name: string): string | undefined {
  return getHeaders(request).get(name.toLowerCase());
}

/**
 * Normalizes an origin string to its canonical form.
 *
 * Returns `null` for the literal `"null"` origin or unparseable inputs.
 *
 * @internal
 */
export function normalizeOrigin(origin: string): string | null {
  if (origin === 'null' || origin.trim().toLowerCase() === 'null') {
    return null;
  }

  try {
    return new URL(origin).origin.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Extracts the media type from a Content-Type header, ignoring parameters.
 *
 * @internal
 */
export function parseMediaType(contentType: string): string {
  const beforeSemicolon = contentType.split(';')[0] ?? '';
  return beforeSemicolon.trim().toLowerCase();
}

/**
 * Validates a signed CSRF token, optionally checking session binding.
 *
 * @internal
 */
export async function validateSignedToken(
  request: CsrfRequest,
  config: RequiredCsrfConfig,
  getTokenFromRequest: (
    req: CsrfRequest,
    config: RequiredCsrfConfig
  ) => Promise<string | undefined>,
  sessionId?: string
): Promise<ValidationResult> {
  try {
    const token = await getTokenFromRequest(request, config);
    if (!token) {
      return { isValid: false, reason: 'No CSRF token provided' };
    }

    const payload = await parseSignedToken(
      token,
      config.secret,
      config.previousSecrets
    );

    if (payload.sidHash) {
      if (!sessionId) {
        return { isValid: false, reason: new SessionMismatchError().message };
      }
      const expectedHash = await hashSessionId(sessionId);
      if (!timingSafeEqual(payload.sidHash, expectedHash)) {
        return { isValid: false, reason: new SessionMismatchError().message };
      }
    }

    return { isValid: true };
  } catch (error) {
    if (error instanceof TokenInvalidError) {
      return { isValid: false, reason: error.message };
    }
    if (error instanceof Error) {
      return { isValid: false, reason: error.message };
    }
    return { isValid: false, reason: 'Unknown error' };
  }
}

/**
 * Validates request origin against the configured allowlist.
 *
 * @internal
 */
export function validateOrigin(
  request: CsrfRequest,
  config: RequiredCsrfConfig
): ValidationResult {
  if (config.allowedOrigins.length === 0) {
    return { isValid: true };
  }

  const headers = getHeaders(request);
  const originHeader = headers.get('origin');
  const refererHeader = headers.get('referer');

  if (!originHeader && !refererHeader) {
    return { isValid: false, reason: 'Missing origin and referer headers' };
  }

  const rawOrigin = originHeader ?? refererHeader;
  if (!rawOrigin) {
    return { isValid: false, reason: 'No origin or referer header' };
  }

  const requestOrigin = normalizeOrigin(rawOrigin);
  if (!requestOrigin) {
    return { isValid: false, reason: 'Invalid or null origin' };
  }

  const normalizedAllowed = config.allowedOrigins.map((o) =>
    normalizeOrigin(o)
  );
  if (normalizedAllowed.includes(requestOrigin)) {
    return { isValid: true };
  }

  return {
    isValid: false,
    reason: new OriginMismatchError(requestOrigin).message,
  };
}

/**
 * Validates Fetch Metadata headers (`Sec-Fetch-Site`, `Sec-Fetch-Mode`, `Sec-Fetch-Dest`).
 *
 * Absent headers are treated as pass-through (defense-in-depth, not a gate).
 *
 * @internal
 */
export function validateFetchMetadata(
  request: CsrfRequest,
  _config: RequiredCsrfConfig
): ValidationResult {
  const secFetchSite = getHeader(request, 'sec-fetch-site');

  if (!secFetchSite) {
    return { isValid: true };
  }

  const site = secFetchSite.toLowerCase();
  const method = request.method.toUpperCase();

  // Safe methods are not state-changing; cross-site GETs are normal user navigation.
  if (SAFE_METHODS.includes(method as (typeof SAFE_METHODS)[number])) {
    return { isValid: true };
  }

  if (site === 'cross-site') {
    return {
      isValid: false,
      reason: new FetchMetadataError(
        'Sec-Fetch-Site: cross-site on state-changing request'
      ).message,
    };
  }

  // same-origin, same-site, and none (direct navigation) are acceptable.
  return { isValid: true };
}

/**
 * Validates Content-Type header for state-changing requests.
 *
 * @internal
 */
export function validateContentType(
  request: CsrfRequest,
  config: RequiredCsrfConfig
): ValidationResult {
  const method = request.method.toUpperCase();
  if (SAFE_METHODS.includes(method as (typeof SAFE_METHODS)[number])) {
    return { isValid: true };
  }

  const headers = getHeaders(request);
  const rawContentType = headers.get('content-type') ?? '';
  const contentType = parseMediaType(rawContentType);

  const skipList = config.contentType.skipValidation ?? [];
  if (skipList.some((type) => contentType === parseMediaType(type))) {
    return { isValid: true };
  }

  if (config.contentType.enforcePresence && !contentType) {
    return {
      isValid: false,
      reason: new ContentTypeError(
        'Missing Content-Type on state-changing request'
      ).message,
    };
  }

  const allowedTypes = config.contentType.allowedTypes ?? [];
  if (
    allowedTypes.length > 0 &&
    contentType &&
    !allowedTypes.includes(contentType)
  ) {
    return {
      isValid: false,
      reason: new ContentTypeError(
        `Content-Type "${contentType}" is not in the allowlist`
      ).message,
    };
  }

  return { isValid: true };
}

/**
 * Validates the signed double-submit cookie pattern.
 *
 * @internal
 */
export async function validateSignedDoubleSubmit(
  request: CsrfRequest,
  config: RequiredCsrfConfig,
  getTokenFromRequest: (
    req: CsrfRequest,
    config: RequiredCsrfConfig
  ) => Promise<string | undefined>
): Promise<ValidationResult> {
  const cookies = getCookies(request);
  const cookieName = config.cookie.name;
  const unsignedCookieToken = cookies.get(cookieName);
  const signedCookieToken = cookies.get(`${cookieName}-server`);
  const submittedToken = await getTokenFromRequest(request, config);

  if (!unsignedCookieToken || !signedCookieToken) {
    return { isValid: false, reason: 'Missing CSRF cookies' };
  }

  if (!submittedToken) {
    return { isValid: false, reason: 'No CSRF token submitted' };
  }

  try {
    const verifiedUnsignedToken = await verifySignedToken(
      signedCookieToken,
      config.secret,
      config.previousSecrets
    );

    if (!timingSafeEqual(unsignedCookieToken, verifiedUnsignedToken)) {
      return { isValid: false, reason: 'Cookie integrity check failed' };
    }

    if (!timingSafeEqual(submittedToken, unsignedCookieToken)) {
      return { isValid: false, reason: 'Token mismatch' };
    }

    return { isValid: true };
  } catch (error) {
    if (error instanceof Error) {
      return { isValid: false, reason: error.message };
    }
    return { isValid: false, reason: 'Token validation failed' };
  }
}

/**
 * Dispatches validation to the configured strategy.
 *
 * @internal
 */
export async function validateRequest(
  request: CsrfRequest,
  config: RequiredCsrfConfig,
  getTokenFromRequest: (
    req: CsrfRequest,
    config: RequiredCsrfConfig
  ) => Promise<string | undefined>,
  sessionId?: string
): Promise<ValidationResult> {
  switch (config.strategy) {
    case 'signed-token':
      return await validateSignedToken(
        request,
        config,
        getTokenFromRequest,
        sessionId
      );

    case 'origin-check':
      return validateOrigin(request, config);

    case 'fetch-metadata':
      return validateFetchMetadata(request, config);

    case 'signed-double-submit':
      return await validateSignedDoubleSubmit(
        request,
        config,
        getTokenFromRequest
      );

    case 'hybrid': {
      const fetchMetadataResult = validateFetchMetadata(request, config);
      if (!fetchMetadataResult.isValid) return fetchMetadataResult;

      const originResult = validateOrigin(request, config);
      if (!originResult.isValid) return originResult;

      const contentTypeResult = validateContentType(request, config);
      if (!contentTypeResult.isValid) return contentTypeResult;

      return await validateSignedToken(
        request,
        config,
        getTokenFromRequest,
        sessionId
      );
    }

    default:
      return { isValid: false, reason: 'Invalid strategy' };
  }
}
