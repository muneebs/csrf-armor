import { TokenExpiredError, TokenInvalidError } from './errors.js';
import type { TokenPayload } from './types.js';

export function generateNonce(length = 16): string {
	const bytes = new Uint8Array(length);
	crypto.getRandomValues(bytes);
	return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join(
		'',
	);
}

export async function generateSignedToken(
	secret: string,
	expirySeconds: number,
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
	secret: string,
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

export async function hashToken(token: string): Promise<string> {
	const encoder = new TextEncoder();
	const data = encoder.encode(token);
	const hashBuffer = await crypto.subtle.digest('SHA-256', data);
	const hashArray = new Uint8Array(hashBuffer);
	return Array.from(hashArray, (byte) =>
		byte.toString(16).padStart(2, '0'),
	).join('');
}

async function signPayload(payload: string, secret: string): Promise<string> {
	const encoder = new TextEncoder();
	const keyData = encoder.encode(secret);
	const messageData = encoder.encode(payload);

	const key = await crypto.subtle.importKey(
		'raw',
		keyData,
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign'],
	);

	const signature = await crypto.subtle.sign('HMAC', key, messageData);
	const signatureArray = new Uint8Array(signature);
	return Array.from(signatureArray, (byte) =>
		byte.toString(16).padStart(2, '0'),
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
