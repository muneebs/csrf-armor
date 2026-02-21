import { createCsrfProtection, verifySignedToken } from '@csrf-armor/core'
import type { H3Event } from 'h3'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NuxtAdapter } from '../src/runtime/server/adapter'

vi.mock('h3', () => ({
  getMethod: vi.fn(),
  getRequestURL: vi.fn(),
  getHeaders: vi.fn(),
  getHeader: vi.fn(),
  parseCookies: vi.fn(),
  setCookie: vi.fn(),
  setResponseHeader: vi.fn(),
  readBody: vi.fn(),
}))

import {
  getHeader,
  getHeaders,
  getMethod,
  getRequestURL,
  parseCookies,
  setCookie,
  setResponseHeader,
} from 'h3'

const mockedGetMethod = vi.mocked(getMethod)
const mockedGetRequestURL = vi.mocked(getRequestURL)
const mockedGetHeaders = vi.mocked(getHeaders)
const mockedGetHeader = vi.mocked(getHeader)
const mockedParseCookies = vi.mocked(parseCookies)
const mockedSetCookie = vi.mocked(setCookie)
const mockedSetResponseHeader = vi.mocked(setResponseHeader)

/** Creates an H3Event mock with configured h3 function behaviors. */
function createGetEvent(url = 'http://localhost/', headers: Record<string, string> = {}): H3Event {
  const event = {} as unknown as H3Event

  mockedGetMethod.mockReturnValue('GET')
  mockedGetRequestURL.mockReturnValue(new URL(url))
  mockedGetHeaders.mockReturnValue(headers)
  mockedGetHeader.mockImplementation((_e, name) => headers[name as string])
  mockedParseCookies.mockReturnValue({})

  return event
}

function createPostEvent(
  url: string,
  headers: Record<string, string>,
  cookies: Record<string, string>,
): H3Event {
  const event = {} as unknown as H3Event

  mockedGetMethod.mockReturnValue('POST')
  mockedGetRequestURL.mockReturnValue(new URL(url))
  mockedGetHeaders.mockReturnValue(headers)
  mockedGetHeader.mockImplementation((_e, name) => headers[name as string])
  mockedParseCookies.mockReturnValue(cookies)

  return event
}

/** Collects cookies set via setCookie mock calls. */
function getSetCookies(): Record<string, string> {
  const cookies: Record<string, string> = {}
  for (const call of mockedSetCookie.mock.calls) {
    cookies[call[1] as string] = call[2] as string
  }
  return cookies
}

/** Collects response headers set via setResponseHeader mock calls. */
function getResponseHeaders(): Record<string, string> {
  const headers: Record<string, string> = {}
  for (const call of mockedSetResponseHeader.mock.calls) {
    headers[call[1] as string] = call[2] as string
  }
  return headers
}

describe('Nuxt CSRF Middleware Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should allow GET requests without validation', async () => {
    const adapter = new NuxtAdapter()
    const protection = createCsrfProtection(adapter)
    const event = createGetEvent()

    const result = await protection.protect(event, event)

    expect(result.success).toBe(true)
    expect(result.token).toBeDefined()
  })

  it('should set CSRF token header and cookie on GET', async () => {
    const adapter = new NuxtAdapter()
    const protection = createCsrfProtection(adapter)
    const event = createGetEvent()

    await protection.protect(event, event)

    const headers = getResponseHeaders()
    const cookies = getSetCookies()

    expect(headers['x-csrf-token']).toBeDefined()
    expect(cookies['csrf-token']).toBeDefined()
  })

  it('should exclude configured paths from protection', async () => {
    const adapter = new NuxtAdapter()
    const protection = createCsrfProtection(adapter, {
      excludePaths: ['/api/webhook'],
    })

    mockedGetMethod.mockReturnValue('POST')
    mockedGetRequestURL.mockReturnValue(new URL('http://localhost/api/webhook'))
    mockedGetHeaders.mockReturnValue({})
    mockedGetHeader.mockReturnValue(undefined)
    mockedParseCookies.mockReturnValue({})

    const event = {} as unknown as H3Event
    const result = await protection.protect(event, event)

    expect(result.success).toBe(true)
  })

  it('should use custom cookie name', async () => {
    const adapter = new NuxtAdapter()
    const protection = createCsrfProtection(adapter, {
      cookie: { name: 'my-csrf' },
    })

    const event = createGetEvent()
    await protection.protect(event, event)

    const cookies = getSetCookies()
    expect(cookies['my-csrf']).toBeDefined()
  })

  it('should generate unsigned tokens for double-submit strategy', async () => {
    const adapter = new NuxtAdapter()
    const protection = createCsrfProtection(adapter, {
      strategy: 'double-submit',
    })

    const event = createGetEvent()
    const result = await protection.protect(event, event)

    const headers = getResponseHeaders()
    const cookies = getSetCookies()

    expect(headers['x-csrf-token']).toBeDefined()
    expect(cookies['csrf-token']).toBeDefined()
    expect(headers['x-csrf-token']).toBe(cookies['csrf-token'])

    // Unsigned tokens have no dots
    expect(headers['x-csrf-token']!.includes('.')).toBe(false)
  })

  it('should generate signed tokens for signed-double-submit strategy', async () => {
    const secret = 'test-secret-32-characters-long-123'
    const adapter = new NuxtAdapter()
    const protection = createCsrfProtection(adapter, {
      strategy: 'signed-double-submit',
      secret,
    })

    const event = createGetEvent()
    await protection.protect(event, event)

    const headers = getResponseHeaders()
    const cookies = getSetCookies()

    const headerToken = headers['x-csrf-token']
    const clientCookie = cookies['csrf-token']
    const serverCookie = cookies['csrf-token-server']

    expect(headerToken).toBeDefined()
    expect(clientCookie).toBeDefined()
    expect(serverCookie).toBeDefined()

    // Header and client cookie are unsigned and identical
    expect(headerToken).toBe(clientCookie)
    expect(headerToken!.includes('.')).toBe(false)

    // Server cookie is signed (contains a dot)
    expect(serverCookie!.split('.').length).toBe(2)

    // Signed server cookie contains the unsigned token
    const verified = await verifySignedToken(serverCookie!, secret)
    expect(verified).toBe(headerToken)
  })

  it('should validate origin-check POST with correct origin', async () => {
    const adapter = new NuxtAdapter()

    vi.spyOn(adapter, 'extractRequest').mockImplementation(() => ({
      method: 'POST',
      url: 'http://localhost/api',
      headers: new Map([['origin', 'http://localhost']]),
      cookies: new Map(),
      body: undefined,
    }))

    const protection = createCsrfProtection(adapter, {
      strategy: 'origin-check',
      allowedOrigins: ['http://localhost'],
    })

    const event = {} as unknown as H3Event
    const result = await protection.protect(event, event)

    expect(result.success).toBe(true)
  })

  it('should reject origin-check POST with wrong origin', async () => {
    const adapter = new NuxtAdapter()

    vi.spyOn(adapter, 'extractRequest').mockImplementation(() => ({
      method: 'POST',
      url: 'http://localhost/api',
      headers: new Map([['origin', 'http://evil.com']]),
      cookies: new Map(),
      body: undefined,
    }))

    const protection = createCsrfProtection(adapter, {
      strategy: 'origin-check',
      allowedOrigins: ['http://localhost'],
    })

    const event = {} as unknown as H3Event
    const result = await protection.protect(event, event)

    expect(result.success).toBe(false)
  })

  it('should reject POST without token for double-submit', async () => {
    const adapter = new NuxtAdapter()
    const protection = createCsrfProtection(adapter, {
      strategy: 'double-submit',
    })

    const event = createPostEvent(
      'http://localhost/api',
      { 'content-type': 'application/json' },
      {},
    )

    const result = await protection.protect(event, event)

    expect(result.success).toBe(false)
  })
})
