import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  generateNonce,
  generateSecureSecret,
  generateSignedToken,
  parseSignedToken,
  signUnsignedToken,
  timingSafeEqual,
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

  describe('timingSafeEqual', () => {
    it('should return true for equal strings', () => {
      expect(timingSafeEqual('hello', 'hello')).toBe(true);
    });

    it('should return false for unequal strings', () => {
      expect(timingSafeEqual('hello', 'world')).toBe(false);
    });

    it('should return false for strings of different lengths', () => {
      expect(timingSafeEqual('short', 'longer-string')).toBe(false);
    });

    it('should return true for empty strings', () => {
      expect(timingSafeEqual('', '')).toBe(true);
    });

    it('should detect a single character difference', () => {
      expect(timingSafeEqual('abcde', 'abcdf')).toBe(false);
    });
  });

  describe('generateSecureSecret', () => {
    it('should return a non-empty string', () => {
      const secret = generateSecureSecret();
      expect(secret).toBeTruthy();
      expect(secret.length).toBeGreaterThan(0);
    });

    it('should return a base64-encoded string', () => {
      const secret = generateSecureSecret();
      expect(secret).toMatch(/^[A-Za-z0-9+/=]+$/);
    });

    it('should generate unique values on each call', () => {
      const secret1 = generateSecureSecret();
      const secret2 = generateSecureSecret();
      expect(secret1).not.toBe(secret2);
    });

    it('should return a string of 44 characters (32 bytes base64-encoded)', () => {
      const secret = generateSecureSecret();
      expect(secret).toHaveLength(44);
    });
  });

  describe('parseSignedToken (edge cases)', () => {
    it('should throw TokenInvalidError with "Invalid expiration timestamp" for non-numeric exp', async () => {
      // "abc" is the expStr — parseInt("abc") is NaN, which is checked BEFORE
      // signature verification in parseSignedToken, so this always throws
      // regardless of the nonce or signature values.
      await expect(
        parseSignedToken('abc.nonce.signature', 'secret')
      ).rejects.toThrow(new TokenInvalidError('Invalid expiration timestamp'));
    });
  });
});
