import { describe, expect, it } from 'vitest';
import { CsrfError, TokenExpiredError, TokenInvalidError, OriginMismatchError } from '../src';

describe('CsrfError', () => {
  it('instantiates with message, code, and statusCode', () => {
    const err = new CsrfError('Something went wrong', 'SOME_CODE', 400);
    expect(err.message).toBe('Something went wrong');
    expect(err.code).toBe('SOME_CODE');
    expect(err.statusCode).toBe(400);
  });

  it('sets name to "CsrfError"', () => {
    const err = new CsrfError('msg', 'CODE');
    expect(err.name).toBe('CsrfError');
  });

  it('defaults statusCode to 403', () => {
    const err = new CsrfError('msg', 'CODE');
    expect(err.statusCode).toBe(403);
  });

  it('is an instance of Error', () => {
    const err = new CsrfError('msg', 'CODE');
    expect(err).toBeInstanceOf(Error);
  });
});

describe('TokenExpiredError', () => {
  it('has the correct message', () => {
    const err = new TokenExpiredError();
    expect(err.message).toBe('CSRF token has expired');
  });

  it('has the correct code', () => {
    const err = new TokenExpiredError();
    expect(err.code).toBe('TOKEN_EXPIRED');
  });

  it('has the default statusCode of 403', () => {
    const err = new TokenExpiredError();
    expect(err.statusCode).toBe(403);
  });

  it('is an instance of CsrfError', () => {
    const err = new TokenExpiredError();
    expect(err).toBeInstanceOf(CsrfError);
  });

  it('is an instance of Error', () => {
    const err = new TokenExpiredError();
    expect(err).toBeInstanceOf(Error);
  });
});

describe('TokenInvalidError', () => {
  it('uses the default reason when none is provided', () => {
    const err = new TokenInvalidError();
    expect(err.message).toBe('CSRF token is invalid: Invalid token format');
  });

  it('uses a custom reason when provided', () => {
    const err = new TokenInvalidError('signature mismatch');
    expect(err.message).toBe('CSRF token is invalid: signature mismatch');
  });

  it('has the correct code', () => {
    const err = new TokenInvalidError();
    expect(err.code).toBe('TOKEN_INVALID');
  });

  it('is an instance of CsrfError', () => {
    const err = new TokenInvalidError();
    expect(err).toBeInstanceOf(CsrfError);
  });

  it('is an instance of Error', () => {
    const err = new TokenInvalidError();
    expect(err).toBeInstanceOf(Error);
  });
});

describe('OriginMismatchError', () => {
  it('includes the origin in the message', () => {
    const err = new OriginMismatchError('https://evil.example.com');
    expect(err.message).toBe('Origin "https://evil.example.com" is not allowed');
  });

  it('has the correct code', () => {
    const err = new OriginMismatchError('https://evil.example.com');
    expect(err.code).toBe('ORIGIN_MISMATCH');
  });

  it('is an instance of CsrfError', () => {
    const err = new OriginMismatchError('https://evil.example.com');
    expect(err).toBeInstanceOf(CsrfError);
  });

  it('is an instance of Error', () => {
    const err = new OriginMismatchError('https://evil.example.com');
    expect(err).toBeInstanceOf(Error);
  });
});
