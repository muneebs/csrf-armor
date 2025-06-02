# API Documentation

Complete API reference for `@csrf-armor/core` - framework-agnostic CSRF protection with multiple security strategies.

## Table of Contents

- [Core Classes](#core-classes)
- [Interfaces](#interfaces)
- [Configuration Types](#configuration-types)
- [Token Functions](#token-functions)
- [Error Types](#error-types)
- [Utility Functions](#utility-functions)
- [Strategy Types](#strategy-types)
- [Examples](#examples)

---

## Core Classes

### CsrfProtection<TRequest, TResponse>

The main class for CSRF protection that coordinates validation across different strategies.

```typescript
class CsrfProtection<TRequest, TResponse> {
    constructor(
        adapter: CsrfAdapter<TRequest, TResponse>,
        config?: CsrfConfig
    );

    async protect(
        request: TRequest,
        response: TResponse
    ): Promise<CsrfProtectionResult<TResponse>>;
}
```

#### Parameters

- **adapter**: `CsrfAdapter<TRequest, TResponse>` - Framework-specific adapter
- **config**: `CsrfConfig` (optional) - Configuration options

#### Returns

```typescript
interface CsrfProtectionResult<TResponse> {
    success: boolean;
    response: TResponse;
    token?: string;
    reason?: string;
}
```

#### Example

```typescript
import {CsrfProtection} from '@csrf-armor/core';

const protection = new CsrfProtection(adapter, {
    strategy: 'signed-double-submit',
    secret: 'your-32-character-secret-key'
});

const result = await protection.protect(request, response);
if (result.success) {
    console.log('CSRF token:', result.token);
} else {
    console.error('Validation failed:', result.reason);
}
```

---

## Interfaces

### CsrfAdapter<TRequest, TResponse>

Framework adapter interface that transforms framework-specific requests/responses to the common CSRF format.

```typescript
interface CsrfAdapter<TRequest, TResponse> {
    extractRequest(request: TRequest): CsrfRequest;

    applyResponse(response: TResponse, csrfResponse: CsrfResponse): TResponse;

    getTokenFromRequest(
        request: CsrfRequest,
        config: RequiredCsrfConfig
    ): Promise<string | undefined>;
}
```

#### Methods

##### extractRequest(request)

Converts framework-specific request to common format.

- **request**: `TRequest` - Framework-specific request object
- **Returns**: `CsrfRequest` - Normalized request object

##### applyResponse(response, csrfResponse)

Applies CSRF headers and cookies to framework-specific response.

- **response**: `TResponse` - Framework-specific response object
- **csrfResponse**: `CsrfResponse` - CSRF response data
- **Returns**: `TResponse` - Modified response object

##### getTokenFromRequest(request, config)

Extracts CSRF token from request (headers, body, query params).

- **request**: `CsrfRequest` - Normalized request object
- **config**: `RequiredCsrfConfig` - Current configuration
- **Returns**: `Promise<string | undefined>` - Extracted token or undefined

#### Example Implementation

```typescript
class ExpressAdapter implements CsrfAdapter<express.Request, express.Response> {
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
        }

        // Apply cookies
        if (csrfResponse.cookies instanceof Map) {
            for (const [name, {value, options}] of csrfResponse.cookies) {
                res.cookie(name, value, options);
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

        return headers.get(config.token.headerName.toLowerCase());
    }
}
```

### CsrfRequest

Normalized request object used internally by CSRF protection.

```typescript
interface CsrfRequest {
    method: string;
    url: string;
    headers: Map<string, string> | Record<string, string>;
    cookies: Map<string, string> | Record<string, string>;
    body?: any;
}
```

#### Properties

- **method**: `string` - HTTP method (GET, POST, etc.)
- **url**: `string` - Request URL
- **headers**: `Map<string, string> | Record<string, string>` - Request headers
- **cookies**: `Map<string, string> | Record<string, string>` - Request cookies
- **body**: `any` (optional) - Request body

### CsrfResponse

Response object containing headers and cookies to be applied.

```typescript
interface CsrfResponse {
    headers?: Map<string, string> | Record<string, string>;
    cookies?: Map<string, CookieValue> | Record<string, CookieValue>;
}

interface CookieValue {
    value: string;
    options?: CookieOptions;
}
```

#### Properties

- **headers**: Headers to add to response
- **cookies**: Cookies to set with their options

---

## Configuration Types

### CsrfConfig

Main configuration interface for CSRF protection.

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
```

#### Properties

##### strategy

- **Type**: `CsrfStrategy`
- **Default**: `'signed-double-submit'`
- **Description**: CSRF protection strategy to use

##### secret

- **Type**: `string`
- **Required for**: `signed-double-submit`, `signed-token`, `hybrid`
- **Description**: Secret key for token signing (minimum 32 characters)

##### token

- **Type**: `TokenOptions`
- **Description**: Token-specific configuration

##### cookie

- **Type**: `CookieOptions`
- **Description**: Cookie-specific configuration

##### allowedOrigins

- **Type**: `readonly string[]`
- **Description**: List of allowed origins for origin validation

##### excludePaths

- **Type**: `readonly string[]`
- **Description**: Paths to exclude from CSRF protection

##### skipContentTypes

- **Type**: `readonly string[]`
- **Description**: Content types to skip CSRF validation

### TokenOptions

Configuration for CSRF tokens.

```typescript
interface TokenOptions {
    expiry?: number;
    headerName?: string;
    fieldName?: string;
}
```

#### Properties

##### expiry

- **Type**: `number`
- **Default**: `3600`
- **Description**: Token lifetime in seconds

##### headerName

- **Type**: `string`
- **Default**: `'X-CSRF-Token'`
- **Description**: HTTP header name for token transmission

##### fieldName

- **Type**: `string`
- **Default**: `'csrf_token'`
- **Description**: Form field name for token transmission

### CookieOptions

Configuration for CSRF cookies.

```typescript
interface CookieOptions {
    name?: string;
    secure?: boolean;
    httpOnly?: boolean;
    sameSite?: 'strict' | 'lax' | 'none';
    path?: string;
    domain?: string;
    maxAge?: number;
}
```

#### Properties

##### name

- **Type**: `string`
- **Default**: `'csrf-token'`
- **Description**: Cookie name

##### secure

- **Type**: `boolean`
- **Default**: `true`
- **Description**: Require HTTPS for cookie transmission

##### httpOnly

- **Type**: `boolean`
- **Default**: `false`
- **Description**: Prevent JavaScript access to cookie

##### sameSite

- **Type**: `'strict' | 'lax' | 'none'`
- **Default**: `'lax'`
- **Description**: SameSite policy for cookie

##### path

- **Type**: `string`
- **Default**: `'/'`
- **Description**: Cookie path

##### domain

- **Type**: `string`
- **Description**: Cookie domain (optional)

##### maxAge

- **Type**: `number`
- **Description**: Cookie max age in seconds (optional)

### RequiredCsrfConfig

Internal configuration type with all required fields populated.

```typescript
interface RequiredCsrfConfig {
    strategy: CsrfStrategy;
    secret: string;
    token: Required<TokenOptions>;
    cookie: Required<CookieOptions>;
    allowedOrigins: readonly string[];
    excludePaths: readonly string[];
    skipContentTypes: readonly string[];
}
```

---

## Token Functions

### generateSignedToken(secret, expiry)

Generates a cryptographically signed JWT-style token.

```typescript
function generateSignedToken(secret: string, expiry: number): Promise<string>
```

#### Parameters

- **secret**: `string` - Secret key for signing (minimum 32 characters)
- **expiry**: `number` - Token lifetime in seconds

#### Returns

- **Promise<string>** - Signed token string

#### Example

```typescript
import {generateSignedToken} from '@csrf-armor/core';

const token = await generateSignedToken('your-32-character-secret-key', 3600);
console.log('Generated token:', token);
// Output: "eyJhbGciOiJIUzI1NiJ9.eyJub25jZSI6IjFhMmIzYzRkIiwiZXhwIjoxNjg5ODc2NTQzfQ.signature"
```

### parseSignedToken(token, secret)

Parses and validates a signed token, returning the payload if valid.

```typescript
function parseSignedToken(token: string, secret: string): Promise<TokenPayload>
```

#### Parameters

- **token**: `string` - Signed token to validate
- **secret**: `string` - Secret key used for signing

#### Returns

- **Promise<TokenPayload>** - Token payload if valid

#### Throws

- **TokenExpiredError** - If token has expired
- **TokenInvalidError** - If token signature is invalid

#### Example

```typescript
import {parseSignedToken, TokenExpiredError, TokenInvalidError} from '@csrf-armor/core';

try {
    const payload = await parseSignedToken(token, 'your-32-character-secret-key');
    console.log('Token expires at:', new Date(payload.exp * 1000));
    console.log('Token nonce:', payload.nonce);
} catch (error) {
    if (error instanceof TokenExpiredError) {
        console.error('Token has expired');
    } else if (error instanceof TokenInvalidError) {
        console.error('Invalid token signature');
    }
}
```

### generateNonce(length)

Generates a cryptographically secure random nonce.

```typescript
function generateNonce(length: number): string
```

#### Parameters

- **length**: `number` - Byte length of nonce (output will be hex encoded, so 2x length)

#### Returns

- **string** - Hex-encoded random nonce

#### Example

```typescript
import {generateNonce} from '@csrf-armor/core';

const nonce = generateNonce(16); // 32 hex characters
console.log('Generated nonce:', nonce);
// Output: "1a2b3c4d5e6f7890abcdef1234567890"
```

### TokenPayload

Payload structure for signed tokens.

```typescript
interface TokenPayload {
    nonce: string;
    exp: number;
}
```

#### Properties

- **nonce**: `string` - Random nonce for token uniqueness
- **exp**: `number` - Expiration timestamp (Unix epoch)

---

## Error Types

### CsrfError

Base error class for all CSRF-related errors.

```typescript
class CsrfError extends Error {
    constructor(
        message: string,
        public readonly code: string,
        public readonly statusCode: number = 403
    );
}
```

#### Properties

- **code**: `string` - Error code for programmatic handling
- **statusCode**: `number` - HTTP status code (default: 403)

### TokenExpiredError

Thrown when a token has expired.

```typescript
class TokenExpiredError extends CsrfError {
    constructor(expiredAt: Date);
}
```

#### Properties

- **code**: `'TOKEN_EXPIRED'`
- **statusCode**: `403`

#### Example

```typescript
import {TokenExpiredError} from '@csrf-armor/core';

try {
    await parseSignedToken(expiredToken, secret);
} catch (error) {
    if (error instanceof TokenExpiredError) {
        console.log('Token expired, please refresh');
    }
}
```

### TokenInvalidError

Thrown when a token signature is invalid.

```typescript
class TokenInvalidError extends CsrfError {
    constructor(reason?: string);
}
```

#### Properties

- **code**: `'TOKEN_INVALID'`
- **statusCode**: `403`

### OriginMismatchError

Thrown when request origin doesn't match allowed origins.

```typescript
class OriginMismatchError extends CsrfError {
    constructor(origin: string, allowedOrigins: readonly string[]);
}
```

#### Properties

- **code**: `'ORIGIN_MISMATCH'`
- **statusCode**: `403`

### ConfigurationError

Thrown when configuration is invalid.

```typescript
class ConfigurationError extends CsrfError {
    constructor(message: string);
}
```

#### Properties

- **code**: `'CONFIGURATION_ERROR'`
- **statusCode**: `500`

---

## Utility Functions

### createCsrfProtection(adapter, config)

Factory function to create a configured CSRF protection instance.

```typescript
function createCsrfProtection<TRequest, TResponse>(
    adapter: CsrfAdapter<TRequest, TResponse>,
    config?: CsrfConfig
): CsrfProtection<TRequest, TResponse>
```

#### Parameters

- **adapter**: `CsrfAdapter<TRequest, TResponse>` - Framework adapter
- **config**: `CsrfConfig` (optional) - Configuration options

#### Returns

- **CsrfProtection<TRequest, TResponse>** - Configured protection instance

#### Example

```typescript
import {createCsrfProtection} from '@csrf-armor/core';

const protection = createCsrfProtection(expressAdapter, {
    strategy: 'hybrid',
    secret: process.env.CSRF_SECRET,
    cookie: {secure: true, sameSite: 'strict'}
});
```

### validateRequest(request, config, getTokenFromRequest)

Low-level function for request validation.

```typescript
function validateRequest(
    request: CsrfRequest,
    config: RequiredCsrfConfig,
    getTokenFromRequest: (req: CsrfRequest, config: RequiredCsrfConfig) => Promise<string | undefined>
): Promise<ValidationResult>
```

#### Parameters

- **request**: `CsrfRequest` - Request to validate
- **config**: `RequiredCsrfConfig` - CSRF configuration
- **getTokenFromRequest**: Token extraction function

#### Returns

- **Promise<ValidationResult>** - Validation result

### ValidationResult

Result object from request validation.

```typescript
interface ValidationResult {
    isValid: boolean;
    reason?: string;
    token?: string;
}
```

#### Properties

- **isValid**: `boolean` - Whether validation passed
- **reason**: `string` (optional) - Failure reason if invalid
- **token**: `string` (optional) - Generated/validated token

### mergeConfig(defaultConfig, userConfig)

Merges user configuration with defaults.

```typescript
function mergeConfig(
    defaultConfig: RequiredCsrfConfig,
    userConfig?: CsrfConfig
): RequiredCsrfConfig
```

#### Parameters

- **defaultConfig**: `RequiredCsrfConfig` - Default configuration
- **userConfig**: `CsrfConfig` (optional) - User overrides

#### Returns

- **RequiredCsrfConfig** - Merged configuration

### isExcludedPath(path, excludedPaths)

Checks if a path should be excluded from CSRF protection.

```typescript
function isExcludedPath(path: string, excludedPaths: readonly string[]): boolean
```

#### Parameters

- **path**: `string` - Request path to check
- **excludedPaths**: `readonly string[]` - List of excluded paths

#### Returns

- **boolean** - True if path should be excluded

#### Example

```typescript
import {isExcludedPath} from '@csrf-armor/core';

const excluded = isExcludedPath('/api/webhooks/stripe', ['/api/webhooks', '/health']);
console.log(excluded); // true
```

---

## Strategy Types

### CsrfStrategy

Union type for available CSRF protection strategies.

```typescript
type CsrfStrategy =
    | 'double-submit'
    | 'signed-double-submit'
    | 'signed-token'
    | 'origin-check'
    | 'hybrid'
```

#### Strategy Descriptions

##### double-submit

- **Security**: ⭐⭐⭐
- **Performance**: ⭐⭐⭐⭐⭐
- **Description**: Basic double-submit cookie pattern without signing
- **Use Case**: Development, low-security applications

##### signed-double-submit

- **Security**: ⭐⭐⭐⭐⭐
- **Performance**: ⭐⭐⭐⭐
- **Description**: Double-submit with cryptographic token signing
- **Use Case**: Production web applications (recommended)

##### signed-token

- **Security**: ⭐⭐⭐⭐
- **Performance**: ⭐⭐⭐⭐
- **Description**: Server-side token validation with signing
- **Use Case**: APIs, microservices

##### origin-check

- **Security**: ⭐⭐⭐
- **Performance**: ⭐⭐⭐⭐⭐
- **Description**: Origin header validation only
- **Use Case**: High-performance APIs, mobile backends

##### hybrid

- **Security**: ⭐⭐⭐⭐⭐
- **Performance**: ⭐⭐⭐
- **Description**: Combines multiple strategies for maximum security
- **Use Case**: High-security applications (banking, healthcare)

---

## Examples

### Basic Express.js Setup

```typescript
import express from 'express';
import {createCsrfProtection, CsrfAdapter} from '@csrf-armor/core';

// Create adapter
class ExpressAdapter implements CsrfAdapter<express.Request, express.Response> {
    // ... implementation
}

// Create protection
const csrfProtection = createCsrfProtection(new ExpressAdapter(), {
    strategy: 'signed-double-submit',
    secret: process.env.CSRF_SECRET!
});

// Apply middleware
app.use(async (req, res, next) => {
    const result = await csrfProtection.protect(req, res);
    if (result.success) {
        (req as any).csrfToken = result.token;
        next();
    } else {
        res.status(403).json({error: 'CSRF validation failed'});
    }
});
```

### Next.js API Route

```typescript
import {NextRequest, NextResponse} from 'next/server';
import {createCsrfProtection} from '@csrf-armor/core';

const csrfProtection = createCsrfProtection(nextjsAdapter, {
    strategy: 'signed-double-submit',
    secret: process.env.CSRF_SECRET!
});

export async function POST(request: NextRequest) {
    const response = NextResponse.next();
    const result = await csrfProtection.protect(request, response);

    if (!result.success) {
        return NextResponse.json(
            {error: 'CSRF validation failed'},
            {status: 403}
        );
    }

    // Process request...
    return NextResponse.json({success: true});
}
```

### Custom Token Validation

```typescript
import {generateSignedToken, parseSignedToken} from '@csrf-armor/core';

async function customTokenFlow() {
    const secret = 'your-32-character-secret-key';

    // Generate token
    const token = await generateSignedToken(secret, 3600);

    // Later, validate token
    try {
        const payload = await parseSignedToken(token, secret);
        console.log('Valid token, expires:', new Date(payload.exp * 1000));
    } catch (error) {
        console.error('Invalid token:', error.message);
    }
}
```

### Error Handling

```typescript
import {
    CsrfError,
    TokenExpiredError,
    TokenInvalidError,
    OriginMismatchError
} from '@csrf-armor/core';

app.use(async (req, res, next) => {
    try {
        const result = await csrfProtection.protect(req, res);
        if (result.success) {
            next();
        } else {
            throw new CsrfError(result.reason || 'CSRF validation failed', 'CSRF_FAILED');
        }
    } catch (error) {
        if (error instanceof TokenExpiredError) {
            res.status(401).json({error: 'Token expired', code: 'TOKEN_EXPIRED'});
        } else if (error instanceof TokenInvalidError) {
            res.status(403).json({error: 'Invalid token', code: 'TOKEN_INVALID'});
        } else if (error instanceof OriginMismatchError) {
            res.status(403).json({error: 'Origin not allowed', code: 'ORIGIN_MISMATCH'});
        } else if (error instanceof CsrfError) {
            res.status(error.statusCode).json({error: error.message, code: error.code});
        } else {
            next(error);
        }
    }
});
```

### Configuration Validation

```typescript
import {mergeConfig, ConfigurationError} from '@csrf-armor/core';

function createSecureConfig() {
    try {
        const config = mergeConfig(DEFAULT_CONFIG, {
            strategy: 'hybrid',
            secret: process.env.CSRF_SECRET,
            cookie: {
                secure: true,
                sameSite: 'strict'
            },
            allowedOrigins: ['https://yourdomain.com'],
            excludePaths: ['/api/webhooks']
        });

        return config;
    } catch (error) {
        if (error instanceof ConfigurationError) {
            console.error('Configuration error:', error.message);
            process.exit(1);
        }
        throw error;
    }
}
```

---

## Type Definitions

For TypeScript users, all types are exported from the main package:

```typescript
import type {
    CsrfConfig,
    CsrfAdapter,
    CsrfRequest,
    CsrfResponse,
    CsrfStrategy,
    TokenOptions,
    CookieOptions,
    ValidationResult,
    TokenPayload,
    CsrfProtectionResult
} from '@csrf-armor/core';
```

---

## Constants

### DEFAULT_CONFIG

Default configuration values used when options are not specified.

```typescript
const DEFAULT_CONFIG: RequiredCsrfConfig = {
    strategy: 'signed-double-submit',
    secret: '', // Must be provided by user
    token: {
        expiry: 3600,
        headerName: 'X-CSRF-Token',
        fieldName: 'csrf_token'
    },
    cookie: {
        name: 'csrf-token',
        secure: true,
        httpOnly: false,
        sameSite: 'lax',
        path: '/',
        domain: undefined,
        maxAge: undefined
    },
    allowedOrigins: [],
    excludePaths: [],
    skipContentTypes: []
};
```

### SAFE_METHODS

HTTP methods considered safe and excluded from CSRF validation.

```typescript
const SAFE_METHODS: readonly string[] = ['GET', 'HEAD', 'OPTIONS'];
```

---

## Browser Compatibility

CSRF Armor uses standard Web APIs and is compatible with:

- Node.js 16+
- Modern browsers (ES2020+)
- Edge runtime environments (Vercel, Cloudflare Workers)

---

This API documentation covers all public interfaces and functions in `@csrf-armor/core`. For implementation examples and
advanced usage patterns, see the [Advanced Configuration Guide](./ADVANCED.md).