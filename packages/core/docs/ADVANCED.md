# Advanced Configuration Guide

This guide covers advanced configuration scenarios, custom implementations, and complex use cases for
`@csrf-armor/core`.

## Table of Contents

- [Configuration Deep Dive](#configuration-deep-dive)
- [Custom Strategy Implementation](#custom-strategy-implementation)
- [Framework Adapters](#framework-adapters)
- [Advanced Security Patterns](#advanced-security-patterns)
- [Performance Optimization](#performance-optimization)
- [Error Handling](#error-handling)
- [Testing Strategies](#testing-strategies)
- [Production Deployment](#production-deployment)
- [Troubleshooting](#troubleshooting)

---

## Configuration Deep Dive

### Complete Configuration Reference

```typescript
interface CsrfConfig {
    strategy?: CsrfStrategy;
    secret?: string;
    token?: TokenOptions;
    cookie?: CookieOptions;
    allowedOrigins?: readonly string[];
    excludePaths?: readonly string[];
    skipContentTypes?: readonly string[];
}

interface TokenOptions {
    expiry?: number;          // Token lifetime in seconds (default: 3600)
    headerName?: string;      // Header name (default: 'X-CSRF-Token')
    fieldName?: string;       // Form field name (default: 'csrf_token')
}

interface CookieOptions {
    name?: string;            // Cookie name (default: 'csrf-token')
    secure?: boolean;         // HTTPS only (default: true)
    httpOnly?: boolean;       // JavaScript access (default: false)
    sameSite?: 'strict' | 'lax' | 'none'; // SameSite policy (default: 'lax')
    path?: string;            // Cookie path (default: '/')
    domain?: string;          // Cookie domain (optional)
    maxAge?: number;          // Max age in seconds (optional)
}
```

### Strategy-Specific Configuration

#### Signed Double Submit - Enterprise Setup

```typescript
const enterpriseConfig: CsrfConfig = {
    strategy: 'signed-double-submit',
    secret: process.env.CSRF_SECRET!, // 32+ character secret

    token: {
        expiry: 1800,           // 30 minutes for security
        headerName: 'X-CSRF-Token',
        fieldName: 'csrf_token'
    },

    cookie: {
        name: 'csrf-token',
        secure: true,           // HTTPS only in production
        httpOnly: false,        // Allow client access
        sameSite: 'strict',     // Strict policy for high security
        path: '/',
        domain: '.yourdomain.com', // Cross-subdomain support
        maxAge: 1800            // Match token expiry
    },

    allowedOrigins: [
        'https://yourdomain.com',
        'https://www.yourdomain.com',
        'https://app.yourdomain.com',
        'https://admin.yourdomain.com'
    ],

    excludePaths: [
        '/api/webhooks',        // External webhooks
        '/api/public',          // Public APIs
        '/health',              // Health checks
        '/metrics'              // Monitoring
    ],

    skipContentTypes: [
        'application/json',     // JSON APIs (if desired)
        'text/plain'           // Simple text endpoints
    ]
};
```

#### Hybrid Strategy - Maximum Security

```typescript
const maximumSecurityConfig: CsrfConfig = {
    strategy: 'hybrid',
    secret: process.env.CSRF_SECRET!,

    token: {
        expiry: 900,            // 15 minutes for critical operations
        headerName: 'X-CSRF-Token',
        fieldName: 'csrf_token'
    },

    cookie: {
        name: 'csrf-token',
        secure: true,
        httpOnly: false,
        sameSite: 'strict',     // Most restrictive
        path: '/',
        maxAge: 900             // Short-lived cookies
    },

    allowedOrigins: [
        'https://secure.bank.com',
        'https://trading.bank.com'
    ],

    // No exclusions for maximum security
    excludePaths: [],
    skipContentTypes: []
};
```

#### Origin Check - High Performance APIs

```typescript
const highPerformanceConfig: CsrfConfig = {
    strategy: 'origin-check',

    // No secret needed for origin-only validation
    token: {
        expiry: 7200,           // Longer expiry for performance
        headerName: 'X-CSRF-Token',
        fieldName: 'csrf_token'
    },

    cookie: {
        name: 'csrf-token',
        secure: true,
        httpOnly: false,
        sameSite: 'lax',        // More permissive for APIs
        path: '/'
    },

    allowedOrigins: [
        'https://api.yourdomain.com',
        'https://mobile.yourdomain.com',
        'https://partner1.com',
        'https://partner2.com'
    ],

    excludePaths: [
        '/api/public',
        '/api/status',
        '/api/docs'
    ]
};
```

### Environment-Specific Configuration

#### Development Configuration

```typescript
const developmentConfig: CsrfConfig = {
    strategy: 'double-submit',  // Faster for development
    secret: 'dev-secret-not-for-production',

    token: {
        expiry: 86400,          // 24 hours for convenience
        headerName: 'X-CSRF-Token',
        fieldName: 'csrf_token'
    },

    cookie: {
        name: 'csrf-token',
        secure: false,          // HTTP allowed in development
        httpOnly: false,
        sameSite: 'lax',
        path: '/'
    },

    allowedOrigins: [
        'http://localhost:3000',
        'http://localhost:3001',
        'http://127.0.0.1:3000'
    ],

    excludePaths: [
        '/dev',
        '/api/test',
        '/debug'
    ]
};
```

#### Production Configuration Factory

```typescript
interface Environment {
    domain: string;
    subdomains: string[];
    apiDomains: string[];
    isHighSecurity: boolean;
}

function createProductionConfig(env: Environment): CsrfConfig {
    const strategy = env.isHighSecurity ? 'hybrid' : 'signed-double-submit';
    const expiry = env.isHighSecurity ? 900 : 3600;

    const allowedOrigins = [
        `https://${env.domain}`,
        `https://www.${env.domain}`,
        ...env.subdomains.map(sub => `https://${sub}.${env.domain}`),
        ...env.apiDomains.map(api => `https://${api}`)
    ];

    return {
        strategy,
        secret: process.env.CSRF_SECRET!,
        token: {expiry},
        cookie: {
            name: 'csrf-token',
            secure: true,
            httpOnly: false,
            sameSite: env.isHighSecurity ? 'strict' : 'lax',
            path: '/',
            domain: `.${env.domain}`,
            maxAge: expiry
        },
        allowedOrigins,
        excludePaths: ['/api/webhooks', '/health'],
        skipContentTypes: []
    };
}

// Usage
const prodConfig = createProductionConfig({
    domain: 'yourdomain.com',
    subdomains: ['app', 'admin', 'api'],
    apiDomains: ['partner-api.com'],
    isHighSecurity: true
});
```

---

## Custom Strategy Implementation

### Creating a Custom Validation Strategy

While the built-in strategies cover most use cases, you can implement custom validation logic:

```typescript
import {validateRequest, ValidationResult, CsrfRequest, RequiredCsrfConfig} from '@csrf-armor/core';

async function validateCustomStrategy(
    request: CsrfRequest,
    config: RequiredCsrfConfig,
    getTokenFromRequest: (req: CsrfRequest, config: RequiredCsrfConfig) => Promise<string | undefined>
): Promise<ValidationResult> {
    // Example: IP-based validation + token validation
    const clientIp = extractClientIp(request);
    const allowedIps = ['192.168.1.0/24', '10.0.0.0/8'];

    if (!isIpAllowed(clientIp, allowedIps)) {
        return {isValid: false, reason: 'IP not allowed'};
    }

    // Combine with existing strategy
    return await validateSignedToken(request, config, getTokenFromRequest);
}

function extractClientIp(request: CsrfRequest): string {
    const headers = request.headers instanceof Map
        ? request.headers
        : new Map(Object.entries(request.headers));

    return headers.get('x-forwarded-for') ||
        headers.get('x-real-ip') ||
        '127.0.0.1';
}

function isIpAllowed(ip: string, allowedRanges: string[]): boolean {
    // Implement IP range checking logic
    // This is a simplified example
    return allowedRanges.some(range => {
        if (range.includes('/')) {
            // CIDR notation
            return checkCidr(ip, range);
        }
        return ip === range;
    });
}
```

### Multi-Factor CSRF Protection

```typescript
class MultiFaceMalfaCtorCsrfProtection<TRequest, TResponse> {
    private csrfProtection: CsrfProtection<TRequest, TResponse>;
    private deviceTracker: DeviceTracker;
    private rateLimiter: RateLimiter;

    constructor(
        adapter: CsrfAdapter<TRequest, TResponse>,
        config: CsrfConfig,
        options: {
            deviceTracking?: boolean;
            rateLimiting?: boolean;
            geoBlocking?: boolean;
        } = {}
    ) {
        this.csrfProtection = new CsrfProtection(adapter, config);

        if (options.deviceTracking) {
            this.deviceTracker = new DeviceTracker();
        }

        if (options.rateLimiting) {
            this.rateLimiter = new RateLimiter();
        }
    }

    async protect(
        request: TRequest,
        response: TResponse
    ): Promise<{
        success: boolean;
        response: TResponse;
        token?: string;
        reason?: string;
        securityScore?: number;
    }> {
        // Basic CSRF protection
        const csrfResult = await this.csrfProtection.protect(request, response);

        if (!csrfResult.success) {
            return {...csrfResult, securityScore: 0};
        }

        let securityScore = 50; // Base score for valid CSRF

        // Device fingerprinting
        if (this.deviceTracker) {
            const deviceScore = await this.deviceTracker.validateDevice(request);
            securityScore += deviceScore;
        }

        // Rate limiting
        if (this.rateLimiter) {
            const rateLimitResult = await this.rateLimiter.checkLimit(request);
            if (!rateLimitResult.allowed) {
                return {
                    success: false,
                    response: csrfResult.response,
                    reason: 'Rate limit exceeded',
                    securityScore
                };
            }
            securityScore += rateLimitResult.score;
        }

        return {
            ...csrfResult,
            securityScore: Math.min(100, securityScore)
        };
    }
}
```

---

## Framework Adapters

### Express.js Production Adapter

```typescript
import express from 'express';
import {CsrfAdapter, CsrfRequest, CsrfResponse, RequiredCsrfConfig} from '@csrf-armor/core';

export class ExpressAdapter implements CsrfAdapter<express.Request, express.Response> {
    extractRequest(req: express.Request): CsrfRequest {
        return {
            method: req.method,
            url: req.url,
            headers: new Map(Object.entries(req.headers as Record<string, string>)),
            cookies: new Map(Object.entries(req.cookies || {})),
            body: req.body
        };
    }

    applyResponse(res: express.Response, csrfResponse: CsrfResponse): express.Response {
        // Apply headers
        if (csrfResponse.headers instanceof Map) {
            for (const [key, value] of csrfResponse.headers) {
                res.setHeader(key, value);
            }
        } else if (csrfResponse.headers) {
            for (const [key, value] of Object.entries(csrfResponse.headers)) {
                res.setHeader(key, value);
            }
        }

        // Apply cookies with proper options
        if (csrfResponse.cookies instanceof Map) {
            for (const [name, {value, options}] of csrfResponse.cookies) {
                res.cookie(name, value, {
                    secure: options?.secure,
                    httpOnly: options?.httpOnly,
                    sameSite: options?.sameSite,
                    path: options?.path,
                    domain: options?.domain,
                    maxAge: options?.maxAge ? options.maxAge * 1000 : undefined // Express expects milliseconds
                });
            }
        } else if (csrfResponse.cookies) {
            for (const [name, {value, options}] of Object.entries(csrfResponse.cookies)) {
                res.cookie(name, value, {
                    secure: options?.secure,
                    httpOnly: options?.httpOnly,
                    sameSite: options?.sameSite,
                    path: options?.path,
                    domain: options?.domain,
                    maxAge: options?.maxAge ? options.maxAge * 1000 : undefined
                });
            }
        }

        return res;
    }

    async getTokenFromRequest(
        request: CsrfRequest,
        config: RequiredCsrfConfig
    ): Promise<string | undefined> {
        const headers = request.headers instanceof Map
            ? request.headers
            : new Map(Object.entries(request.headers));

        // Try header first (most common for APIs)
        const headerValue = headers.get(config.token.headerName.toLowerCase());
        if (headerValue) return headerValue;

        // Try query parameter
        if (request.url) {
            const url = new URL(request.url, 'http://localhost');
            const queryValue = url.searchParams.get(config.token.fieldName);
            if (queryValue) return queryValue;
        }

        // Try form body
        if (request.body && typeof request.body === 'object') {
            const body = request.body as Record<string, unknown>;
            const formValue = body[config.token.fieldName];
            if (typeof formValue === 'string') return formValue;
        }

        return undefined;
    }
}

// Express middleware factory
export function createExpressCsrfMiddleware(config?: CsrfConfig) {
    const adapter = new ExpressAdapter();
    const protection = createCsrfProtection(adapter, config);

    return async (
        req: express.Request,
        res: express.Response,
        next: express.NextFunction
    ) => {
        try {
            const result = await protection.protect(req, res);

            if (result.success) {
                // Attach token to request for use in templates
                (req as any).csrfToken = result.token;
                next();
            } else {
                // Log security events
                console.warn('CSRF validation failed:', {
                    ip: req.ip,
                    userAgent: req.headers['user-agent'],
                    url: req.url,
                    reason: result.reason
                });

                res.status(403).json({
                    error: 'CSRF validation failed',
                    code: 'CSRF_INVALID'
                });
            }
        } catch (error) {
            console.error('CSRF middleware error:', error);
            res.status(500).json({
                error: 'Internal server error',
                code: 'CSRF_ERROR'
            });
        }
    };
}
```

### Fastify Plugin

```typescript
import {FastifyPluginAsync, FastifyRequest, FastifyReply} from 'fastify';
import {CsrfAdapter, createCsrfProtection, CsrfConfig} from '@csrf-armor/core';

class FastifyAdapter implements CsrfAdapter<FastifyRequest, FastifyReply> {
    extractRequest(req: FastifyRequest) {
        return {
            method: req.method,
            url: req.url,
            headers: new Map(Object.entries(req.headers)),
            cookies: new Map(Object.entries(req.cookies || {})),
            body: req.body
        };
    }

    applyResponse(reply: FastifyReply, csrfResponse: any) {
        // Apply headers
        if (csrfResponse.headers instanceof Map) {
            for (const [key, value] of csrfResponse.headers) {
                reply.header(key, value);
            }
        }

        // Apply cookies
        if (csrfResponse.cookies instanceof Map) {
            for (const [name, {value, options}] of csrfResponse.cookies) {
                reply.setCookie(name, value, {
                    secure: options?.secure,
                    httpOnly: options?.httpOnly,
                    sameSite: options?.sameSite,
                    path: options?.path,
                    domain: options?.domain,
                    maxAge: options?.maxAge
                });
            }
        }

        return reply;
    }

    async getTokenFromRequest(request: any, config: any) {
        const headers = request.headers instanceof Map
            ? request.headers
            : new Map(Object.entries(request.headers));

        return headers.get(config.token.headerName.toLowerCase());
    }
}

interface CsrfPluginOptions {
    config?: CsrfConfig;
    onError?: (error: any, request: FastifyRequest, reply: FastifyReply) => void;
}

const csrfPlugin: FastifyPluginAsync<CsrfPluginOptions> = async (fastify, options) => {
    const adapter = new FastifyAdapter();
    const protection = createCsrfProtection(adapter, options.config);

    fastify.addHook('preHandler', async (request, reply) => {
        try {
            const result = await protection.protect(request, reply);

            if (!result.success) {
                if (options.onError) {
                    options.onError(new Error(result.reason), request, reply);
                } else {
                    reply.code(403).send({
                        error: 'CSRF validation failed',
                        code: 'CSRF_INVALID'
                    });
                }
            } else {
                // Add token to request
                (request as any).csrfToken = result.token;
            }
        } catch (error) {
            fastify.log.error('CSRF validation error:', error);
            reply.code(500).send({
                error: 'Internal server error',
                code: 'CSRF_ERROR'
            });
        }
    });

    // Add helper to get CSRF token
    fastify.decorateRequest('csrfToken', null);
};

export default csrfPlugin;
```

### Next.js App Router Middleware

```typescript
import {NextRequest, NextResponse} from 'next/server';
import {CsrfAdapter, createCsrfProtection, CsrfConfig} from '@csrf-armor/core';

class NextJSAdapter implements CsrfAdapter<NextRequest, NextResponse> {
    extractRequest(req: NextRequest) {
        const headers = new Map();
        req.headers.forEach((value, key) => headers.set(key, value));

        const cookies = new Map();
        req.cookies.getAll().forEach(({name, value}) => cookies.set(name, value));

        return {
            method: req.method,
            url: req.url,
            headers,
            cookies,
            body: undefined // Body handling in Next.js is more complex
        };
    }

    applyResponse(res: NextResponse, csrfResponse: any) {
        // Apply headers
        if (csrfResponse.headers instanceof Map) {
            for (const [key, value] of csrfResponse.headers) {
                res.headers.set(key, value);
            }
        }

        // Apply cookies
        if (csrfResponse.cookies instanceof Map) {
            for (const [name, {value, options}] of csrfResponse.cookies) {
                res.cookies.set(name, value, {
                    secure: options?.secure,
                    httpOnly: options?.httpOnly,
                    sameSite: options?.sameSite,
                    path: options?.path,
                    domain: options?.domain,
                    maxAge: options?.maxAge
                });
            }
        }

        return res;
    }

    async getTokenFromRequest(request: any, config: any) {
        const headers = request.headers instanceof Map
            ? request.headers
            : new Map(Object.entries(request.headers));

        return headers.get(config.token.headerName.toLowerCase());
    }
}

export function createNextJSMiddleware(config?: CsrfConfig) {
    const adapter = new NextJSAdapter();
    const protection = createCsrfProtection(adapter, config);

    return async function middleware(request: NextRequest) {
        // Skip for static files and API routes if desired
        if (request.nextUrl.pathname.startsWith('/_next/') ||
            request.nextUrl.pathname.startsWith('/api/public/')) {
            return NextResponse.next();
        }

        try {
            const response = NextResponse.next();
            const result = await protection.protect(request, response);

            if (!result.success) {
                console.warn('CSRF validation failed:', {
                    url: request.url,
                    method: request.method,
                    reason: result.reason
                });

                return new NextResponse(
                    JSON.stringify({error: 'CSRF validation failed'}),
                    {
                        status: 403,
                        headers: {'Content-Type': 'application/json'}
                    }
                );
            }

            // Add CSRF token to response headers for client access
            result.response.headers.set('X-CSRF-Token', result.token || '');

            return result.response;
        } catch (error) {
            console.error('CSRF middleware error:', error);
            return new NextResponse(
                JSON.stringify({error: 'Internal server error'}),
                {
                    status: 500,
                    headers: {'Content-Type': 'application/json'}
                }
            );
        }
    };
}

// Matcher configuration
export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - api/public (public API routes)
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         */
        '/((?!api/public|_next/static|_next/image|favicon.ico).*)',
    ],
};
```

---

## Advanced Security Patterns

### Multi-Tenant CSRF Protection

```typescript
interface TenantConfig {
    tenantId: string;
    domain: string;
    strategy: CsrfStrategy;
    secret: string;
    allowedOrigins: string[];
}

class MultiTenantCsrfProtection<TRequest, TResponse> {
    private tenantConfigs = new Map<string, CsrfProtection<TRequest, TResponse>>();
    private adapter: CsrfAdapter<TRequest, TResponse>;

    constructor(
        adapter: CsrfAdapter<TRequest, TResponse>,
        tenants: TenantConfig[]
    ) {
        this.adapter = adapter;

        for (const tenant of tenants) {
            const config: CsrfConfig = {
                strategy: tenant.strategy,
                secret: tenant.secret,
                allowedOrigins: tenant.allowedOrigins,
                cookie: {
                    name: `csrf-token-${tenant.tenantId}`,
                    domain: tenant.domain
                }
            };

            this.tenantConfigs.set(
                tenant.tenantId,
                new CsrfProtection(adapter, config)
            );
        }
    }

    async protect(
        request: TRequest,
        response: TResponse,
        tenantId: string
    ): Promise<{
        success: boolean;
        response: TResponse;
        token?: string;
        reason?: string;
    }> {
        const protection = this.tenantConfigs.get(tenantId);

        if (!protection) {
            return {
                success: false,
                response,
                reason: `Unknown tenant: ${tenantId}`
            };
        }

        return await protection.protect(request, response);
    }
}
```

### Request Signing with CSRF

```typescript
import {createHmac} from 'crypto';

interface SignedRequestConfig extends CsrfConfig {
    requestSigning: {
        enabled: boolean;
        secret: string;
        timestampTolerance: number; // seconds
        includeHeaders: string[];
    };
}

class SignedRequestCsrfProtection<TRequest, TResponse> {
    private csrfProtection: CsrfProtection<TRequest, TResponse>;
    private signingConfig: SignedRequestConfig['requestSigning'];

    constructor(
        adapter: CsrfAdapter<TRequest, TResponse>,
        config: SignedRequestConfig
    ) {
        this.csrfProtection = new CsrfProtection(adapter, config);
        this.signingConfig = config.requestSigning;
    }

    async protect(
        request: TRequest,
        response: TResponse
    ): Promise<{
        success: boolean;
        response: TResponse;
        token?: string;
        reason?: string;
    }> {
        // First, validate CSRF
        const csrfResult = await this.csrfProtection.protect(request, response);

        if (!csrfResult.success) {
            return csrfResult;
        }

        // Then validate request signature if enabled
        if (this.signingConfig.enabled) {
            const signatureValid = await this.validateRequestSignature(request);

            if (!signatureValid) {
                return {
                    success: false,
                    response: csrfResult.response,
                    reason: 'Invalid request signature'
                };
            }
        }

        return csrfResult;
    }

    private async validateRequestSignature(request: TRequest): Promise<boolean> {
        const csrfRequest = this.csrfProtection['adapter'].extractRequest(request);
        const headers = csrfRequest.headers instanceof Map
            ? csrfRequest.headers
            : new Map(Object.entries(csrfRequest.headers));

        const signature = headers.get('x-signature');
        const timestamp = headers.get('x-timestamp');

        if (!signature || !timestamp) {
            return false;
        }

        // Check timestamp tolerance
        const now = Math.floor(Date.now() / 1000);
        const requestTime = parseInt(timestamp);

        if (Math.abs(now - requestTime) > this.signingConfig.timestampTolerance) {
            return false;
        }

        // Build signature payload
        const payload = this.buildSignaturePayload(csrfRequest, timestamp);
        const expectedSignature = createHmac('sha256', this.signingConfig.secret)
            .update(payload)
            .digest('hex');

        return signature === expectedSignature;
    }

    private buildSignaturePayload(request: CsrfRequest, timestamp: string): string {
        const headers = request.headers instanceof Map
            ? request.headers
            : new Map(Object.entries(request.headers));

        const parts = [
            request.method,
            request.url,
            timestamp
        ];

        // Include specified headers in signature
        for (const headerName of this.signingConfig.includeHeaders) {
            const value = headers.get(headerName.toLowerCase()) || '';
            parts.push(`${headerName}:${value}`);
        }

        // Include body if present
        if (request.body) {
            parts.push(JSON.stringify(request.body));
        }

        return parts.join('\n');
    }
}
```

---

## Performance Optimization

### Token Caching Strategy

```typescript
interface TokenCache {
    get(key: string): Promise<string | null>;

    set(key: string, value: string, ttl: number): Promise<void>;

    delete(key: string): Promise<void>;
}

class RedisTokenCache implements TokenCache {
    private redis: any; // Redis client

    constructor(redisClient: any) {
        this.redis = redisClient;
    }

    async get(key: string): Promise<string | null> {
        return await this.redis.get(key);
    }

    async set(key: string, value: string, ttl: number): Promise<void> {
        await this.redis.setex(key, ttl, value);
    }

    async delete(key: string): Promise<void> {
        await this.redis.del(key);
    }
}

class CachedCsrfProtection<TRequest, TResponse> {
    private protection: CsrfProtection<TRequest, TResponse>;
    private cache: TokenCache;

    constructor(
        adapter: CsrfAdapter<TRequest, TResponse>,
        config: CsrfConfig,
        cache: TokenCache
    ) {
        this.protection = new CsrfProtection(adapter, config);
        this.cache = cache;
    }

    async protect(request: TRequest, response: TResponse) {
        const csrfRequest = this.protection['adapter'].extractRequest(request);

        // Create cache key from session/user identifier
        const cacheKey = this.generateCacheKey(csrfRequest);

        // Try to get cached token
        const cachedToken = await this.cache.get(cacheKey);

        if (cachedToken) {
            // Validate cached token
            const isValid = await this.validateCachedToken(cachedToken, csrfRequest);

            if (isValid) {
                return {
                    success: true,
                    response,
                    token: cachedToken
                };
            } else {
                // Remove invalid cached token
                await this.cache.delete(cacheKey);
            }
        }

        // Fall back to normal protection
        const result = await this.protection.protect(request, response);

        // Cache the new token if successful
        if (result.success && result.token) {
            await this.cache.set(cacheKey, result.token, 3600); // 1 hour cache
        }

        return result;
    }

    private generateCacheKey(request: CsrfRequest): string {
        // Use session ID, user ID, or other stable identifier
        const cookies = request.cookies instanceof Map
            ? request.cookies
            : new Map(Object.entries(request.cookies));

        const sessionId = cookies.get('session-id') || 'anonymous';
        return `csrf:token:${sessionId}`;
    }

    private async validateCachedToken(token: string, request: CsrfRequest): Promise<boolean> {
        try {
            // Basic token format validation
            if (!token || token.split('.').length < 2) {
                return false;
            }

            // Additional validation logic here
            return true;
        } catch {
            return false;
        }
    }
}
```

### Connection Pooling for Database-Backed Tokens

```typescript
import {Pool} from 'pg';

interface DatabaseConfig {
    connectionString: string;
    maxConnections: number;
    idleTimeout: number;
}

class DatabaseTokenManager {
    private pool: Pool;

    constructor(config: DatabaseConfig) {
        this.pool = new Pool({
            connectionString: config.connectionString,
            max: config.maxConnections,
            idleTimeoutMillis: config.idleTimeout,
            connectionTimeoutMillis: 2000,
        });
    }

    async storeToken(sessionId: string, token: string, expiresAt: Date): Promise<void> {
        const client = await this.pool.connect();
        try {
            await client.query(
                'INSERT INTO csrf_tokens (session_id, token, expires_at) VALUES ($1, $2, $3) ON CONFLICT (session_id) DO UPDATE SET token = $2, expires_at = $3',
                [sessionId, token, expiresAt]
            );
        } finally {
            client.release();
        }
    }

    async validateToken(sessionId: string, token: string): Promise<boolean> {
        const client = await this.pool.connect();
        try {
            const result = await client.query(
                'SELECT token FROM csrf_tokens WHERE session_id = $1 AND expires_at > NOW()',
                [sessionId]
            );

            return result.rows.length > 0 && result.rows[0].token === token;
        } finally {
            client.release();
        }
    }

    async cleanupExpiredTokens(): Promise<number> {
        const client = await this.pool.connect();
        try {
            const result = await client.query(
                'DELETE FROM csrf_tokens WHERE expires_at <= NOW()'
            );
            return result.rowCount || 0;
        } finally {
            client.release();
        }
    }

    async close(): Promise<void> {
        await this.pool.end();
    }
}

// Usage with CSRF protection
class DatabaseBackedCsrfProtection<TRequest, TResponse> {
    private tokenManager: DatabaseTokenManager;
    private config: RequiredCsrfConfig;

    constructor(
        private adapter: CsrfAdapter<TRequest, TResponse>,
        config: CsrfConfig,
        dbConfig: DatabaseConfig
    ) {
        this.tokenManager = new DatabaseTokenManager(dbConfig);
        this.config = mergeConfig(DEFAULT_CONFIG, config);
    }

    async protect(request: TRequest, response: TResponse) {
        const csrfRequest = this.adapter.extractRequest(request);
        const sessionId = this.extractSessionId(csrfRequest);

        if (!sessionId) {
            return {
                success: false,
                response,
                reason: 'No session ID found'
            };
        }

        // For safe methods, just generate token
        if (['GET', 'HEAD', 'OPTIONS'].includes(csrfRequest.method)) {
            const token = await generateSignedToken(this.config.secret, this.config.token.expiry);
            const expiresAt = new Date(Date.now() + this.config.token.expiry * 1000);

            await this.tokenManager.storeToken(sessionId, token, expiresAt);

            return {
                success: true,
                response,
                token
            };
        }

        // For unsafe methods, validate token
        const submittedToken = await this.adapter.getTokenFromRequest(csrfRequest, this.config);

        if (!submittedToken) {
            return {
                success: false,
                response,
                reason: 'No CSRF token provided'
            };
        }

        const isValid = await this.tokenManager.validateToken(sessionId, submittedToken);

        return {
            success: isValid,
            response,
            reason: isValid ? undefined : 'Invalid CSRF token'
        };
    }

    private extractSessionId(request: CsrfRequest): string | null {
        const cookies = request.cookies instanceof Map
            ? request.cookies
            : new Map(Object.entries(request.cookies));

        return cookies.get('session-id') || null;
    }
}
```

---

## Error Handling

### Custom Error Types

```typescript
import {CsrfError} from '@csrf-armor/core';

export class RateLimitError extends CsrfError {
    constructor(limit: number, window: number) {
        super(
            `Rate limit exceeded: ${limit} requests per ${window} seconds`,
            'RATE_LIMIT_EXCEEDED',
            429
        );
    }
}

export class DeviceFingerprintError extends CsrfError {
    constructor(fingerprint: string) {
        super(
            `Unknown device fingerprint: ${fingerprint}`,
            'DEVICE_FINGERPRINT_INVALID',
            403
        );
    }
}

export class GeoBlockingError extends CsrfError {
    constructor(country: string) {
        super(
            `Access blocked from country: ${country}`,
            'GEO_BLOCKED',
            403
        );
    }
}
```

### Comprehensive Error Handler

```typescript
interface SecurityEvent {
    timestamp: Date;
    type: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    details: Record<string, any>;
    clientInfo: {
        ip: string;
        userAgent?: string;
        sessionId?: string;
    };
}

class SecurityEventLogger {
    private events: SecurityEvent[] = [];
    private alertThresholds = {
        high: 10,      // 10 high-severity events in window
        critical: 5,   // 5 critical events in window
        window: 300000 // 5 minutes
    };

    logEvent(event: Omit<SecurityEvent, 'timestamp'>): void {
        const fullEvent: SecurityEvent = {
            ...event,
            timestamp: new Date()
        };

        this.events.push(fullEvent);

        // Check for alert conditions
        this.checkAlertThresholds();

        // Log to external systems
        this.sendToExternalSystems(fullEvent);
    }

    private checkAlertThresholds(): void {
        const now = Date.now();
        const windowStart = now - this.alertThresholds.window;

        const recentEvents = this.events.filter(
            event => event.timestamp.getTime() > windowStart
        );

        const criticalCount = recentEvents.filter(e => e.severity === 'critical').length;
        const highCount = recentEvents.filter(e => e.severity === 'high').length;

        if (criticalCount >= this.alertThresholds.critical) {
            this.triggerAlert('critical', `${criticalCount} critical security events in ${this.alertThresholds.window / 1000}s`);
        } else if (highCount >= this.alertThresholds.high) {
            this.triggerAlert('high', `${highCount} high-severity security events in ${this.alertThresholds.window / 1000}s`);
        }
    }

    private triggerAlert(severity: string, message: string): void {
        console.error(`SECURITY ALERT [${severity.toUpperCase()}]: ${message}`);
        // Send to alerting system (Slack, PagerDuty, etc.)
    }

    private sendToExternalSystems(event: SecurityEvent): void {
        // Send to logging aggregation (Elasticsearch, Splunk, etc.)
        // Send to SIEM systems
        // Send to monitoring (DataDog, New Relic, etc.)
    }
}

export class EnhancedCsrfProtection<TRequest, TResponse> {
    private protection: CsrfProtection<TRequest, TResponse>;
    private securityLogger: SecurityEventLogger;

    constructor(
        adapter: CsrfAdapter<TRequest, TResponse>,
        config: CsrfConfig
    ) {
        this.protection = new CsrfProtection(adapter, config);
        this.securityLogger = new SecurityEventLogger();
    }

    async protect(request: TRequest, response: TResponse) {
        const startTime = Date.now();

        try {
            const result = await this.protection.protect(request, response);

            if (!result.success) {
                this.logSecurityEvent(request, result.reason || 'Unknown CSRF failure', 'medium');
            }

            // Log successful requests for audit
            this.logSecurityEvent(request, 'CSRF validation successful', 'low');

            return result;
        } catch (error) {
            const duration = Date.now() - startTime;

            this.logSecurityEvent(
                request,
                `CSRF protection error: ${error instanceof Error ? error.message : 'Unknown error'}`,
                'high',
                {error: error instanceof Error ? error.stack : error, duration}
            );

            // Don't expose internal errors
            return {
                success: false,
                response,
                reason: 'Security validation failed'
            };
        }
    }

    private logSecurityEvent(
        request: TRequest,
        message: string,
        severity: SecurityEvent['severity'],
        additionalDetails: Record<string, any> = {}
    ): void {
        const csrfRequest = this.protection['adapter'].extractRequest(request);
        const headers = csrfRequest.headers instanceof Map
            ? csrfRequest.headers
            : new Map(Object.entries(csrfRequest.headers));

        this.securityLogger.logEvent({
            type: 'csrf_validation',
            severity,
            details: {
                message,
                method: csrfRequest.method,
                url: csrfRequest.url,
                ...additionalDetails
            },
            clientInfo: {
                ip: headers.get('x-forwarded-for') || headers.get('x-real-ip') || 'unknown',
                userAgent: headers.get('user-agent'),
                sessionId: this.extractSessionId(csrfRequest)
            }
        });
    }

    private extractSessionId(request: CsrfRequest): string | undefined {
        const cookies = request.cookies instanceof Map
            ? request.cookies
            : new Map(Object.entries(request.cookies));

        return cookies.get('session-id') || cookies.get('sessionid');
    }
}
```

---

## Testing Strategies

### Unit Testing CSRF Protection

```typescript
import {describe, it, expect, beforeEach, jest} from '@jest/globals';
import {CsrfProtection, CsrfAdapter, CsrfRequest, CsrfResponse} from '@csrf-armor/core';

class MockAdapter implements CsrfAdapter<any, any> {
    extractRequest(req: any): CsrfRequest {
        return req;
    }

    applyResponse(res: any, csrfResponse: CsrfResponse): any {
        return {...res, ...csrfResponse};
    }

    async getTokenFromRequest(req: CsrfRequest, config: any): Promise<string | undefined> {
        const headers = req.headers instanceof Map ? req.headers : new Map(Object.entries(req.headers));
        return headers.get('x-csrf-token');
    }
}

describe('CSRF Protection', () => {
    let protection: CsrfProtection<any, any>;
    let adapter: MockAdapter;

    beforeEach(() => {
        adapter = new MockAdapter();
        protection = new CsrfProtection(adapter, {
            strategy: 'signed-double-submit',
            secret: 'test-secret-32-characters-long-test'
        });
    });

    describe('Safe methods', () => {
        it('should allow GET requests without token', async () => {
            const request = {
                method: 'GET',
                url: '/api/data',
                headers: new Map(),
                cookies: new Map()
            };

            const result = await protection.protect(request, {});
            expect(result.success).toBe(true);
            expect(result.token).toBeDefined();
        });

        it('should allow HEAD requests without token', async () => {
            const request = {
                method: 'HEAD',
                url: '/api/status',
                headers: new Map(),
                cookies: new Map()
            };

            const result = await protection.protect(request, {});
            expect(result.success).toBe(true);
        });
    });

    describe('Unsafe methods', () => {
        it('should reject POST requests without token', async () => {
            const request = {
                method: 'POST',
                url: '/api/data',
                headers: new Map(),
                cookies: new Map()
            };

            const result = await protection.protect(request, {});
            expect(result.success).toBe(false);
            expect(result.reason).toContain('token');
        });

        it('should accept POST requests with valid token', async () => {
            // First, get a token
            const getRequest = {
                method: 'GET',
                url: '/api/init',
                headers: new Map(),
                cookies: new Map()
            };

            const getResult = await protection.protect(getRequest, {});
            expect(getResult.success).toBe(true);

            // Extract cookies and token from response
            const token = getResult.token!;
            const cookies = new Map(getResult.response.cookies);

            // Now make POST request with token
            const postRequest = {
                method: 'POST',
                url: '/api/data',
                headers: new Map([['x-csrf-token', token]]),
                cookies: cookies
            };

            const postResult = await protection.protect(postRequest, {});
            expect(postResult.success).toBe(true);
        });
    });

    describe('Path exclusions', () => {
        beforeEach(() => {
            protection = new CsrfProtection(adapter, {
                strategy: 'signed-double-submit',
                secret: 'test-secret-32-characters-long-test',
                excludePaths: ['/api/webhooks', '/public']
            });
        });

        it('should skip CSRF for excluded paths', async () => {
            const request = {
                method: 'POST',
                url: '/api/webhooks/stripe',
                headers: new Map(),
                cookies: new Map()
            };

            const result = await protection.protect(request, {});
            expect(result.success).toBe(true);
        });

        it('should enforce CSRF for non-excluded paths', async () => {
            const request = {
                method: 'POST',
                url: '/api/user/update',
                headers: new Map(),
                cookies: new Map()
            };

            const result = await protection.protect(request, {});
            expect(result.success).toBe(false);
        });
    });
});
```

### Integration Testing

```typescript
import request from 'supertest';
import express from 'express';
import {createExpressCsrfMiddleware} from './express-adapter';

describe('Express CSRF Integration', () => {
    let app: express.Application;

    beforeEach(() => {
        app = express();
        app.use(express.json());
        app.use(express.urlencoded({extended: true}));
        app.use(createExpressCsrfMiddleware({
            strategy: 'signed-double-submit',
            secret: 'integration-test-secret-32-chars'
        }));

        // Test routes
        app.get('/form', (req, res) => {
            res.json({csrfToken: (req as any).csrfToken});
        });

        app.post('/submit', (req, res) => {
            res.json({success: true, data: req.body});
        });
    });

    it('should provide CSRF token on GET request', async () => {
        const response = await request(app)
            .get('/form')
            .expect(200);

        expect(response.body.csrfToken).toBeDefined();
        expect(typeof response.body.csrfToken).toBe('string');
    });

    it('should accept POST with valid token', async () => {
        // Get token first
        const getResponse = await request(app)
            .get('/form')
            .expect(200);

        const token = getResponse.body.csrfToken;
        const cookies = getResponse.headers['set-cookie'];

        // Submit form with token
        const postResponse = await request(app)
            .post('/submit')
            .set('Cookie', cookies)
            .set('X-CSRF-Token', token)
            .send({name: 'test', value: 'data'})
            .expect(200);

        expect(postResponse.body.success).toBe(true);
    });

    it('should reject POST without token', async () => {
        await request(app)
            .post('/submit')
            .send({name: 'test', value: 'data'})
            .expect(403);
    });

    it('should reject POST with invalid token', async () => {
        await request(app)
            .post('/submit')
            .set('X-CSRF-Token', 'invalid-token')
            .send({name: 'test', value: 'data'})
            .expect(403);
    });
});
```

### Load Testing

```typescript
import {performance} from 'perf_hooks';

interface LoadTestConfig {
    duration: number;
    concurrentUsers: number;
    requestsPerUser: number;
}

class CsrfLoadTester {
    private protection: CsrfProtection<any, any>;

    constructor(protection: CsrfProtection<any, any>) {
        this.protection = protection;
    }

    async runLoadTest(config: LoadTestConfig): Promise<{
        totalRequests: number;
        successfulRequests: number;
        failedRequests: number;
        avgLatency: number;
        requestsPerSecond: number;
    }> {
        const startTime = performance.now();
        const promises: Promise<boolean>[] = [];

        // Spawn concurrent users
        for (let user = 0; user < config.concurrentUsers; user++) {
            promises.push(this.simulateUser(config.requestsPerUser));
        }

        const results = await Promise.all(promises);
        const endTime = performance.now();

        const totalRequests = config.concurrentUsers * config.requestsPerUser;
        const successfulRequests = results.filter(Boolean).length;
        const failedRequests = totalRequests - successfulRequests;
        const duration = endTime - startTime;
        const avgLatency = duration / totalRequests;
        const requestsPerSecond = (totalRequests / duration) * 1000;

        return {
            totalRequests,
            successfulRequests,
            failedRequests,
            avgLatency,
            requestsPerSecond
        };
    }

    private async simulateUser(requests: number): Promise<boolean> {
        try {
            // Establish session
            const sessionResult = await this.protection.protect(
                {
                    method: 'GET',
                    url: '/init',
                    headers: new Map(),
                    cookies: new Map()
                },
                {}
            );

            if (!sessionResult.success || !sessionResult.token) {
                return false;
            }

            // Extract session data
            const token = sessionResult.token;
            const cookies = sessionResult.response.cookies instanceof Map
                ? sessionResult.response.cookies
                : new Map(Object.entries(sessionResult.response.cookies));

            // Make subsequent requests
            for (let i = 0; i < requests; i++) {
                const result = await this.protection.protect(
                    {
                        method: 'POST',
                        url: `/api/request/${i}`,
                        headers: new Map([['x-csrf-token', token]]),
                        cookies: cookies
                    },
                    {}
                );

                if (!result.success) {
                    return false;
                }

                // Simulate think time
                await new Promise(resolve => setTimeout(resolve, Math.random() * 100));
            }

            return true;
        } catch {
            return false;
        }
    }
}

// Usage
const loadTester = new CsrfLoadTester(protection);
const results = await loadTester.runLoadTest({
    duration: 60000,      // 1 minute
    concurrentUsers: 100,
    requestsPerUser: 10
});

console.log('Load test results:', results);
```

---

## Production Deployment

### Health Checks and Monitoring

```typescript
interface CsrfHealthMetrics {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    avgLatency: number;
    errorRate: number;
    lastError?: string;
    uptime: number;
}

class CsrfHealthMonitor {
    private metrics: CsrfHealthMetrics = {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        avgLatency: 0,
        errorRate: 0,
        uptime: Date.now()
    };

    recordRequest(latency: number, success: boolean, error?: string): void {
        this.metrics.totalRequests++;

        if (success) {
            this.metrics.successfulRequests++;
        } else {
            this.metrics.failedRequests++;
            this.metrics.lastError = error;
        }

        // Update average latency (rolling average)
        this.metrics.avgLatency = (
            (this.metrics.avgLatency * (this.metrics.totalRequests - 1)) + latency
        ) / this.metrics.totalRequests;

        this.metrics.errorRate = (this.metrics.failedRequests / this.metrics.totalRequests) * 100;
    }

    getHealthStatus(): { healthy: boolean; metrics: CsrfHealthMetrics } {
        const healthy = this.metrics.errorRate < 5 && this.metrics.avgLatency < 1000;

        return {
            healthy,
            metrics: {
                ...this.metrics,
                uptime: Date.now() - this.metrics.uptime
            }
        };
    }

    reset(): void {
        this.metrics = {
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            avgLatency: 0,
            errorRate: 0,
            uptime: Date.now()
        };
    }
}

// Health check endpoint
export function createHealthCheckHandler(monitor: CsrfHealthMonitor) {
    return (req: any, res: any) => {
        const {healthy, metrics} = monitor.getHealthStatus();

        res.status(healthy ? 200 : 503).json({
            status: healthy ? 'healthy' : 'unhealthy',
            service: 'csrf-protection',
            timestamp: new Date().toISOString(),
            metrics
        });
    };
}
```

### Configuration Management

```typescript
import {z} from 'zod';

const CsrfConfigSchema = z.object({
    strategy: z.enum(['double-submit', 'signed-double-submit', 'signed-token', 'origin-check', 'hybrid']),
    secret: z.string().min(32, 'Secret must be at least 32 characters'),
    token: z.object({
        expiry: z.number().positive().max(86400, 'Token expiry cannot exceed 24 hours'),
        headerName: z.string().min(1),
        fieldName: z.string().min(1)
    }).optional(),
    cookie: z.object({
        name: z.string().min(1),
        secure: z.boolean(),
        httpOnly: z.boolean(),
        sameSite: z.enum(['strict', 'lax', 'none']),
        path: z.string(),
        domain: z.string().optional(),
        maxAge: z.number().positive().optional()
    }).optional(),
    allowedOrigins: z.array(z.string().url()).optional(),
    excludePaths: z.array(z.string()).optional(),
    skipContentTypes: z.array(z.string()).optional()
});

export function validateCsrfConfig(config: unknown): CsrfConfig {
    try {
        return CsrfConfigSchema.parse(config);
    } catch (error) {
        if (error instanceof z.ZodError) {
            const errorMessages = error.errors.map(e => `${e.path.join('.')}: ${e.message}`);
            throw new Error(`Invalid CSRF configuration:\n${errorMessages.join('\n')}`);
        }
        throw error;
    }
}

export function loadConfigFromEnvironment(): CsrfConfig {
    const config = {
        strategy: process.env.CSRF_STRATEGY || 'signed-double-submit',
        secret: process.env.CSRF_SECRET,
        token: {
            expiry: parseInt(process.env.CSRF_TOKEN_EXPIRY || '3600'),
            headerName: process.env.CSRF_HEADER_NAME || 'X-CSRF-Token',
            fieldName: process.env.CSRF_FIELD_NAME || 'csrf_token'
        },
        cookie: {
            name: process.env.CSRF_COOKIE_NAME || 'csrf-token',
            secure: process.env.CSRF_COOKIE_SECURE !== 'false',
            httpOnly: process.env.CSRF_COOKIE_HTTP_ONLY === 'true',
            sameSite: process.env.CSRF_COOKIE_SAME_SITE || 'lax',
            path: process.env.CSRF_COOKIE_PATH || '/',
            domain: process.env.CSRF_COOKIE_DOMAIN
        },
        allowedOrigins: process.env.CSRF_ALLOWED_ORIGINS?.split(',') || [],
        excludePaths: process.env.CSRF_EXCLUDE_PATHS?.split(',') || [],
        skipContentTypes: process.env.CSRF_SKIP_CONTENT_TYPES?.split(',') || []
    };

    return validateCsrfConfig(config);
}
```

### Deployment Checklist

```markdown
## CSRF Armor Production Deployment Checklist

### Pre-Deployment

- [ ] Generate strong secret (32+ characters) using cryptographically secure method
- [ ] Set `CSRF_SECRET` environment variable in production
- [ ] Configure appropriate strategy for security requirements
- [ ] Set up proper cookie domain for multi-subdomain support
- [ ] Configure allowed origins for CORS scenarios
- [ ] Review and configure path exclusions (minimize exclusions)
- [ ] Enable HTTPS and set `secure: true` for cookies
- [ ] Configure appropriate `sameSite` policy
- [ ] Set up monitoring and alerting
- [ ] Configure log aggregation for security events

### Security Configuration

- [ ] Use `signed-double-submit` or `hybrid` strategy for production
- [ ] Set token expiry appropriate for your use case (15-60 minutes)
- [ ] Configure `sameSite: 'strict'` for high-security applications
- [ ] Enable `secure: true` for all production cookies
- [ ] Minimize `excludePaths` - only exclude truly necessary paths
- [ ] Review `allowedOrigins` - be as restrictive as possible
- [ ] Set up request signing for critical operations (if needed)
- [ ] Configure rate limiting to prevent abuse
- [ ] Set up device fingerprinting for additional security (if needed)

### Performance Configuration

- [ ] Set appropriate token cache TTL
- [ ] Configure connection pooling for database-backed tokens
- [ ] Set up Redis cache for high-traffic scenarios
- [ ] Configure appropriate timeouts
- [ ] Enable compression for responses containing tokens
- [ ] Set up CDN caching rules (exclude CSRF-protected endpoints)

### Monitoring and Alerting

- [ ] Set up health check endpoint
- [ ] Configure metrics collection (requests, errors, latency)
- [ ] Set up alerting for high error rates
- [ ] Configure security event logging
- [ ] Set up log analysis for attack patterns
- [ ] Configure automatic cleanup of expired tokens
- [ ] Monitor memory usage and garbage collection

### Testing

- [ ] Load test CSRF protection under expected traffic
- [ ] Test all supported strategies in production environment
- [ ] Verify CSRF protection works with all client applications
- [ ] Test token refresh mechanisms
- [ ] Verify error handling and logging
- [ ] Test disaster recovery scenarios
- [ ] Verify monitoring and alerting work correctly

### Documentation

- [ ] Document CSRF configuration for team
- [ ] Create runbooks for common issues
- [ ] Document security incident response procedures
- [ ] Create client integration guides
- [ ] Document monitoring and alerting setup
```

---

## Troubleshooting

### Common Issues and Solutions

#### Issue: Token Mismatch Errors

**Symptoms:**

- High rate of CSRF validation failures
- "Token mismatch" errors in logs
- Users unable to submit forms

**Possible Causes:**

1. **Clock skew** between client and server
2. **Incorrect token extraction** in adapter
3. **Cookie domain mismatch**
4. **SameSite policy too restrictive**

**Solutions:**

```typescript
// 1. Add clock tolerance for signed tokens
const config: CsrfConfig = {
    strategy: 'signed-token',
    secret: process.env.CSRF_SECRET!,
    token: {
        expiry: 3600,
        // Add some tolerance for clock skew
        clockTolerance: 30 // 30 seconds
    }
};

// 2. Improve token extraction in adapter
async
getTokenFromRequest(request
:
CsrfRequest, config
:
RequiredCsrfConfig
):
Promise < string | undefined > {
    const headers = request.headers instanceof Map
        ? request.headers
        : new Map(Object.entries(request.headers));

    // Try multiple sources
    return headers.get(config.token.headerName.toLowerCase()) ||
        headers.get('x-xsrf-token') || // Angular default
        headers.get('x-csrftoken') ||  // Django default
        this.extractFromBody(request, config) ||
        this.extractFromQuery(request, config);
}

// 3. Fix cookie domain issues
const config: CsrfConfig = {
    cookie: {
        domain: '.yourdomain.com', // Include leading dot for subdomains
        sameSite: 'lax' // More permissive than 'strict'
    }
};
```

#### Issue: High Memory Usage

**Symptoms:**

- Memory usage grows over time
- Garbage collection pressure
- Eventually memory errors

**Possible Causes:**

1. **Token caching without expiration**
2. **Memory leaks in adapters**
3. **Excessive logging retention**

**Solutions:**

```typescript
// 1. Implement proper cache cleanup
class TokenCache {
    private cache = new Map<string, { token: string; expires: number }>();
    private cleanupInterval: NodeJS.Timeout;

    constructor() {
        // Cleanup expired tokens every 5 minutes
        this.cleanupInterval = setInterval(() => {
            this.cleanup();
        }, 300000);
    }

    private cleanup(): void {
        const now = Date.now();
        for (const [key, value] of this.cache.entries()) {
            if (value.expires < now) {
                this.cache.delete(key);
            }
        }
    }

    destroy(): void {
        clearInterval(this.cleanupInterval);
        this.cache.clear();
    }
}

// 2. Weak references for temporary data
class WeakTokenTracker {
    private tokens = new WeakMap<object, string>();

    setToken(request: object, token: string): void {
        this.tokens.set(request, token);
    }

    getToken(request: object): string | undefined {
        return this.tokens.get(request);
    }

    // Automatic cleanup when request objects are garbage collected
}
```

#### Issue: Performance Degradation

**Symptoms:**

- Increasing response times
- High CPU usage
- Request timeouts

**Possible Causes:**

1. **Inefficient crypto operations**
2. **Database connection exhaustion**
3. **Blocking I/O operations**

**Solutions:**

```typescript
// 1. Optimize crypto operations
class OptimizedCrypto {
    private keyCache = new Map<string, CryptoKey>();

    async getOrCreateKey(secret: string): Promise<CryptoKey> {
        if (this.keyCache.has(secret)) {
            return this.keyCache.get(secret)!;
        }

        const key = await crypto.subtle.importKey(
            'raw',
            new TextEncoder().encode(secret),
            {name: 'HMAC', hash: 'SHA-256'},
            false,
            ['sign', 'verify']
        );

        this.keyCache.set(secret, key);
        return key;
    }
}

// 2. Use connection pooling
import {Pool} from 'pg';

const pool = new Pool({
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});

// 3. Add request queuing for high load
class RequestQueue {
    private queue: Array<() => Promise<void>> = [];
    private processing = false;
    private concurrency = 10;
    private active = 0;

    async add<T>(fn: () => Promise<T>): Promise<T> {
        return new Promise((resolve, reject) => {
            this.queue.push(async () => {
                try {
                    const result = await fn();
                    resolve(result);
                } catch (error) {
                    reject(error);
                }
            });

            this.process();
        });
    }

    private async process(): Promise<void> {
        if (this.processing || this.active >= this.concurrency) return;

        this.processing = true;

        while (this.queue.length > 0 && this.active < this.concurrency) {
            const task = this.queue.shift()!;
            this.active++;

            task().finally(() => {
                this.active--;
                this.process();
            });
        }

        this.processing = false;
    }
}
```

#### Issue: Cross-Origin Request Failures

**Symptoms:**

- CORS errors in browser console
- Origin mismatch errors
- Failed requests from different subdomains

**Solutions:**

```typescript
// 1. Comprehensive origin configuration
const config: CsrfConfig = {
    strategy: 'hybrid',
    allowedOrigins: [
        'https://yourdomain.com',
        'https://www.yourdomain.com',
        'https://app.yourdomain.com',
        'https://admin.yourdomain.com',
        // Add all legitimate origins
    ],
    cookie: {
        domain: '.yourdomain.com', // Cross-subdomain support
        sameSite: 'lax' // Allow cross-site requests
    }
};

// 2. Dynamic origin validation
function createDynamicOriginValidator(allowedPatterns: string[]) {
    const patterns = allowedPatterns.map(pattern =>
        new RegExp(pattern.replace(/\*/g, '.*'))
    );

    return (origin: string): boolean => {
        return patterns.some(pattern => pattern.test(origin));
    };
}

const validator = createDynamicOriginValidator([
    'https://*.yourdomain.com',
    'https://partner.*.com'
]);

// 3. CORS middleware integration
app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin && validator(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
    }
    next();
});
```

### Debugging Tools

```typescript
class CsrfDebugger {
    private enabled: boolean;

    constructor(enabled = process.env.NODE_ENV === 'development') {
        this.enabled = enabled;
    }

    logRequest(request: CsrfRequest, context: string): void {
        if (!this.enabled) return;

        console.log(`[CSRF Debug] ${context}:`, {
            method: request.method,
            url: request.url,
            headers: this.mapToObject(request.headers),
            cookies: this.mapToObject(request.cookies),
            timestamp: new Date().toISOString()
        });
    }

    logValidationResult(result: any, context: string): void {
        if (!this.enabled) return;

        console.log(`[CSRF Debug] ${context} Result:`, {
            success: result.success,
            reason: result.reason,
            token: result.token ? `${result.token.substring(0, 10)}...` : undefined,
            timestamp: new Date().toISOString()
        });
    }

    private mapToObject(map: Map<string, any> | Record<string, any>): Record<string, any> {
        if (map instanceof Map) {
            return Object.fromEntries(map.entries());
        }
        return map;
    }
}

// Usage in protection class
export class DebuggableCsrfProtection<TRequest, TResponse> {
    private protection: CsrfProtection<TRequest, TResponse>;
    private debugger: CsrfDebugger;

    constructor(
        adapter: CsrfAdapter<TRequest, TResponse>,
        config: CsrfConfig,
        debug = false
    ) {
        this.protection = new CsrfProtection(adapter, config);
        this.debugger = new CsrfDebugger(debug);
    }

    async protect(request: TRequest, response: TResponse) {
        const csrfRequest = this.protection['adapter'].extractRequest(request);
        this.debugger.logRequest(csrfRequest, 'Incoming Request');

        const result = await this.protection.protect(request, response);
        this.debugger.logValidationResult(result, 'Validation');

        return result;
    }
}
```

---

This advanced configuration guide provides comprehensive coverage of complex scenarios, custom implementations, and
production deployment considerations for CSRF Armor. For specific implementation questions or advanced use cases not
covered here, please refer to the [API documentation](./API.md) or open an issue on GitHub.