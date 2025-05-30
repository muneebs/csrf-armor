import type { NextRequest, NextResponse } from 'next/server';
import type {
	CsrfConfig,
	CsrfProtectFunction,
	CsrfProtectResult,
	RequiredCsrfConfig,
} from './types.js';
import { DEFAULT_CONFIG, SAFE_METHODS } from './constants.js';
import { generateSignedToken } from './crypto.js';
import {
	validateSignedToken,
	validateOrigin,
	validateDoubleSubmit,
} from './validators.js';

function mergeConfig(
	defaultConfig: CsrfConfig,
	userConfig?: CsrfConfig,
): RequiredCsrfConfig {
	const merged = {
		...defaultConfig,
		...userConfig,
		cookie: {
			...defaultConfig.cookie,
			...userConfig?.cookie,
		},
		token: {
			...defaultConfig.token,
			...userConfig?.token,
		},
	};

	// Ensure all required properties are present
	const config: RequiredCsrfConfig = {
		strategy: merged.strategy ?? 'hybrid',
		secret: merged.secret ?? 'secret',
		token: {
			expiry: merged.token?.expiry ?? 3600,
			headerName: merged.token?.headerName ?? 'X-CSRF-Token',
			fieldName: merged.token?.fieldName ?? 'csrf_token',
		},
		cookie: {
			name: merged.cookie?.name ?? 'csrf-token',
			secure: merged.cookie?.secure ?? true,
			httpOnly: merged.cookie?.httpOnly ?? false,
			sameSite: merged.cookie?.sameSite ?? 'lax',
			path: merged.cookie?.path ?? '/',
		},
		allowedOrigins: merged.allowedOrigins ?? [],
		excludePaths: merged.excludePaths ?? [],
		skipContentTypes: merged.skipContentTypes ?? [],
	};

	// Add optional properties if they exist
	if (merged.token?.getTokenFromRequest) {
		config.token.getTokenFromRequest = merged.token.getTokenFromRequest;
	}
	if (merged.cookie?.domain) {
		config.cookie.domain = merged.cookie.domain;
	}
	if (merged.cookie?.maxAge) {
		config.cookie.maxAge = merged.cookie.maxAge;
	}

	return config;
}

export function createCsrfProtect(
	userConfig?: CsrfConfig,
): CsrfProtectFunction {
	const config = mergeConfig(DEFAULT_CONFIG, userConfig);

	return async function csrfProtect(
		request: NextRequest,
		response: NextResponse,
	): Promise<CsrfProtectResult> {
		// Check if path is excluded
		const pathname = request.nextUrl.pathname;
		if (config.excludePaths.some((path) => pathname.startsWith(path))) {
			return { success: true, response };
		}

		// Check if content type should skip CSRF
		const contentType = request.headers.get('content-type') ?? '';
		if (config.skipContentTypes.some((type) => contentType.includes(type))) {
			return { success: true, response };
		}

		// Generate token for all requests
		const token = await generateSignedToken(config.secret, config.token.expiry);
		response.headers.set('x-csrf-token', token);

		// Set cookie for client access
		// By default, this is a session cookie (no maxAge) which is more secure
		// as it's automatically deleted when the browser closes
		const cookieName = config.cookie.name;
		response.cookies.set(cookieName, token, {
			secure: config.cookie.secure,
			httpOnly: config.cookie.httpOnly,
			sameSite: config.cookie.sameSite,
			path: config.cookie.path,
			...(config.cookie.domain && { domain: config.cookie.domain }),
			...(config.cookie.maxAge && { maxAge: config.cookie.maxAge }),
		});

		// Skip validation for safe methods
		if (SAFE_METHODS.includes(request.method as never)) {
			return { success: true, response, token };
		}

		// Validate based on strategy
		const validationResult = await validateRequest(request, config);
		if (!validationResult.isValid) {
			return {
				success: false,
				response,
				reason: validationResult.reason || 'CSRF Validation failed',
			};
		}

		return { success: true, response, token };
	};
}

async function validateRequest(
	request: NextRequest,
	config: RequiredCsrfConfig,
): Promise<{ isValid: boolean; reason?: string }> {
	switch (config.strategy) {
		case 'signed-token':
			return await validateSignedToken(request, config);

		case 'origin-check':
			return validateOrigin(request, config);

		case 'double-submit':
			return await validateDoubleSubmit(request, config);

		case 'hybrid': {
			const originResult = validateOrigin(request, config);
			if (!originResult.isValid) return originResult;

			return await validateSignedToken(request, config);
		}

		default:
			return { isValid: false, reason: 'Invalid strategy' };
	}
}
