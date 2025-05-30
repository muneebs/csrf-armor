import type { CsrfConfig, CookieOptions } from './types.js';

export const SAFE_METHODS = ['GET', 'HEAD', 'OPTIONS'] as const;

export const DEFAULT_COOKIE_OPTIONS: CookieOptions = {
	name: 'csrf-token',
	secure: true,
	httpOnly: false, // Must be false so JavaScript can read the token
	sameSite: 'lax',
	path: '/',
} as const;

export const DEFAULT_CONFIG: CsrfConfig = {
	strategy: 'hybrid',
	token: {
		expiry: 3600,
		headerName: 'X-CSRF-Token',
		fieldName: 'csrf_token',
	},
	cookie: DEFAULT_COOKIE_OPTIONS,
	secret: 'default-secret-change-this',
	allowedOrigins: [],
	excludePaths: [],
	skipContentTypes: [],
} as const;
