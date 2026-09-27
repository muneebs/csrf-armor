import { once } from 'node:events';
import { createRequire } from 'node:module';
import express from 'express';
import { describe, expect, it } from 'vitest';
import { csrfMiddleware } from '../src';

// Exercise the parser actually installed beneath Express, not another qs copy.
const expressRequire = createRequire(
  createRequire(import.meta.url).resolve('express')
);
const qs = expressRequire('qs');

describe('Express parser security', () => {
  it('enforces comma array limits for plain and bracketed keys', () => {
    const options = { comma: true, arrayLimit: 3, throwOnLimitExceeded: true };
    for (const key of ['a', 'a[]', 'a%5B%5D']) {
      expect(() => qs.parse(`${key}=1,2,3,4`, options)).toThrow(RangeError);
      expect(() => qs.parse(`${key}=1,2,3`, options)).not.toThrow();
    }
  });

  it('serializes hostile constructor properties without calling them', () => {
    const input = 'x[constructor][isBuffer]=not-a-function';
    for (const options of [{ plainObjects: true }, { allowPrototypes: true }]) {
      const parsed = qs.parse(input, options);
      expect(() => qs.stringify(parsed)).not.toThrow();
    }
    expect(qs.stringify({ a: 'normal value' })).toBe('a=normal%20value');
  });

  it('serializes null and undefined entries in comma arrays', () => {
    for (const value of [null, undefined]) {
      expect(
        qs.stringify(
          { a: [value, 'b'] },
          { arrayFormat: 'comma', encodeValuesOnly: true }
        )
      ).toBe('a=,b');
    }
  });

  it('rejects invalid size limits instead of disabling enforcement', () => {
    for (const parser of [express.json, express.raw, express.text]) {
      expect(() => parser({ limit: 'not-a-size' })).toThrow(TypeError);
      expect(() => parser({ limit: '1kb' })).not.toThrow();
    }
    expect(() =>
      express.urlencoded({ extended: true, limit: 'not-a-size' })
    ).toThrow(TypeError);
  });

  it('preserves form and JSON CSRF validation and rejects malformed or oversized bodies', async () => {
    const app = express();
    app.use(express.urlencoded({ extended: true, limit: '1kb' }));
    app.use(express.json({ limit: '1kb' }));
    app.use(
      csrfMiddleware({
        strategy: 'signed-token',
        secret: 'parser-regression-test-secret-at-least-32-characters',
        token: { fieldName: '_csrf' },
      })
    );
    app.get('/', (req, res) => res.json({ token: req.csrfToken }));
    app.post('/', (req, res) => res.json({ data: req.body.data }));
    app.use(
      (
        error: { status?: number; code?: string },
        _req: express.Request,
        res: express.Response,
        _next: express.NextFunction
      ) => {
        res
          .status(
            error.code === 'CSRF_VERIFICATION_ERROR'
              ? 403
              : (error.status ?? 500)
          )
          .end();
      }
    );

    const server = app.listen(0, '127.0.0.1');
    try {
      await once(server, 'listening');
      const address = server.address();
      if (!address || typeof address === 'string')
        throw new Error('No TCP address');
      const url = `http://127.0.0.1:${address.port}`;
      const { token } = await (await fetch(url)).json();
      for (const [type, body] of [
        ['application/json', JSON.stringify({ _csrf: token, data: 'hello' })],
        [
          'application/x-www-form-urlencoded',
          new URLSearchParams({ _csrf: token, data: 'hello' }).toString(),
        ],
      ]) {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'content-type': type },
          body,
        });
        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({ data: 'hello' });
      }
      for (const [body, status] of [
        ['{', 400],
        [JSON.stringify({ data: 'x'.repeat(2048) }), 413],
        [JSON.stringify({ _csrf: 'invalid', data: 'hello' }), 403],
      ] as const) {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body,
        });
        expect(response.status).toBe(status);
      }
    } finally {
      if (server.listening) {
        server.closeAllConnections();
        await new Promise<void>((resolve, reject) =>
          server.close((error) => (error ? reject(error) : resolve()))
        );
      }
    }
  });
});
