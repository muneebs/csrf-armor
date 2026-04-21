/**
 * @vitest-environment jsdom
 *
 * Note: `getCsrfToken` returns null in this test environment because
 * `import.meta.client` is only defined by Nuxt at build time, so the CSRF
 * header is not injected. These tests cover the Request/init header merge
 * behavior that issue #49 exposed. The CSRF-precedence assertion is
 * covered by the Next.js client tests, which exercise the same merge logic.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { csrfFetch } from '../src/runtime/utils/client';

describe('csrfFetch (nuxt)', () => {
  beforeEach(() => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('ok', { status: 200 })
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('preserves headers when input is a Request object', async () => {
    const req = new Request('https://example.com/api/data', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Custom': 'keep-me',
      },
    });
    await csrfFetch(req);

    const callArgs = (globalThis.fetch as ReturnType<typeof vi.fn>).mock
      .calls[0];
    const headers = callArgs[1].headers as Headers;
    expect(headers.get('Content-Type')).toBe('application/json');
    expect(headers.get('X-Custom')).toBe('keep-me');
  });

  it('lets init headers override Request headers', async () => {
    const req = new Request('https://example.com/api/data', {
      method: 'POST',
      headers: { 'X-Custom': 'original' },
    });
    await csrfFetch(req, { headers: { 'X-Custom': 'overridden' } });

    const callArgs = (globalThis.fetch as ReturnType<typeof vi.fn>).mock
      .calls[0];
    const headers = callArgs[1].headers as Headers;
    expect(headers.get('X-Custom')).toBe('overridden');
  });

  it('merges init headers alongside Request headers', async () => {
    const req = new Request('https://example.com/api/data', {
      method: 'POST',
      headers: { 'X-From-Request': 'req' },
    });
    await csrfFetch(req, { headers: { 'X-From-Init': 'init' } });

    const callArgs = (globalThis.fetch as ReturnType<typeof vi.fn>).mock
      .calls[0];
    const headers = callArgs[1].headers as Headers;
    expect(headers.get('X-From-Request')).toBe('req');
    expect(headers.get('X-From-Init')).toBe('init');
  });
});
