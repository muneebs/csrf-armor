import { createCsrfProtection } from '@csrf-armor/core';
import { H3, H3Event, HTTPError, readBody } from 'h3';
import { describe, expect, it, vi } from 'vitest';
import { NuxtAdapter } from '../src/runtime/server/adapter';

const ORIGIN = 'http://localhost';

/** An h3 v2 app with the adapter as middleware and a route that reads the body. */
function createApp(adapterOptions: { maxBodySize?: number } = {}): H3 {
  const protection = createCsrfProtection<H3Event, H3Event>(
    new NuxtAdapter(adapterOptions),
    { strategy: 'double-submit' }
  );
  const app = new H3();
  app.use(async (event) => {
    const result = await protection.protect(event, event);
    if (!result.success) throw new HTTPError({ status: 403 });
  });
  app.get('/', () => 'ok');
  app.post('/submit', async (event) => ({ body: await readBody(event) }));
  return app;
}

/** Issues a token with a GET and returns it with the matching cookie. */
async function issueToken(app: H3): Promise<{ token: string; cookie: string }> {
  const res = await app.fetch(new Request(`${ORIGIN}/`));
  const token = res.headers.get('x-csrf-token');
  const cookie = res.headers
    .getSetCookie()
    .find((c) => c.startsWith('csrf-token='))
    ?.split(';')[0];
  if (!token || !cookie) throw new Error('no token issued');
  return { token, cookie };
}

/** A request body that streams without a Content-Length header. */
function streamOf(...chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
}

describe('NuxtAdapter with h3 v2', () => {
  it('sets the token header and cookie on the web response', async () => {
    const app = createApp();
    const { token, cookie } = await issueToken(app);

    expect(token).toBeTruthy();
    expect(cookie).toBe(`csrf-token=${encodeURIComponent(token)}`);
  });

  it('accepts a form body token and leaves the body for the route', async () => {
    const app = createApp();
    const { token, cookie } = await issueToken(app);

    const res = await app.fetch(
      new Request(`${ORIGIN}/submit`, {
        method: 'POST',
        headers: {
          cookie,
          'content-type': 'application/x-www-form-urlencoded',
        },
        body: `csrf_token=${encodeURIComponent(token)}&name=test`,
      })
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      body: { csrf_token: token, name: 'test' },
    });
  });

  it('accepts a JSON body token and leaves the body for the route', async () => {
    const app = createApp();
    const { token, cookie } = await issueToken(app);

    const res = await app.fetch(
      new Request(`${ORIGIN}/submit`, {
        method: 'POST',
        headers: { cookie, 'content-type': 'application/json' },
        body: JSON.stringify({ csrf_token: token, data: 'x' }),
      })
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      body: { csrf_token: token, data: 'x' },
    });
  });

  it('rejects a POST without a token', async () => {
    const app = createApp();
    const { cookie } = await issueToken(app);

    const res = await app.fetch(
      new Request(`${ORIGIN}/submit`, {
        method: 'POST',
        headers: { cookie, 'content-type': 'application/json' },
        body: JSON.stringify({ data: 'x' }),
      })
    );

    expect(res.status).toBe(403);
  });

  it('rejects a declared Content-Length over the limit', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const app = createApp({ maxBodySize: 1024 });
    const { token, cookie } = await issueToken(app);

    // The body itself is small and valid: only the declared length rejects it.
    const res = await app.fetch(
      new Request(`${ORIGIN}/submit`, {
        method: 'POST',
        headers: {
          cookie,
          'content-type': 'application/x-www-form-urlencoded',
          'content-length': '1025',
        },
        body: `csrf_token=${encodeURIComponent(token)}&pad=x`,
      })
    );

    expect(res.status).toBe(403);
    vi.restoreAllMocks();
  });

  it('stops reading a streamed body as soon as it passes the limit', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const app = createApp({ maxBodySize: 64 });
    const { token, cookie } = await issueToken(app);

    const res = await app.fetch(
      new Request(`${ORIGIN}/submit`, {
        method: 'POST',
        headers: {
          cookie,
          'content-type': 'application/x-www-form-urlencoded',
        },
        // A valid token followed by padding: only the byte cap rejects it.
        body: streamOf(
          `csrf_token=${encodeURIComponent(token)}&pad=`,
          'x'.repeat(64)
        ),
        duplex: 'half',
      } as RequestInit)
    );

    expect(res.status).toBe(403);
    vi.restoreAllMocks();
  });

  it('accepts a streamed body within the limit', async () => {
    const app = createApp();
    const { token, cookie } = await issueToken(app);

    const res = await app.fetch(
      new Request(`${ORIGIN}/submit`, {
        method: 'POST',
        headers: { cookie, 'content-type': 'application/json' },
        body: streamOf('{"csrf_token":', JSON.stringify(token), '}'),
        duplex: 'half',
      } as RequestInit)
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ body: { csrf_token: token } });
  });

  it('appends cookies without overwriting existing Set-Cookie values', () => {
    const event = new H3Event(new Request(`${ORIGIN}/`));
    event.res.headers.append('set-cookie', 'session=abc');

    new NuxtAdapter().applyResponse(event, {
      headers: new Map([['x-csrf-token', 'tok']]),
      cookies: new Map([
        ['csrf-token', { value: 'tok', options: { path: '/' } }],
      ]),
    });

    expect(event.res.headers.get('x-csrf-token')).toBe('tok');
    expect(event.res.headers.getSetCookie()).toEqual([
      'session=abc',
      'csrf-token=tok; Path=/',
    ]);
  });
});
