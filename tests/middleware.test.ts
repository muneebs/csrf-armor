import { describe, it, expect } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import { createCsrfProtect } from '../src/middleware';

describe('CSRF Middleware', () => {
	it('should allow GET requests without validation', async () => {
		const csrfProtect = createCsrfProtect();
		const request = new NextRequest('http://localhost/api');
		const response = NextResponse.next();

		const result = await csrfProtect(request, response);

		expect(result.success).toBe(true);
		expect(result.token).toBeDefined();
		expect(result.response.headers.get('x-csrf-token')).toBeDefined();
	});

	it('should validate POST requests', async () => {
		const csrfProtect = createCsrfProtect({
			strategy: 'origin-check',
			allowedOrigins: ['http://localhost'],
		});

		const request = new NextRequest('http://localhost/api', {
			method: 'POST',
			headers: { origin: 'http://localhost' },
		});
		const response = NextResponse.next();

		const result = await csrfProtect(request, response);

		expect(result.success).toBe(true);
	});

	it('should exclude configured paths', async () => {
		const csrfProtect = createCsrfProtect({
			excludePaths: ['/api/webhook'],
		});

		const request = new NextRequest('http://localhost/api/webhook', {
			method: 'POST',
		});
		const response = NextResponse.next();

		const result = await csrfProtect(request, response);

		expect(result.success).toBe(true);
		expect(result.response.headers.get('x-csrf-token')).toBeNull();
	});

	it('should set csrf cookie', async () => {
		const csrfProtect = createCsrfProtect({
			cookie: { name: 'test-csrf' },
		});

		const request = new NextRequest('http://localhost/');
		const response = NextResponse.next();

		const result = await csrfProtect(request, response);

		expect(result.response.cookies.get('test-csrf')).toBeDefined();
	});
});
