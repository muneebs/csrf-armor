import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
	generateSignedToken,
	parseSignedToken,
	generateNonce,
} from '../src/crypto';
import { TokenExpiredError, TokenInvalidError } from '../src/errors';

describe('Crypto utilities', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	describe('generateNonce', () => {
		it('should generate a nonce of default length', () => {
			const nonce = generateNonce();
			expect(nonce).toHaveLength(32); // 16 bytes = 32 hex chars
		});

		it('should generate a nonce of custom length', () => {
			const nonce = generateNonce(8);
			expect(nonce).toHaveLength(16); // 8 bytes = 16 hex chars
		});
	});

	describe('generateSignedToken', () => {
		it('should generate a valid signed token', async () => {
			const secret = 'test-secret';
			const expiry = 3600;
			const token = await generateSignedToken(secret, expiry);

			expect(token).toMatch(/^\d+\.[a-f0-9]+\.[a-f0-9]+$/);
		});
	});

	describe('parseSignedToken', () => {
		it('should parse a valid token', async () => {
			const secret = 'test-secret';
			const expiry = 3600;
			const token = await generateSignedToken(secret, expiry);

			const payload = await parseSignedToken(token, secret);
			expect(payload).toHaveProperty('exp');
			expect(payload).toHaveProperty('nonce');
			expect(payload.nonce).toMatch(/^[a-f0-9]+$/);
		});

		it('should throw error for invalid token format', async () => {
			await expect(parseSignedToken('invalid', 'secret')).rejects.toThrow(
				TokenInvalidError,
			);
		});

		it('should throw error for expired token', async () => {
			const secret = 'test-secret';
			const token = await generateSignedToken(secret, 1);

			vi.advanceTimersByTime(2000);

			await expect(parseSignedToken(token, secret)).rejects.toThrow(
				TokenExpiredError,
			);
		});

		it('should throw error for invalid signature', async () => {
			const token = await generateSignedToken('secret1', 3600);
			await expect(parseSignedToken(token, 'secret2')).rejects.toThrow(
				TokenInvalidError,
			);
		});
	});
});
