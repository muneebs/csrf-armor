import { describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';
import {
	validateOrigin,
	validateSignedToken,
	validateDoubleSubmit,
} from '../src/validators';
import type { RequiredCsrfConfig } from '../src/types';
import { generateSignedToken } from '../src/crypto';

const TEST_CONFIG: RequiredCsrfConfig = {
	strategy: 'hybrid',
	secret: 'test-secret-32-characters-long-123',
	token: {
		expiry: 3600,
		headerName: 'X-CSRF-Token',
		fieldName: 'csrf_token',
	},
	cookie: {
		name: 'csrf-token',
		secure: true,
		httpOnly: false,
		sameSite: 'lax',
		path: '/',
	},
	allowedOrigins: ['http://localhost:3000'],
	excludePaths: [],
	skipContentTypes: [],
};

describe('Validators', () => {
	describe('validateOrigin', () => {
		it('should validate allowed origin', () => {
			const request = new NextRequest('http://localhost/api', {
				headers: { origin: 'http://localhost:3000' },
			});

			const config = {
				...TEST_CONFIG,
				allowedOrigins: ['http://localhost:3000'],
			};

			const result = validateOrigin(request, config);
			expect(result.isValid).toBe(true);
		});

		it('should reject disallowed origin', () => {
			const request = new NextRequest('http://localhost/api', {
				headers: { origin: 'http://evil.com' },
			});

			const result = validateOrigin(request, TEST_CONFIG);
			expect(result.isValid).toBe(false);
			expect(result.reason).toContain('not allowed');
		});

		it('should allow same-origin requests without origin header', () => {
			const request = new NextRequest('http://localhost/api');
			const result = validateOrigin(request, TEST_CONFIG);
			expect(result.isValid).toBe(true);
		});
	});

	describe('validateSignedToken', () => {
		it('should validate a valid signed token', async () => {
			const secret = 'test-secret';
			const token = await generateSignedToken(secret, 3600);

			const request = new NextRequest('http://localhost/api', {
				headers: { 'x-csrf-token': token },
			});

			const config = {
				...TEST_CONFIG,
				secret,
			};

			const result = await validateSignedToken(request, config);
			expect(result.isValid).toBe(true);
		});

		it('should reject when no token provided', async () => {
			const request = new NextRequest('http://localhost/api');
			const result = await validateSignedToken(request, TEST_CONFIG);
			expect(result.isValid).toBe(false);
			expect(result.reason).toBe('No CSRF token provided');
		});
	});

	describe('validateDoubleSubmit', () => {
		it('should validate matching tokens', async () => {
			const token = 'test-token';
			const request = new NextRequest('http://localhost/api', {
				headers: { 'x-csrf-token': token },
			});

			// Mock cookie
			vi.spyOn(request.cookies, 'get').mockReturnValue({
				name: 'csrf-token',
				value: token,
			});

			const result = await validateDoubleSubmit(request, TEST_CONFIG);
			expect(result.isValid).toBe(true);
		});

		it('should reject mismatched tokens', async () => {
			const request = new NextRequest('http://localhost/api', {
				headers: { 'x-csrf-token': 'token1' },
			});

			vi.spyOn(request.cookies, 'get').mockReturnValue({
				name: 'csrf-token',
				value: 'token2',
			});

			const result = await validateDoubleSubmit(request, TEST_CONFIG);
			expect(result.isValid).toBe(false);
			expect(result.reason).toBe('Token mismatch');
		});
	});
});
