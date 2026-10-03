import { PassThrough } from 'node:stream';
import type { RequiredCsrfConfig } from '@csrf-armor/core';
import { type H3Event, readBody } from 'h3';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_MAX_BODY_SIZE,
  NuxtAdapter,
} from '../src/runtime/server/adapter';

const config = {
  token: { headerName: 'X-CSRF-Token', fieldName: 'csrf_token' },
} as RequiredCsrfConfig;

function makeEvent(
  contentType: string,
  nodeHeaders: Record<string, string> = {}
): { event: H3Event; req: PassThrough } {
  const req = Object.assign(new PassThrough(), { headers: nodeHeaders });
  const event = {
    method: 'POST',
    path: '/api/submit',
    headers: new Headers({ host: 'localhost', 'content-type': contentType }),
    node: { req, res: {} },
  } as unknown as H3Event;
  return { event, req };
}

describe('NuxtAdapter body token extraction limits', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reads a token from a body within the limit', async () => {
    const adapter = new NuxtAdapter();
    const { event, req } = makeEvent('application/x-www-form-urlencoded');
    const request = adapter.extractRequest(event);

    const pending = adapter.getTokenFromRequest(request, config);
    req.end('csrf_token=abc123&name=test');

    await expect(pending).resolves.toBe('abc123');
  });

  it('rejects a declared Content-Length over the limit without reading the body', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const adapter = new NuxtAdapter();
    const { event, req } = makeEvent('application/json', {
      'content-length': String(DEFAULT_MAX_BODY_SIZE + 1),
    });
    const onSpy = vi.spyOn(req, 'on');
    const request = adapter.extractRequest(event);

    // The stream never ends: the call must still settle without reading it.
    await expect(adapter.getTokenFromRequest(request, config)).resolves.toBe(
      undefined
    );
    expect(onSpy).not.toHaveBeenCalledWith('data', expect.anything());
  });

  it('stops buffering a streamed body as soon as it passes the limit', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const adapter = new NuxtAdapter({ maxBodySize: 1024 });
    const { event, req } = makeEvent('text/plain');
    const request = adapter.extractRequest(event);

    const pending = adapter.getTokenFromRequest(request, config);
    // No Content-Length and no end(): only the byte cap can settle this.
    req.write(Buffer.alloc(600, 'a'));
    req.write(Buffer.alloc(600, 'a'));

    await expect(pending).resolves.toBe(undefined);
    expect(req.listenerCount('data')).toBe(0);
    expect(req.isPaused()).toBe(true);
    // A later stream error must not become an uncaught 'error' event.
    expect(req.listenerCount('error')).toBeGreaterThan(0);
    expect(() => req.destroy(new Error('client aborted'))).not.toThrow();
  });

  it('leaves a body it read for the route to read with h3', async () => {
    const adapter = new NuxtAdapter();
    const { event, req } = makeEvent('application/x-www-form-urlencoded', {
      'content-type': 'application/x-www-form-urlencoded',
    });
    const request = adapter.extractRequest(event);

    const pending = adapter.getTokenFromRequest(request, config);
    req.end('csrf_token=abc123&name=test');
    await expect(pending).resolves.toBe('abc123');

    // The stream has ended, so without the cached body this would never settle.
    await expect(readBody(event)).resolves.toEqual({
      csrf_token: 'abc123',
      name: 'test',
    });
  });

  it('leaves a JSON body it read for the route to read with h3', async () => {
    const adapter = new NuxtAdapter();
    const { event, req } = makeEvent('application/json', {
      'content-type': 'application/json',
    });
    const request = adapter.extractRequest(event);

    const pending = adapter.getTokenFromRequest(request, config);
    req.end(JSON.stringify({ csrf_token: 'abc123', data: 'x' }));
    await expect(pending).resolves.toBe('abc123');

    await expect(readBody(event)).resolves.toEqual({
      csrf_token: 'abc123',
      data: 'x',
    });
  });

  it('accepts a body exactly at the limit', async () => {
    const adapter = new NuxtAdapter({ maxBodySize: 64 });
    const { event, req } = makeEvent('application/x-www-form-urlencoded');
    const request = adapter.extractRequest(event);
    const body = 'csrf_token=tok&pad='.padEnd(64, 'x');

    const pending = adapter.getTokenFromRequest(request, config);
    req.end(body);

    await expect(pending).resolves.toBe('tok');
  });
});
