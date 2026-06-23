import { describe, expect, it, vi } from 'vitest';
import {
  generateNonce,
  generateSecureSecret,
  generateSignedToken,
  getWebCrypto,
  parseSignedToken,
  signUnsignedToken,
  verifySignedToken,
} from '../src/crypto.js';
import { WeakSecretError } from '../src/errors.js';

const SECRET = 'this-is-a-32-character-test-secret-key';

describe('generateSecureSecret', () => {
  it('generates secrets of the requested length', () => {
    expect(generateSecureSecret(32).length).toBe(44); // base64 of 32 bytes
  });

  it('throws on weak secret lengths', () => {
    expect(() => generateSecureSecret(31)).toThrow(WeakSecretError);
  });
});

describe('generateSignedToken', () => {
  it('produces a v2 token with 4 or 5 parts', async () => {
    const token = await generateSignedToken(SECRET, 3600);
    const parts = token.split('.');
    expect(parts[0]).toBe('v2');
    expect(parts.length).toBeGreaterThanOrEqual(4);
  });

  it('includes a session hash when sessionId is provided', async () => {
    const token = await generateSignedToken(SECRET, 3600, 'session-123');
    const parts = token.split('.');
    // v2.exp.nonce.sidHash.sig => 5 parts
    expect(parts.length).toBe(5);
  });

  it('rejects tokens with a weak secret', async () => {
    await expect(generateSignedToken('short', 3600)).rejects.toThrow(
      WeakSecretError
    );
  });
});

describe('parseSignedToken', () => {
  it('round-trips token payload', async () => {
    const token = await generateSignedToken(SECRET, 3600, 'session-123');
    const parsed = await parseSignedToken(token, SECRET);
    expect(parsed.ver).toBe(2);
    expect(parsed.sidHash).toBeDefined();
  });

  it('rejects malformed tokens', async () => {
    await expect(parseSignedToken('not-a-token', SECRET)).rejects.toThrow();
  });

  it('rejects tokens signed with a different secret', async () => {
    const token = await generateSignedToken(SECRET, 3600);
    await expect(parseSignedToken(token, 'different-32-character-secret-key')).rejects.toThrow();
  });

  it('accepts tokens signed with a previous secret', async () => {
    const previousSecret = 'previous-32-character-secret-key-!!';
    const token = await generateSignedToken(previousSecret, 3600);
    const parsed = await parseSignedToken(token, SECRET, [previousSecret]);
    expect(parsed.ver).toBe(2);
  });
});

describe('verifySignedToken', () => {
  it('returns the unsigned payload for a signed-double-submit server token', async () => {
    const unsigned = 'a'.repeat(32);
    const signed = await signUnsignedToken(unsigned, SECRET);
    const verified = await verifySignedToken(signed, SECRET);
    expect(verified).toBe(unsigned);
  });
});

describe('getWebCrypto', () => {
  it('returns the global crypto object in Node 18+', () => {
    expect(getWebCrypto()).toBe(globalThis.crypto);
  });
});

describe('generateNonce', () => {
  it('produces URL-safe base64 strings', () => {
    const nonce = generateNonce(24);
    expect(nonce).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(Buffer.from(nonce, 'base64url').length).toBe(24);
  });
});
