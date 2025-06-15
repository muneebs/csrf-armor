/**
 * @fileoverview Cryptographic utilities for CSRF token generation and validation.
 *
 * This module provides secure cryptographic functions for creating and verifying
 * CSRF tokens using Web Crypto API. All functions use timing-safe operations
 * and strong cryptographic primitives to prevent timing attacks and ensure
 * token security.
 */

import { TokenExpiredError, TokenInvalidError } from './errors.js';
import type { TokenPayload } from './types.js';

class CryptoKeyCache {
  private static instance: CryptoKeyCache;
  private readonly keyCache = new Map<
    string,
    { key: CryptoKey; lastUsed: number }
  >();
  private readonly MAX_CACHE_SIZE = 10;
  private readonly encoder = new TextEncoder();

  static getInstance(): CryptoKeyCache {
    if (!CryptoKeyCache.instance) {
      CryptoKeyCache.instance = new CryptoKeyCache();
    }
    return CryptoKeyCache.instance;
  }

  async getCachedKey(secret: string): Promise<CryptoKey> {
    const cached = this.keyCache.get(secret);

    if (cached) {
      cached.lastUsed = Date.now();
      return cached.key;
    }

    if (this.keyCache.size >= this.MAX_CACHE_SIZE) {
      let oldestKey = '';
      let oldestTime = Date.now();

      for (const [key, { lastUsed }] of this.keyCache.entries()) {
        if (lastUsed < oldestTime) {
          oldestTime = lastUsed;
          oldestKey = key;
        }
      }

      if (oldestKey) {
        this.keyCache.delete(oldestKey);
      }
    }

    const keyBuffer = this.encoder.encode(secret);
    const key = await crypto.subtle.importKey(
      'raw',
      keyBuffer,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    this.keyCache.set(secret, { key, lastUsed: Date.now() });
    return key;
  }
}

/**
 * Generates a cryptographically secure random nonce as a hexadecimal string.
 *
 * @param length - Number of random bytes to generate for the nonce (default: 16).
 * @returns A hexadecimal string representing the random nonce.
 *
 * @example
 * const nonce = generateNonce(); // e.g., "a1b2c3d4e5f67890abcd1234ef567890"
 * const shortNonce = generateNonce(8); // e.g., "a1b2c3d4e5f67890"
 */
export function generateNonce(length = 16): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join(
    ''
  );
}

/**
 * Generates a cryptographically secure random secret key for HMAC operations.
 *
 * @returns A random secret key as a string.
 *
 * @remark The returned string is not base64-encoded; it is the result of `Uint8Array.toString()`, which produces a comma-separated list of byte values. For persistent or production use, supply a consistent, securely generated secret instead.
 */
export function generateSecureSecret(): string {
  return crypto.getRandomValues(new Uint8Array(16)).toString();
}

/**
 * Generates a cryptographically signed CSRF token containing an expiration timestamp and a random nonce.
 *
 * The returned token is formatted as `{expiration}.{nonce}.{signature}`, where the signature is an HMAC-SHA256 of the payload using the provided secret.
 *
 * @param secret - The secret key used for HMAC signing; must be consistent for token verification.
 * @param expirySeconds - Number of seconds from now until the token expires.
 * @returns A promise that resolves to the signed CSRF token string.
 *
 * @example
 * // Generate a token valid for 1 hour
 * const token = await generateSignedToken('my-secret-key', 3600);
 *
 * @throws {Error} If the Web Crypto API is unavailable or signing fails.
 */
export async function generateSignedToken(
  secret: string,
  expirySeconds: number
): Promise<string> {
  const timestamp = Math.floor(Date.now() / 1000);
  const exp = timestamp + expirySeconds;
  const nonce = generateNonce();

  const payload = `${exp}.${nonce}`;
  const signature = await signPayload(payload, secret);

  return `${payload}.${signature}`;
}

/**
 * Parses and validates a signed CSRF token, ensuring its integrity and expiration.
 *
 * Splits the token into expiration timestamp, nonce, and signature, verifies the signature using HMAC-SHA256 and timing-safe comparison, and checks that the token has not expired.
 *
 * @param token - The signed CSRF token string to validate.
 * @param secret - The secret key used for signature verification.
 * @returns A promise that resolves to the token payload containing the expiration timestamp and nonce.
 *
 * @throws {TokenInvalidError} If the token format is invalid or signature verification fails.
 * @throws {TokenExpiredError} If the token has expired.
 */
export async function parseSignedToken(
  token: string,
  secret: string
): Promise<TokenPayload> {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new TokenInvalidError('Token must have 3 parts');
  }

  const [expStr, nonce, signature] = parts;

  if (!expStr || !nonce || !signature) {
    throw new TokenInvalidError('Token parts cannot be empty');
  }

  const exp = Number.parseInt(expStr, 10);

  if (Number.isNaN(exp)) {
    throw new TokenInvalidError('Invalid expiration timestamp');
  }

  const payload = `${expStr}.${nonce}`;
  const expectedSignature = await signPayload(payload, secret);

  if (!timingSafeEqual(signature, expectedSignature)) {
    throw new TokenInvalidError('Invalid signature');
  }

  const currentTime = Math.floor(Date.now() / 1000);
  if (currentTime > exp) {
    throw new TokenExpiredError();
  }

  return { exp, nonce };
}

/**
 * Signs a plain token string with HMAC-SHA256 and returns the signed token.
 *
 * Appends a cryptographic signature to the input token, producing a string in the format `{token}.{signature}`.
 *
 * @param unsignedToken - The token string to be signed.
 * @param secret - The secret key used for HMAC signing.
 * @returns A promise that resolves to the signed token string.
 */
export async function signUnsignedToken(
  unsignedToken: string,
  secret: string
): Promise<string> {
  const signature = await signPayload(unsignedToken, secret);
  return `${unsignedToken}.${signature}`;
}

/**
 * Verifies the HMAC-SHA256 signature of a signed token and returns the original unsigned token.
 *
 * Uses timing-safe comparison to prevent timing attacks during signature verification.
 *
 * @param signedToken - The signed token in the format `{token}.{signature}`.
 * @param secret - The secret key used for signature verification.
 * @returns A promise that resolves to the original unsigned token if verification succeeds.
 *
 * @throws {TokenInvalidError} If the token format is invalid or the signature does not match.
 */
export async function verifySignedToken(
  signedToken: string,
  secret: string
): Promise<string> {
  const parts = signedToken.split('.');
  if (parts.length !== 2) {
    throw new TokenInvalidError('Signed token must have 2 parts');
  }

  const [unsignedToken, signature] = parts;

  if (!unsignedToken || !signature) {
    throw new TokenInvalidError('Token parts cannot be empty');
  }

  const expectedSignature = await signPayload(unsignedToken, secret);

  if (!timingSafeEqual(signature, expectedSignature)) {
    throw new TokenInvalidError('Invalid signature');
  }

  return unsignedToken;
}

async function signPayload(payload: string, secret: string): Promise<string> {
  const keyCache = CryptoKeyCache.getInstance();
  const key = await keyCache.getCachedKey(secret);

  const encoder = new TextEncoder();
  const messageData = encoder.encode(payload);

  const signature = await crypto.subtle.sign('HMAC', key, messageData);
  const signatureArray = new Uint8Array(signature);
  return Array.from(signatureArray, (byte) =>
    byte.toString(16).padStart(2, '0')
  ).join('');
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return result === 0;
}
