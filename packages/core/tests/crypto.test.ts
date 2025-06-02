import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  generateNonce,
  generateSignedToken,
  parseSignedToken,
  signUnsignedToken,
  verifySignedToken,
} from '../src';
import { TokenExpiredError, TokenInvalidError } from '../src';

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
        TokenInvalidError
      );
    });

    it('should throw error for expired token', async () => {
      const secret = 'test-secret';
      const token = await generateSignedToken(secret, 1);

      vi.advanceTimersByTime(2000);

      await expect(parseSignedToken(token, secret)).rejects.toThrow(
        TokenExpiredError
      );
    });

    it('should throw error for invalid signature', async () => {
      const token = await generateSignedToken('secret1', 3600);
      await expect(parseSignedToken(token, 'secret2')).rejects.toThrow(
        TokenInvalidError
      );
    });
  });

  describe('signUnsignedToken', () => {
    it('should sign an unsigned token', async () => {
      const unsignedToken = 'test-token';
      const secret = 'test-secret';
      const signedToken = await signUnsignedToken(unsignedToken, secret);

      expect(signedToken).toMatch(/^test-token\.[a-f0-9]+$/);
      expect(signedToken.split('.').length).toBe(2);
    });

    it('should generate different signatures for different secrets', async () => {
      const unsignedToken = 'test-token';
      const signedToken1 = await signUnsignedToken(unsignedToken, 'secret1');
      const signedToken2 = await signUnsignedToken(unsignedToken, 'secret2');

      expect(signedToken1).not.toBe(signedToken2);
    });
  });

  describe('verifySignedToken', () => {
    it('should verify a valid signed token', async () => {
      const unsignedToken = 'test-token';
      const secret = 'test-secret';
      const signedToken = await signUnsignedToken(unsignedToken, secret);

      const verifiedToken = await verifySignedToken(signedToken, secret);
      expect(verifiedToken).toBe(unsignedToken);
    });

    it('should throw error for invalid token format', async () => {
      await expect(verifySignedToken('invalid', 'secret')).rejects.toThrow(
        TokenInvalidError
      );
    });

    it('should throw error for token with wrong number of parts', async () => {
      await expect(
        verifySignedToken('part1.part2.part3', 'secret')
      ).rejects.toThrow('Signed token must have 2 parts');
    });

    it('should throw error for invalid signature', async () => {
      const signedToken = await signUnsignedToken('test-token', 'secret1');
      await expect(verifySignedToken(signedToken, 'secret2')).rejects.toThrow(
        TokenInvalidError
      );
    });

    it('should throw error for empty token parts', async () => {
      await expect(verifySignedToken('.signature', 'secret')).rejects.toThrow(
        'Token parts cannot be empty'
      );
      await expect(verifySignedToken('token.', 'secret')).rejects.toThrow(
        'Token parts cannot be empty'
      );
    });
  });
});
