/**
 * @fileoverview Cryptographic utilities for CSRF token generation and validation.
 *
 * This module provides secure cryptographic functions for creating and verifying
 * CSRF tokens using Web Crypto API. All functions use native constant-time
 * operations (`crypto.subtle.verify()`) and strong cryptographic primitives.
 */

import {
  CryptoUnavailableError,
  TokenExpiredError,
  TokenInvalidError,
  WeakSecretError,
} from './errors.js';
import type { TokenPayload } from './types.js';

const TOKEN_VERSION = 2;
const TOKEN_VERSION_PREFIX = 'v2';
const MIN_SECRET_LENGTH = 32;

/** Ensure Web Crypto API is available. */
export function assertWebCrypto(): void {
  if (typeof globalThis === 'undefined' || !globalThis.crypto?.subtle) {
    throw new CryptoUnavailableError();
  }
}

/** Returns the global Web Crypto API object. */
export function getWebCrypto(): Crypto {
  assertWebCrypto();
  return globalThis.crypto;
}

/** Validate that a secret meets minimum strength requirements. */
export function validateSecret(secret: string): void {
  if (secret.length < MIN_SECRET_LENGTH) {
    throw new WeakSecretError();
  }
}

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

  private async fingerprint(secret: string): Promise<string> {
    const data = this.encoder.encode(secret);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hash), (byte) =>
      byte.toString(16).padStart(2, '0')
    ).join('');
  }

  async getCachedKey(secret: string): Promise<CryptoKey> {
    const fingerprint = await this.fingerprint(secret);
    const cached = this.keyCache.get(fingerprint);

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
      ['sign', 'verify']
    );

    this.keyCache.set(fingerprint, { key, lastUsed: Date.now() });
    return key;
  }

  clear(): void {
    this.keyCache.clear();
  }
}

/**
 * Generates a SHA-256 fingerprint of a secret string.
 *
 * @internal
 */
export async function hashSecretFingerprint(secret: string): Promise<string> {
  assertWebCrypto();
  const encoder = new TextEncoder();
  const hash = await crypto.subtle.digest('SHA-256', encoder.encode(secret));
  return Array.from(new Uint8Array(hash), (byte) =>
    byte.toString(16).padStart(2, '0')
  ).join('');
}

/**
 * Generates a SHA-256 hash of a session ID.
 *
 * @internal
 */
export async function hashSessionId(sessionId: string): Promise<string> {
  assertWebCrypto();
  const encoder = new TextEncoder();
  const hash = await crypto.subtle.digest('SHA-256', encoder.encode(sessionId));
  return Array.from(new Uint8Array(hash), (byte) =>
    byte.toString(16).padStart(2, '0')
  ).join('');
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

/**
 * Generates a cryptographically secure random nonce.
 *
 * @public
 * @param length - Length of the nonce in bytes (default: 16 bytes = 24 base64url chars)
 * @returns URL-safe base64 string representing the random nonce
 */
export function generateNonce(length = 16): string {
  assertWebCrypto();
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes);
}

/**
 * Generates a cryptographically secure secret key.
 *
 * @internal
 * @returns Base64-encoded random secret key (32 bytes)
 */
export function generateSecureSecret(length = 32): string {
  assertWebCrypto();
  if (length < MIN_SECRET_LENGTH) {
    throw new WeakSecretError();
  }
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

/**
 * Signs a payload with HMAC-SHA256 and returns a lowercase hex signature.
 */
async function signPayload(payload: string, secret: string): Promise<string> {
  assertWebCrypto();
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

/**
 * Verifies a payload signature using `crypto.subtle.verify()`.
 *
 * Native constant-time verification; no custom timing-safe comparison needed.
 */
async function verifyPayload(
  payload: string,
  signature: string,
  secret: string
): Promise<boolean> {
  assertWebCrypto();
  const keyCache = CryptoKeyCache.getInstance();
  const key = await keyCache.getCachedKey(secret);

  const encoder = new TextEncoder();
  const messageData = encoder.encode(payload);

  const sigLen = signature.length;
  const signatureBuffer = new Uint8Array(sigLen / 2);
  for (let i = 0; i < sigLen; i += 2) {
    signatureBuffer[i / 2] = Number.parseInt(signature.slice(i, i + 2), 16);
  }

  return crypto.subtle.verify('HMAC', key, signatureBuffer, messageData);
}

/**
 * Builds a signed token payload string from components.
 *
 * For v2 tokens: `v2.{exp}.{nonce}.{sig}` or `v2.{exp}.{nonce}.{sidHash}.{sig}`.
 */
function buildTokenPayload(
  exp: number,
  nonce: string,
  sidHash?: string
): string {
  if (sidHash) {
    return `${TOKEN_VERSION_PREFIX}.${exp}.${nonce}.${sidHash}`;
  }
  return `${TOKEN_VERSION_PREFIX}.${exp}.${nonce}`;
}

/**
 * Generates a cryptographically signed CSRF token with optional session binding.
 *
 * @public
 * @param secret - Secret key for HMAC signing (must be at least 32 characters)
 * @param expirySeconds - Token validity duration in seconds from now
 * @param sessionId - Optional session ID to bind the token to
 * @returns Promise resolving to the signed token string
 */
export async function generateSignedToken(
  secret: string,
  expirySeconds: number,
  sessionId?: string
): Promise<string> {
  validateSecret(secret);
  const timestamp = Math.floor(Date.now() / 1000);
  const exp = timestamp + expirySeconds;
  const nonce = generateNonce();

  let sidHash: string | undefined;
  if (sessionId) {
    sidHash = await hashSessionId(sessionId);
  }

  const payload = buildTokenPayload(exp, nonce, sidHash);
  const signature = await signPayload(payload, secret);

  return `${payload}.${signature}`;
}

/**
 * Parses a signed CSRF token without verifying the signature.
 *
 * @internal
 */
export function parseTokenParts(token: string): {
  payload: string;
  signature: string;
  exp: number;
  nonce: string;
  sidHash?: string | undefined;
  version: number;
} {
  const parts = token.split('.');
  if (parts.length < 4 || parts.length > 5) {
    throw new TokenInvalidError(
      `Token must have 4 or 5 dot-separated parts, got ${parts.length}`
    );
  }

  const [versionPrefix, expStr, nonce, maybeSidHash, maybeSignature] = parts;

  const hasSidHash = parts.length === 5;
  const sidHash = hasSidHash ? maybeSidHash : undefined;
  const signature = hasSidHash ? maybeSignature : maybeSidHash;

  if (
    versionPrefix !== TOKEN_VERSION_PREFIX ||
    !expStr ||
    !nonce ||
    !signature ||
    (hasSidHash && !sidHash)
  ) {
    throw new TokenInvalidError('Malformed token');
  }

  const exp = Number.parseInt(expStr, 10);
  if (Number.isNaN(exp)) {
    throw new TokenInvalidError('Invalid expiration timestamp');
  }

  const payload = buildTokenPayload(exp, nonce, sidHash);
  return { payload, signature, exp, nonce, sidHash, version: TOKEN_VERSION };
}

/**
 * Verifies a raw token against a list of secrets, returning the parsed payload.
 *
 * Tries `secret` first, then `previousSecrets` in order. Signature is verified
 * before expiry to avoid error-type oracles.
 *
 * @internal
 */
export async function verifySignedTokenWithSecrets(
  token: string,
  secret: string,
  previousSecrets: readonly string[] = []
): Promise<TokenPayload> {
  const { payload, signature, exp, nonce, sidHash } = parseTokenParts(token);

  const secrets = [secret, ...previousSecrets];
  let signatureValid = false;

  for (const candidate of secrets) {
    if (candidate.length < MIN_SECRET_LENGTH) continue;
    if (await verifyPayload(payload, signature, candidate)) {
      signatureValid = true;
      break;
    }
  }

  if (!signatureValid) {
    throw new TokenInvalidError('Invalid signature');
  }

  const currentTime = Math.floor(Date.now() / 1000);
  if (currentTime > exp) {
    throw new TokenExpiredError();
  }

  return { ver: TOKEN_VERSION, exp, nonce, sidHash };
}

/**
 * Parses and validates a signed CSRF token.
 *
 * @public
 * @param token - The signed token string to parse
 * @param secret - Secret key used for signature verification
 * @param previousSecrets - Previous secrets accepted during key rotation
 * @returns Promise resolving to the validated token payload
 */
export async function parseSignedToken(
  token: string,
  secret: string,
  previousSecrets: readonly string[] = []
): Promise<TokenPayload> {
  return verifySignedTokenWithSecrets(token, secret, previousSecrets);
}

/**
 * Signs an existing unsigned token with HMAC-SHA256.
 *
 * @public
 * @param unsignedToken - The token string to sign
 * @param secret - Secret key for HMAC signing
 * @returns Promise resolving to the signed token
 */
export async function signUnsignedToken(
  unsignedToken: string,
  secret: string
): Promise<string> {
  validateSecret(secret);
  const signature = await signPayload(unsignedToken, secret);
  return `${unsignedToken}.${signature}`;
}

/**
 * Verifies a signed token and extracts the original unsigned token.
 *
 * @public
 * @param signedToken - The signed token to verify (format: `{token}.{signature}`)
 * @param secret - Secret key used for signature verification
 * @param previousSecrets - Previous secrets accepted during key rotation
 * @returns Promise resolving to the original unsigned token
 */
export async function verifySignedToken(
  signedToken: string,
  secret: string,
  previousSecrets: readonly string[] = []
): Promise<string> {
  const parts = signedToken.split('.');
  if (parts.length !== 2) {
    throw new TokenInvalidError('Signed token must have 2 parts');
  }

  const [unsignedToken, signature] = parts;

  if (!unsignedToken || !signature) {
    throw new TokenInvalidError('Token parts cannot be empty');
  }

  const secrets = [secret, ...previousSecrets];
  let signatureValid = false;

  for (const candidate of secrets) {
    if (candidate.length < MIN_SECRET_LENGTH) continue;
    if (await verifyPayload(unsignedToken, signature, candidate)) {
      signatureValid = true;
      break;
    }
  }

  if (!signatureValid) {
    throw new TokenInvalidError('Invalid signature');
  }

  return unsignedToken;
}

/**
 * Timing-safe comparison helper for non-cryptographic string equality.
 *
 * Retained for double-submit style comparisons where both values are
 * public-facing tokens. Cryptographic signature verification is done via
 * `crypto.subtle.verify()` instead.
 *
 * @public
 */
export function timingSafeEqual(a: string, b: string): boolean {
  const len = Math.max(a.length, b.length);
  let result = a.length ^ b.length;

  for (let i = 0; i < len; i++) {
    const aCode = i < a.length ? a.charCodeAt(i) : 0;
    const bCode = i < b.length ? b.charCodeAt(i) : 0;
    result |= aCode ^ bCode;
  }

  return result === 0;
}

/**
 * Clears the internal CryptoKey cache.
 *
 * Useful in tests and long-running processes that rotate secrets.
 *
 * @public
 */
export function clearCryptoKeyCache(): void {
  CryptoKeyCache.getInstance().clear();
}

/**
 * Minimum required secret length.
 *
 * @public
 */
export const MIN_REQUIRED_SECRET_LENGTH = MIN_SECRET_LENGTH;

/**
 * Current token format version number.
 *
 * @public
 */
export const TOKEN_VERSION_VALUE = TOKEN_VERSION;
