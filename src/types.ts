import type { NextRequest, NextResponse } from 'next/server';

export type CsrfStrategy =
	| 'double-submit'
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
	getTokenFromRequest?: (request: NextRequest) => Promise<string | undefined>;
}

export interface RequiredTokenOptions {
	expiry: number;
	headerName: string;
	fieldName: string;
	getTokenFromRequest?: (request: NextRequest) => Promise<string | undefined>;
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

export interface CsrfProtectResult {
	readonly success: boolean;
	readonly response: NextResponse;
	readonly token?: string;
	readonly reason?: string;
}

export interface ValidationResult {
	readonly isValid: boolean;
	readonly reason?: string;
}

export type CsrfProtectFunction = (
	request: NextRequest,
	response: NextResponse,
) => Promise<CsrfProtectResult>;

export interface TokenPayload {
	readonly exp: number;
	readonly nonce: string;
}
