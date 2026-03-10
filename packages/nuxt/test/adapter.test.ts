import type {
  CookieOptions,
  CsrfRequest,
  CsrfResponse,
  RequiredCsrfConfig,
} from '@csrf-armor/core'
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
  readBody,
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
const mockedReadBody = vi.mocked(readBody)

/** Creates a minimal H3Event mock for testing purposes. */
function createMockEvent(overrides?: Record<string, unknown>): H3Event {
  return { ...overrides } as unknown as H3Event
}

describe('NuxtAdapter', () => {
  let adapter: NuxtAdapter

  beforeEach(() => {
    vi.clearAllMocks()
    adapter = new NuxtAdapter()
  })

  describe('extractRequest', () => {
    it('should extract request data correctly', () => {
      const mockEvent = createMockEvent()

      mockedGetMethod.mockReturnValue('POST')
      mockedGetRequestURL.mockReturnValue(new URL('http://localhost/api'))
      mockedGetHeaders.mockReturnValue({
        'content-type': 'application/json',
        'x-csrf-token': 'test-token',
      })
      mockedParseCookies.mockReturnValue({
        'csrf-token': 'test-token',
        'session-id': 'test-session',
      })

      const result = adapter.extractRequest(mockEvent)

      expect(result.method).toBe('POST')
      expect(result.url).toBe('http://localhost/api')

      const headersMap = result.headers as Map<string, string>
      expect(headersMap.get('content-type')).toBe('application/json')
      expect(headersMap.get('x-csrf-token')).toBe('test-token')

      const cookiesMap = result.cookies as Map<string, string>
      expect(cookiesMap.get('csrf-token')).toBe('test-token')
      expect(cookiesMap.get('session-id')).toBe('test-session')

      expect(result.body).toBe(mockEvent)
    })
  })

  describe('applyResponse', () => {
    it('should apply headers and cookies from Map correctly', () => {
      const mockEvent = createMockEvent()

      const csrfResponse: CsrfResponse = {
        headers: new Map([
          ['x-csrf-token', 'new-token'],
          ['content-type', 'application/json'],
        ]),
        cookies: new Map([
          ['csrf-token', { value: 'new-token', options: { httpOnly: true } }],
          [
            'csrf-token-server',
            { value: 'signed-token', options: { httpOnly: true, path: '/' } },
          ],
        ]),
      }

      const result = adapter.applyResponse(mockEvent, csrfResponse)

      expect(mockedSetResponseHeader).toHaveBeenCalledWith(
        mockEvent,
        'x-csrf-token',
        'new-token',
      )
      expect(mockedSetResponseHeader).toHaveBeenCalledWith(
        mockEvent,
        'content-type',
        'application/json',
      )
      expect(mockedSetCookie).toHaveBeenCalledWith(
        mockEvent,
        'csrf-token',
        'new-token',
        { httpOnly: true },
      )
      expect(mockedSetCookie).toHaveBeenCalledWith(
        mockEvent,
        'csrf-token-server',
        'signed-token',
        { httpOnly: true, path: '/' },
      )
      expect(result).toBe(mockEvent)
    })

    it('should apply headers and cookies from objects correctly', () => {
      const mockEvent = createMockEvent()

      const csrfResponse: CsrfResponse = {
        headers: {
          'x-csrf-token': 'new-token',
          'content-type': 'application/json',
        },
        cookies: {
          'csrf-token': { value: 'new-token', options: { httpOnly: true } },
          'csrf-token-server': {
            value: 'signed-token',
            options: { httpOnly: true, path: '/' },
          },
        },
      }

      const result = adapter.applyResponse(mockEvent, csrfResponse)

      expect(mockedSetResponseHeader).toHaveBeenCalledWith(
        mockEvent,
        'x-csrf-token',
        'new-token',
      )
      expect(mockedSetCookie).toHaveBeenCalledWith(
        mockEvent,
        'csrf-token',
        'new-token',
        { httpOnly: true },
      )
      expect(result).toBe(mockEvent)
    })
  })

  describe('getTokenFromRequest', () => {
    const baseConfig = {
      token: {
        headerName: 'x-csrf-token',
        fieldName: 'csrf',
      },
      cookie: {
        name: 'csrf-token',
      },
    } as RequiredCsrfConfig

    it('should extract token from header', async () => {
      const mockEvent = createMockEvent()

      mockedGetHeader.mockImplementation((_event, name) => {
        if (name === 'x-csrf-token') return 'header-token'
        return undefined
      })
      mockedParseCookies.mockReturnValue({})

      const request: CsrfRequest = {
        method: 'POST',
        url: 'http://localhost/api',
        headers: new Map([['x-csrf-token', 'header-token']]),
        cookies: new Map(),
        body: mockEvent,
      }

      const token = await adapter.getTokenFromRequest(request, baseConfig)
      expect(token).toBe('header-token')
    })

    it('should extract token from cookie with lowercased name lookup', async () => {
      const mockEvent = createMockEvent()
      const configWithCasing = {
        ...baseConfig,
        cookie: { name: 'CSRF-Token' },
      } as RequiredCsrfConfig

      mockedGetHeader.mockReturnValue(undefined)
      // parseCookies returns lowercase key (browser normalizes cookie names)
      mockedParseCookies.mockReturnValue({
        'csrf-token': 'cookie-token',
      })

      const request: CsrfRequest = {
        method: 'POST',
        url: 'http://localhost/api',
        headers: new Map(),
        cookies: new Map([['csrf-token', 'cookie-token']]),
        body: mockEvent,
      }

      const token = await adapter.getTokenFromRequest(request, configWithCasing)
      expect(token).toBe('cookie-token')
    })

    it('should fallback to original casing if lowercased cookie not found', async () => {
      const mockEvent = createMockEvent()
      const configWithCasing = {
        ...baseConfig,
        cookie: { name: 'CSRF-Token' },
      } as RequiredCsrfConfig

      mockedGetHeader.mockReturnValue(undefined)
      // parseCookies preserves original casing in this case
      mockedParseCookies.mockReturnValue({
        'CSRF-Token': 'cookie-token',
      })

      const request: CsrfRequest = {
        method: 'POST',
        url: 'http://localhost/api',
        headers: new Map(),
        cookies: new Map([['CSRF-Token', 'cookie-token']]),
        body: mockEvent,
      }

      const token = await adapter.getTokenFromRequest(request, configWithCasing)
      expect(token).toBe('cookie-token')
    })

    it('should extract token from cookie', async () => {
      const mockEvent = createMockEvent()

      mockedGetHeader.mockReturnValue(undefined)
      mockedParseCookies.mockReturnValue({
        'csrf-token': 'cookie-token',
      })

      const request: CsrfRequest = {
        method: 'POST',
        url: 'http://localhost/api',
        headers: new Map(),
        cookies: new Map([['csrf-token', 'cookie-token']]),
        body: mockEvent,
      }

      const token = await adapter.getTokenFromRequest(request, baseConfig)
      expect(token).toBe('cookie-token')
    })

    it('should extract token from JSON body', async () => {
      const mockEvent = createMockEvent()

      mockedGetHeader.mockImplementation((_event, name) => {
        if (name === 'content-type') return 'application/json'
        return undefined
      })
      mockedParseCookies.mockReturnValue({})
      mockedReadBody.mockResolvedValue({ csrf: 'body-token' })

      const request: CsrfRequest = {
        method: 'POST',
        url: 'http://localhost/api',
        headers: new Map([['content-type', 'application/json']]),
        cookies: new Map(),
        body: mockEvent,
      }

      const token = await adapter.getTokenFromRequest(request, baseConfig)
      expect(token).toBe('body-token')
    })

    it('should extract token from URL-encoded body', async () => {
      const mockEvent = createMockEvent()

      mockedGetHeader.mockImplementation((_event, name) => {
        if (name === 'content-type')
          return 'application/x-www-form-urlencoded'
        return undefined
      })
      mockedParseCookies.mockReturnValue({})
      mockedReadBody.mockResolvedValue({ csrf: 'form-token' })

      const request: CsrfRequest = {
        method: 'POST',
        url: 'http://localhost/api',
        headers: new Map([
          ['content-type', 'application/x-www-form-urlencoded'],
        ]),
        cookies: new Map(),
        body: mockEvent,
      }

      const token = await adapter.getTokenFromRequest(request, baseConfig)
      expect(token).toBe('form-token')
    })

    it('should extract token from multipart/form-data body (h3 returns plain object)', async () => {
      const mockEvent = createMockEvent()

      mockedGetHeader.mockImplementation((_event, name) => {
        if (name === 'content-type') return 'multipart/form-data'
        return undefined
      })
      mockedParseCookies.mockReturnValue({})
      // h3's readBody returns a plain object for multipart/form-data, not FormData
      mockedReadBody.mockResolvedValue({ csrf: 'formdata-token', other: 'value' })

      const request: CsrfRequest = {
        method: 'POST',
        url: 'http://localhost/api',
        headers: new Map([['content-type', 'multipart/form-data']]),
        cookies: new Map(),
        body: mockEvent,
      }

      const token = await adapter.getTokenFromRequest(request, baseConfig)
      expect(token).toBe('formdata-token')
    })

    it('should extract token from URL-encoded string body', async () => {
      const mockEvent = createMockEvent()

      mockedGetHeader.mockImplementation((_event, name) => {
        if (name === 'content-type') return 'text/plain'
        return undefined
      })
      mockedParseCookies.mockReturnValue({})
      mockedReadBody.mockResolvedValue('csrf=urlencoded-token&other=value')

      const request: CsrfRequest = {
        method: 'POST',
        url: 'http://localhost/api',
        headers: new Map([['content-type', 'text/plain']]),
        cookies: new Map(),
        body: mockEvent,
      }

      const token = await adapter.getTokenFromRequest(request, baseConfig)
      expect(token).toBe('urlencoded-token')
    })

    it('should return undefined when no token is found', async () => {
      const mockEvent = createMockEvent()

      mockedGetHeader.mockReturnValue(undefined)
      mockedParseCookies.mockReturnValue({})
      mockedReadBody.mockResolvedValue({})

      const request: CsrfRequest = {
        method: 'POST',
        url: 'http://localhost/api',
        headers: new Map(),
        cookies: new Map(),
        body: mockEvent,
      }

      const token = await adapter.getTokenFromRequest(request, baseConfig)
      expect(token).toBeUndefined()
    })

    it('should handle readBody failure gracefully', async () => {
      const mockEvent = createMockEvent()

      mockedGetHeader.mockImplementation((_event, name) => {
        if (name === 'content-type') return 'application/json'
        return undefined
      })
      mockedParseCookies.mockReturnValue({})
      mockedReadBody.mockRejectedValue(new Error('Parse error'))

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const request: CsrfRequest = {
        method: 'POST',
        url: 'http://localhost/api',
        headers: new Map([['content-type', 'application/json']]),
        cookies: new Map(),
        body: mockEvent,
      }

      const token = await adapter.getTokenFromRequest(request, baseConfig)
      expect(token).toBeUndefined()
      expect(warnSpy).toHaveBeenCalled()

      warnSpy.mockRestore()
    })

    it('should use cached body on second call for same event', async () => {
      const mockEvent = createMockEvent()

      mockedGetHeader.mockImplementation((_event, name) => {
        if (name === 'content-type') return 'application/json'
        return undefined
      })
      mockedParseCookies.mockReturnValue({})
      mockedReadBody.mockResolvedValue({ csrf: 'cached-token' })

      const request: CsrfRequest = {
        method: 'POST',
        url: 'http://localhost/api',
        headers: new Map([['content-type', 'application/json']]),
        cookies: new Map(),
        body: mockEvent,
      }

      // First call reads and caches
      const token1 = await adapter.getTokenFromRequest(request, baseConfig)
      expect(token1).toBe('cached-token')
      expect(mockedReadBody).toHaveBeenCalledTimes(1)

      // Second call uses cache, does not call readBody again
      const token2 = await adapter.getTokenFromRequest(request, baseConfig)
      expect(token2).toBe('cached-token')
      expect(mockedReadBody).toHaveBeenCalledTimes(1)
    })
  })

  describe('cookie options adaptation', () => {
    it('should adapt cookie options correctly through applyResponse', () => {
      const mockEvent = createMockEvent()

      const cookieOptions: CookieOptions = {
        secure: true,
        httpOnly: true,
        sameSite: 'strict' as const,
        path: '/api',
        domain: 'example.com',
        maxAge: 3600,
      }

      const csrfResponse: CsrfResponse = {
        headers: new Map(),
        cookies: new Map([
          ['test-cookie', { value: 'test-value', options: cookieOptions }],
        ]),
      }

      adapter.applyResponse(mockEvent, csrfResponse)

      expect(mockedSetCookie).toHaveBeenCalledWith(
        mockEvent,
        'test-cookie',
        'test-value',
        expect.objectContaining({
          secure: true,
          httpOnly: true,
          sameSite: 'strict',
          path: '/api',
          domain: 'example.com',
          maxAge: 3600,
        }),
      )
    })

    it('should handle undefined cookie options', () => {
      const mockEvent = createMockEvent()

      const csrfResponse: CsrfResponse = {
        headers: new Map(),
        cookies: new Map([['test-cookie', { value: 'test-value' }]]),
      }

      adapter.applyResponse(mockEvent, csrfResponse)

      expect(mockedSetCookie).toHaveBeenCalledWith(
        mockEvent,
        'test-cookie',
        'test-value',
        expect.objectContaining({}),
      )
    })
  })

  describe('concurrent requests', () => {
    it('should handle cookies and headers correctly for concurrent requests', async () => {
      const events = Array.from({ length: 5 }, () => createMockEvent())

      const csrfResponses: CsrfResponse[] = events.map((_, i) => ({
        headers: new Map([
          ['x-csrf-token', `token-${i}`],
          ['x-request-id', `req-${i}`],
        ]),
        cookies: new Map([
          ['csrf-token', { value: `csrf-${i}`, options: { httpOnly: true } }],
          [
            'session-id',
            { value: `session-${i}`, options: { secure: true, path: '/' } },
          ],
        ]),
      }))

      const promises = events.map((event, i) =>
        Promise.resolve(adapter.applyResponse(event, csrfResponses[i]!)),
      )

      const results = await Promise.all(promises)

      results.forEach((result, i) => {
        expect(result).toBe(events[i])
      })

      events.forEach((event, i) => {
        expect(mockedSetResponseHeader).toHaveBeenCalledWith(
          event,
          'x-csrf-token',
          `token-${i}`,
        )
        expect(mockedSetCookie).toHaveBeenCalledWith(
          event,
          'csrf-token',
          `csrf-${i}`,
          { httpOnly: true },
        )
      })
    })

    it('should maintain request isolation during concurrent token extraction from different sources', async () => {
      const config = {
        token: {
          headerName: 'x-csrf-token',
          fieldName: 'csrf',
        },
        cookie: {
          name: 'csrf-token',
        },
      } as RequiredCsrfConfig

      const headerEvent = createMockEvent()
      const bodyEvent = createMockEvent()
      const cookieEvent = createMockEvent()

      mockedGetHeader.mockImplementation((event, name) => {
        if (event === headerEvent && name === 'x-csrf-token')
          return 'header-token'
        if (event === bodyEvent && name === 'content-type')
          return 'application/json'
        return undefined
      })

      mockedParseCookies.mockImplementation((event) => {
        if (event === cookieEvent) return { 'csrf-token': 'cookie-token' }
        return {}
      })

      mockedReadBody.mockImplementation(async (event) => {
        if (event === bodyEvent) return { csrf: 'body-token' }
        return {}
      })

      const headerRequest: CsrfRequest = {
        method: 'POST',
        url: 'http://localhost/api/1',
        headers: new Map([['x-csrf-token', 'header-token']]),
        cookies: new Map(),
        body: headerEvent,
      }

      const bodyRequest: CsrfRequest = {
        method: 'POST',
        url: 'http://localhost/api/2',
        headers: new Map([['content-type', 'application/json']]),
        cookies: new Map(),
        body: bodyEvent,
      }

      const cookieRequest: CsrfRequest = {
        method: 'POST',
        url: 'http://localhost/api/3',
        headers: new Map(),
        cookies: new Map([['csrf-token', 'cookie-token']]),
        body: cookieEvent,
      }

      const [headerToken, bodyToken, cookieToken] = await Promise.all([
        adapter.getTokenFromRequest(headerRequest, config),
        adapter.getTokenFromRequest(bodyRequest, config),
        adapter.getTokenFromRequest(cookieRequest, config),
      ])

      expect(headerToken).toBe('header-token')
      expect(bodyToken).toBe('body-token')
      expect(cookieToken).toBe('cookie-token')
    })
  })
})
