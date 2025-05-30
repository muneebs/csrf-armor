import type { NextRequest } from 'next/server';
import type { ValidationResult, RequiredCsrfConfig } from './types.js';
import { parseSignedToken } from './crypto.js';
import { OriginMismatchError } from './errors.js';
import { getTokenFromRequest } from './utils.js';

export async function validateSignedToken(
	request: NextRequest,
	config: RequiredCsrfConfig,
): Promise<ValidationResult> {
	try {
		const token = await getTokenFromRequest(request, config);

		if (!token) {
			return { isValid: false, reason: 'No CSRF token provided' };
		}

		await parseSignedToken(token, config.secret);
		return { isValid: true };
	} catch (error) {
		if (error instanceof Error) {
			return { isValid: false, reason: error.message };
		}
		return { isValid: false, reason: 'Unknown error' };
	}
}

export function validateOrigin(
	request: NextRequest,
	config: RequiredCsrfConfig,
): ValidationResult {
	const origin = request.headers.get('origin');
	const referer = request.headers.get('referer');

	// For same-origin requests, origin might be null
	if (!origin && !referer) {
		return { isValid: true };
	}

	const requestOrigin = origin ?? (referer ? new URL(referer).origin : null);

	if (!requestOrigin) {
		return { isValid: false, reason: 'No origin or referer header' };
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
	request: NextRequest,
	config: RequiredCsrfConfig,
): Promise<ValidationResult> {
	const cookieName = config.cookie.name;
	const cookie = request.cookies.get(cookieName);
	const cookieToken = cookie?.value;
	const submittedToken = await getTokenFromRequest(request, config);

	if (!cookieToken) {
		return { isValid: false, reason: 'No CSRF cookie found' };
	}

	if (!submittedToken) {
		return { isValid: false, reason: 'No CSRF token submitted' };
	}

	if (cookieToken !== submittedToken) {
		return { isValid: false, reason: 'Token mismatch' };
	}

	return { isValid: true };
}
