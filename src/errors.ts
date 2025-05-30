export class CsrfError extends Error {
	constructor(
		message: string,
		public readonly code: string,
		public readonly statusCode: number = 403,
	) {
		super(message);
		this.name = 'CsrfError';
	}
}

export class TokenExpiredError extends CsrfError {
	constructor() {
		super('CSRF token has expired', 'TOKEN_EXPIRED');
	}
}

export class TokenInvalidError extends CsrfError {
	constructor(reason = 'Invalid token format') {
		super(`CSRF token is invalid: ${reason}`, 'TOKEN_INVALID');
	}
}

export class OriginMismatchError extends CsrfError {
	constructor(origin: string) {
		super(`Origin "${origin}" is not allowed`, 'ORIGIN_MISMATCH');
	}
}
