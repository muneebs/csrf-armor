import { Readable } from 'node:stream';
import type { H3Event } from 'h3';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearCsrfSessionResolver,
  defineCsrfSessionResolver,
} from '../src/runtime/server/session';

const runtime = vi.hoisted(() => ({
  config: undefined as Record<string, unknown> | undefined,
}));

vi.mock('#imports', () => ({
  defineEventHandler: <T>(handler: T) => handler,
  useRuntimeConfig: () => ({ csrfArmor: runtime.config }),
}));

const SECRET = 'test-secret-32-characters-long-123'; // gitleaks:allow

type Handler = (event: H3Event) => Promise<void>;

/** Imports a fresh middleware so its protection singleton starts empty. */
async function loadMiddleware(): Promise<Handler> {
  vi.resetModules();
  return (await import('../src/runtime/server/middleware')).default as Handler;
}

function makeEvent(
  method: string,
  headers: Record<string, string> = {}
): H3Event {
  const resHeaders: Record<string, string | string[]> = {};
  const req = new Readable({ read() {} });
  req.push(null);
  return {
    method,
    path: '/api/data',
    headers: new Headers({ host: 'localhost', ...headers }),
    node: {
      req,
      res: {
        setHeader: (name: string, value: string | string[]) => {
          resHeaders[name.toLowerCase()] = value;
        },
        getHeader: (name: string) => resHeaders[name.toLowerCase()],
      },
    },
    context: {},
  } as unknown as H3Event;
}

/** Reads the CSRF cookie pair a response set, as a Cookie header value. */
function issuedCookies(event: H3Event): { token: string; cookie: string } {
  const raw = event.node.res.getHeader('set-cookie');
  const lines = Array.isArray(raw) ? raw : [String(raw)];
  const pairs = lines.map((line) => String(line).split(';')[0] ?? '');
  const token = decodeURIComponent(
    pairs.find((p) => p.startsWith('csrf-token='))?.split('=')[1] ?? ''
  );
  return { token, cookie: pairs.join('; ') };
}

const sessionFromHeader = (event: H3Event) =>
  event.headers.get('x-test-session') ?? undefined;

describe('Nuxt session binding', () => {
  beforeEach(() => {
    runtime.config = { secret: SECRET };
    clearCsrfSessionResolver();
  });

  afterEach(() => {
    clearCsrfSessionResolver();
  });

  async function issue(handler: Handler, session?: string) {
    const event = makeEvent(
      'GET',
      session ? { 'x-test-session': session } : {}
    );
    await handler(event);
    return issuedCookies(event);
  }

  function submit(
    handler: Handler,
    pair: { token: string; cookie: string },
    session?: string
  ) {
    return handler(
      makeEvent('POST', {
        'x-csrf-token': pair.token,
        cookie: pair.cookie,
        ...(session ? { 'x-test-session': session } : {}),
      })
    );
  }

  it('accepts a pair in the session it was issued to', async () => {
    defineCsrfSessionResolver(sessionFromHeader);
    const handler = await loadMiddleware();
    const pair = await issue(handler, 'session-a');

    await expect(submit(handler, pair, 'session-a')).resolves.toBeUndefined();
  });

  it('rejects a matching pair from another session with 403', async () => {
    defineCsrfSessionResolver(sessionFromHeader);
    const handler = await loadMiddleware();
    const attackerPair = await issue(handler, 'attacker-session');

    await expect(
      submit(handler, attackerPair, 'victim-session')
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('supports async resolvers', async () => {
    defineCsrfSessionResolver(async (event) => sessionFromHeader(event));
    const handler = await loadMiddleware();
    const pair = await issue(handler, 'session-a');

    await expect(submit(handler, pair, 'session-a')).resolves.toBeUndefined();
    await expect(submit(handler, pair, 'session-b')).rejects.toMatchObject({
      statusCode: 403,
    });
  });

  it('leaves tokens unbound when no resolver is registered', async () => {
    const handler = await loadMiddleware();
    const pair = await issue(handler, 'session-a');

    // Opt-in: existing apps keep working exactly as before.
    await expect(submit(handler, pair, 'session-b')).resolves.toBeUndefined();
  });

  it('fails closed when sessionBinding is required but no resolver is registered', async () => {
    runtime.config = { secret: SECRET, sessionBinding: true };
    const handler = await loadMiddleware();

    await expect(handler(makeEvent('GET'))).rejects.toThrow(
      /no session resolver is registered/
    );
    // Still failing on later requests: nothing was cached.
    await expect(handler(makeEvent('GET'))).rejects.toThrow(
      /no session resolver is registered/
    );
  });

  it('does not pass sessionBinding through to core config', async () => {
    runtime.config = { secret: SECRET, sessionBinding: true };
    defineCsrfSessionResolver(sessionFromHeader);
    const handler = await loadMiddleware();
    const pair = await issue(handler, 'session-a');

    await expect(submit(handler, pair, 'session-a')).resolves.toBeUndefined();
  });
});
