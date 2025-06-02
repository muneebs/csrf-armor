export type CsrfStrategy =
  | 'double-submit'
  | 'signed-double-submit'
  | 'signed-token'
  | 'origin-check'
  | 'hybrid';

export interface CookieOptions {
  name?: string;
  secure?: boolean;
  httpOnly?: boolean;
  sameSite?: 'strict' | 'lax' | 'none';
  path?: string;
  domain?: string;
  maxAge?: number;
}

export interface RequiredCookieOptions {
  name: string;
  secure: boolean;
  httpOnly: boolean;
  sameSite: 'strict' | 'lax' | 'none';
  path: string;
  domain?: string;
  maxAge?: number;
}

export interface TokenOptions {
  expiry?: number;
  headerName?: string;
  fieldName?: string;
}

export interface RequiredTokenOptions {
  expiry: number;
  headerName: string;
  fieldName: string;
}

export interface CsrfConfig {
  strategy?: CsrfStrategy;
  token?: TokenOptions;
  cookie?: CookieOptions;
  secret?: string;
  allowedOrigins?: readonly string[];
  excludePaths?: readonly string[];
  skipContentTypes?: readonly string[];
}

export interface RequiredCsrfConfig {
  strategy: CsrfStrategy;
  token: RequiredTokenOptions;
  cookie: RequiredCookieOptions;
  secret: string;
  allowedOrigins: readonly string[];
  excludePaths: readonly string[];
  skipContentTypes: readonly string[];
}

export interface ValidationResult {
  readonly isValid: boolean;
  readonly reason?: string;
}

export interface TokenPayload {
  readonly exp: number;
  readonly nonce: string;
}

// Generic request/response interfaces that can be adapted by frameworks
export interface CsrfRequest {
  method: string;
  url: string;
  headers: Map<string, string> | Record<string, string>;
  cookies: Map<string, string> | Record<string, string>;
  body?: unknown;
}

export interface CsrfResponse {
  headers: Map<string, string> | Record<string, string>;
  cookies:
    | Map<string, { value: string; options?: CookieOptions }>
    | Record<string, { value: string; options?: CookieOptions }>;
}

export interface CsrfProtectResult {
  readonly success: boolean;
  readonly token?: string;
  readonly reason?: string;
}

// Framework adapter interface
export interface CsrfAdapter<TRequest = unknown, TResponse = unknown> {
  extractRequest(req: TRequest): CsrfRequest;
  applyResponse(res: TResponse, csrfResponse: CsrfResponse): TResponse;
  getTokenFromRequest(
    req: CsrfRequest,
    config: RequiredCsrfConfig
  ): Promise<string | undefined>;
}
