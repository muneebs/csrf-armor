import { TokenExpiredError, TokenInvalidError } from './errors.js';
import type { TokenPayload } from './types.js';

class CryptoKeyCache {
  private static instance: CryptoKeyCache;
  private readonly keyCache = new Map<string, { key: CryptoKey; lastUsed: number }>();
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

export function generateNonce(length = 16): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join(
    ''
  );
}

export function generateSecureSecret(): string {
  return crypto.getRandomValues(new Uint8Array(16)).toString();
}

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

export async function signUnsignedToken(
  unsignedToken: string,
  secret: string
): Promise<string> {
  const signature = await signPayload(unsignedToken, secret);
  return `${unsignedToken}.${signature}`;
}

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
