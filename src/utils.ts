import type { NextRequest } from 'next/server';
import type { RequiredCsrfConfig } from './types';

export function getTokenValueFromFormData(
	formData: FormData,
	config: RequiredCsrfConfig,
): File | string | undefined {
	const fieldName = config.token.fieldName;
	for (const [key, value] of formData.entries()) {
		if (new RegExp(`^(\\d+_)*${fieldName}$`).test(key)) return value;
	}
	return undefined;
}

export async function getTokenFromRequest(
	request: NextRequest,
	config: RequiredCsrfConfig,
): Promise<string | undefined> {
	if (config.token.getTokenFromRequest)
		return await config.token.getTokenFromRequest(request);

	const value = request.headers.get(config.token.headerName);
	if (value) return value;

	const contentType = request.headers.get('content-type') ?? 'text/plain';
	if (
		contentType === 'application/x-www-form-urlencoded' ||
		contentType.startsWith('multipart/form-data')
	) {
		const formData = await request.formData();
		const value = getTokenValueFromFormData(formData, config);
		if (value && typeof value === 'string') return value;
	}

	const fieldName = config.token.fieldName;
	if (
		contentType === 'application/json' ||
		contentType === 'application/ld+json'
	) {
		const json = (await request.json()) as never;
		const jsonVal = json[fieldName];
		if (typeof jsonVal === 'string') return jsonVal;
		return '';
	}

	const rawValue = await request.text();
	// non-form server actions
	if (contentType.startsWith('text/plain')) {
		try {
			// handle array of arguments
			const args = JSON.parse(rawValue);

			if (!Array.isArray(args) || args.length === 0) return rawValue;

			const args0 = args[0];
			const typeofArgs0 = typeof args0;

			if (typeofArgs0 === 'string') {
				// treat first string argument as csrf token
				return args0;
			}

			if (typeofArgs0 === 'object') {
				// if first argument is an object, look for token there
				return args0[fieldName] || '';
			}

			return args0;
		} catch (e) {
			return rawValue;
		}
	}

	return rawValue;
}
