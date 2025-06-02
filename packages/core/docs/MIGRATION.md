# Migration Guide

This guide helps you migrate from existing CSRF protection libraries to `@csrf-armor/core`. We cover the most popular
libraries with step-by-step instructions, code examples, and best practices.

## Table of Contents

- [Before You Migrate](#before-you-migrate)
- [Migrating from csurf (Express)](#migrating-from-csurf-express)
- [Migrating from csrf (Node.js)](#migrating-from-csrf-nodejs)
- [Migrating from lusca (Express)](#migrating-from-lusca-express)
- [Migrating from @fastify/csrf](#migrating-from-fastifycsrf)
- [Migrating from koa-csrf](#migrating-from-koa-csrf)
- [Migrating from next-csrf](#migrating-from-next-csrf)
- [Custom Implementation Migration](#custom-implementation-migration)
- [Testing Your Migration](#testing-your-migration)
- [Rollback Strategy](#rollback-strategy)

---

## Before You Migrate

### Assessment Checklist

Before starting your migration, assess your current setup:

- [ ] **Identify current library**: Which CSRF library are you using?
- [ ] **Document current configuration**: Token names, cookie settings, exclusions
- [ ] **Map current strategy**: Understand your current protection method
- [ ] **List integration points**: Where CSRF tokens are generated/validated
- [ ] **Review client-side code**: How tokens are handled in frontend
- [ ] **Test coverage**: Ensure you have tests for CSRF-protected endpoints

### Why Migrate to CSRF Armor?

**Benefits over existing libraries:**

- **Multiple strategies**: Choose the best approach for your use case
- **Framework agnostic**: Works with any Node.js framework
- **Modern TypeScript**: Full type safety and modern async/await
- **Zero dependencies**: No supply chain vulnerabilities
- **Active maintenance**: Regular updates and security patches
- **Better performance**: Optimized for modern applications

### Migration Strategy

**Recommended approach:**

1. **Gradual migration**: Migrate one route group at a time
2. **Parallel testing**: Run both libraries temporarily for comparison
3. **Feature parity**: Ensure all existing functionality is preserved
5. **Rollback plan**: Have a quick rollback strategy ready

---

## Migrating from csurf (Express)

**csurf** is the most popular Express.js CSRF middleware but is now deprecated. Here's how to migrate to CSRF Armor.

### Current csurf Setup

```javascript
// Before: using csurf
const express = require('express');
const csrf = require('csurf');
const cookieParser = require('cookie-parser');

const app = express();
app.use(cookieParser());

// csurf middleware
const csrfProtection = csrf({
    cookie: true,
    httpOnly: true,
    secure: true,
    sameSite: 'strict'
});

app.use(csrfProtection);

app.get('/form', (req, res) => {
    res.render('form', {csrfToken: req.csrfToken()});
});

app.post('/submit', (req, res) => {
    // CSRF validation happens automatically
    res.json({success: true});
});
```

### CSRF Armor Migration

```typescript
// After: using CSRF Armor
import express from 'express';
import {CsrfAdapter, createCsrfProtection, CsrfRequest, CsrfResponse} from '@csrf-armor/core';

const app = express();

// Create Express adapter
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

    async getTokenFromRequest(request: CsrfRequest, config: any): Promise<string | undefined> {
        const headers = request.headers instanceof Map
            ? request.headers
            : new Map(Object.entries(request.headers));

        // Try header first (X-CSRF-Token)
        const headerValue = headers.get(config.token.headerName.toLowerCase());
        if (headerValue) return headerValue;

        // Try form body (_csrf field)
        if (request.body && typeof request.body === 'object') {
            const body = request.body as Record<string, unknown>;
            const formValue = body[config.token.fieldName];
            if (typeof formValue === 'string') return formValue;
        }

        return undefined;
    }
}

// Configure CSRF protection
const csrfProtection = createCsrfProtection(new ExpressAdapter(), {
    strategy: 'signed-double-submit', // More secure than csurf's default
    secret: process.env.CSRF_SECRET!,
    cookie: {
        name: 'csrf-token',     // csurf default: '_csrf'
        httpOnly: false,        // Allow client access for some strategies
        secure: true,
        sameSite: 'strict'
    }
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

app.get('/form', (req, res) => {
    res.render('form', {csrfToken: (req as any).csrfToken});
});

app.post('/submit', (req, res) => {
    // CSRF validation already completed in middleware
    res.json({success: true});
});
```

### Configuration Mapping

| csurf Option                     | CSRF Armor Equivalent            | Notes                                            |
|----------------------------------|----------------------------------|--------------------------------------------------|
| `cookie: true`                   | `cookie: { name: 'csrf-token' }` | Enable cookie-based tokens                       |
| `httpOnly: true`                 | `cookie: { httpOnly: false }`    | CSRF Armor needs client access for double-submit |
| `secure: true`                   | `cookie: { secure: true }`       | Direct mapping                                   |
| `sameSite: 'strict'`             | `cookie: { sameSite: 'strict' }` | Direct mapping                                   |
| `value: req => req.body._csrf`   | Custom `getTokenFromRequest`     | Extract from form field                          |
| `ignoreMethods: ['GET', 'HEAD']` | Built-in safe method handling    | Automatic                                        |

### Frontend Changes

**csurf approach:**

```html
<!-- Form with hidden CSRF token -->
<form method="POST" action="/submit">
    <input type="hidden" name="_csrf" value="{{csrfToken}}">
    <button type="submit">Submit</button>
</form>
```

**CSRF Armor approach (same, but more flexible):**

```html
<!-- Option 1: Form field (compatible with csurf) -->
<form method="POST" action="/submit">
    <input type="hidden" name="csrf_token" value="{{csrfToken}}">
    <button type="submit">Submit</button>
</form>

<!-- Option 2: Header-based (AJAX) -->
<script>
    fetch('/submit', {
        method: 'POST',
        headers: {
            'X-CSRF-Token': '{{csrfToken}}',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({data: 'example'})
    });
</script>
```

---

## Migrating from csrf (Node.js)

The `csrf` library is a standalone Node.js CSRF protection library.

### Current csrf Setup

```javascript
// Before: using csrf library
const Tokens = require('csrf');
const tokens = new Tokens();

// Generate secret and token
const secret = tokens.secretSync();
const token = tokens.create(secret);

// Validation
const isValid = tokens.verify(secret, token);
```

### CSRF Armor Migration

```typescript
// After: using CSRF Armor
import {generateSignedToken, parseSignedToken} from '@csrf-armor/core';

// Generate token (replaces secret + token generation)
const secret = process.env.CSRF_SECRET!; // Store secret in environment
const token = await generateSignedToken(secret, 3600); // 1 hour expiry

// Validation (replaces verify method)
try {
    const payload = await parseSignedToken(token, secret);
    console.log('Token valid until:', new Date(payload.exp * 1000));
} catch (error) {
    console.log('Token validation failed:', error.message);
}
```

### Framework Integration

**Before (manual integration):**

```javascript
const express = require('express');
const Tokens = require('csrf');
const tokens = new Tokens();

const app = express();

app.use((req, res, next) => {
    if (!req.session.csrfSecret) {
        req.session.csrfSecret = tokens.secretSync();
    }

    req.csrfToken = () => tokens.create(req.session.csrfSecret);

    if (req.method !== 'GET') {
        const token = req.headers['x-csrf-token'] || req.body._csrf;
        if (!tokens.verify(req.session.csrfSecret, token)) {
            return res.status(403).json({error: 'Invalid CSRF token'});
        }
    }

    next();
});
```

**After (CSRF Armor with adapter pattern):**

```typescript
import {createCsrfProtection} from '@csrf-armor/core';

const csrfProtection = createCsrfProtection(new ExpressAdapter(), {
    strategy: 'signed-token', // No need for server-side secrets storage
    secret: process.env.CSRF_SECRET!,
    token: {
        expiry: 3600,
        headerName: 'X-CSRF-Token',
        fieldName: '_csrf'
    }
});

app.use(async (req, res, next) => {
    const result = await csrfProtection.protect(req, res);
    if (result.success) {
        req.csrfToken = result.token;
        next();
    } else {
        res.status(403).json({error: 'CSRF validation failed'});
    }
});
```

---

## Migrating from lusca (Express)

**lusca** is a comprehensive Express.js security middleware that includes CSRF protection.

### Current lusca Setup

```javascript
// Before: using lusca
const express = require('express');
const lusca = require('lusca');

const app = express();

app.use(lusca({
    csrf: {
        key: '_csrf',
        secret: 'my-secret',
        impl: 'synchronizer-token'
    },
    csp: { /* CSP config */},
    xframe: 'SAMEORIGIN'
}));
```

### CSRF Armor Migration

```typescript
// After: CSRF Armor + other security headers
import express from 'express';
import helmet from 'helmet'; // For other security headers
import {createCsrfProtection} from '@csrf-armor/core';

const app = express();

// Replace lusca's other security features with helmet
app.use(helmet({
    contentSecurityPolicy: { /* CSP config */},
    frameguard: {action: 'sameorigin'}
}));

// Replace CSRF protection with CSRF Armor
const csrfProtection = createCsrfProtection(new ExpressAdapter(), {
    strategy: 'signed-double-submit', // More secure than synchronizer-token
    secret: process.env.CSRF_SECRET!,
    token: {
        fieldName: '_csrf', // Match lusca's key
        headerName: 'X-CSRF-Token'
    }
});

app.use(async (req, res, next) => {
    const result = await csrfProtection.protect(req, res);
    if (result.success) {
        req.csrfToken = result.token;
        next();
    } else {
        res.status(403).json({error: 'CSRF validation failed'});
    }
});
```

### Configuration Mapping

| lusca CSRF Option            | CSRF Armor Equivalent                   |
|------------------------------|-----------------------------------------|
| `key: '_csrf'`               | `token: { fieldName: '_csrf' }`         |
| `secret: 'string'`           | `secret: process.env.CSRF_SECRET`       |
| `impl: 'synchronizer-token'` | `strategy: 'signed-token'`              |
| `header: 'x-csrf-token'`     | `token: { headerName: 'X-CSRF-Token' }` |

---

## Migrating from @fastify/csrf

### Current @fastify/csrf Setup

```javascript
// Before: using @fastify/csrf
const fastify = require('fastify')({logger: true});

await fastify.register(require('@fastify/csrf-protection'), {
    sessionPlugin: '@fastify/secure-session',
    cookieKey: 'csrf-token',
    cookieOpts: {httpOnly: true}
});

fastify.post('/protected', async (request, reply) => {
    // CSRF protection automatic
    return {success: true};
});
```

### CSRF Armor Migration

```typescript
// After: CSRF Armor with Fastify
import Fastify from 'fastify';
import {CsrfAdapter, createCsrfProtection} from '@csrf-armor/core';

const fastify = Fastify({logger: true});

// Create Fastify adapter
class FastifyAdapter implements CsrfAdapter<any, any> {
    extractRequest(req: any) {
        return {
            method: req.method,
            url: req.url,
            headers: new Map(Object.entries(req.headers)),
            cookies: new Map(Object.entries(req.cookies || {})),
            body: req.body
        };
    }

    applyResponse(reply: any, csrfResponse: any) {
        // Apply headers
        if (csrfResponse.headers instanceof Map) {
            for (const [key, value] of csrfResponse.headers) {
                reply.header(key, value);
            }
        }

        // Apply cookies
        if (csrfResponse.cookies instanceof Map) {
            for (const [name, {value, options}] of csrfResponse.cookies) {
                reply.setCookie(name, value, options);
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

const csrfProtection = createCsrfProtection(new FastifyAdapter(), {
    strategy: 'signed-double-submit',
    secret: process.env.CSRF_SECRET!,
    cookie: {
        name: 'csrf-token',
        httpOnly: false
    }
});

// Add preHandler hook
fastify.addHook('preHandler', async (request, reply) => {
    const result = await csrfProtection.protect(request, reply);
    if (!result.success) {
        reply.code(403).send({error: 'CSRF validation failed'});
    } else {
        request.csrfToken = result.token;
    }
});

fastify.post('/protected', async (request, reply) => {
    return {success: true};
});
```

---

## Migrating from koa-csrf

### Current koa-csrf Setup

```javascript
// Before: using koa-csrf
const Koa = require('koa');
const csrf = require('koa-csrf');

const app = new Koa();

app.use(csrf({
    invalidSessionSecretMessage: 'Invalid session secret',
    invalidSessionSecretStatusCode: 403,
    invalidTokenMessage: 'Invalid CSRF token',
    invalidTokenStatusCode: 403,
    excludedMethods: ['GET', 'HEAD', 'OPTIONS'],
    disableQuery: false
}));

app.use(async (ctx, next) => {
    if (ctx.method === 'POST') {
        // CSRF validation automatic
    }
    await next();
});
```

### CSRF Armor Migration

```typescript
// After: CSRF Armor with Koa
import Koa from 'koa';
import {CsrfAdapter, createCsrfProtection} from '@csrf-armor/core';

const app = new Koa();

// Create Koa adapter
class KoaAdapter implements CsrfAdapter<any, any> {
    extractRequest(ctx: any) {
        return {
            method: ctx.method,
            url: ctx.url,
            headers: new Map(Object.entries(ctx.headers)),
            cookies: new Map(Object.entries(ctx.cookies || {})),
            body: ctx.request.body
        };
    }

    applyResponse(ctx: any, csrfResponse: any) {
        // Apply headers
        if (csrfResponse.headers instanceof Map) {
            for (const [key, value] of csrfResponse.headers) {
                ctx.set(key, value);
            }
        }

        // Apply cookies
        if (csrfResponse.cookies instanceof Map) {
            for (const [name, {value, options}] of csrfResponse.cookies) {
                ctx.cookies.set(name, value, options);
            }
        }

        return ctx;
    }

    async getTokenFromRequest(request: any, config: any) {
        const headers = request.headers instanceof Map
            ? request.headers
            : new Map(Object.entries(request.headers));

        // Try header first
        const headerValue = headers.get(config.token.headerName.toLowerCase());
        if (headerValue) return headerValue;

        // Try query parameter
        if (request.url) {
            const url = new URL(request.url, 'http://localhost');
            const queryValue = url.searchParams.get(config.token.fieldName);
            if (queryValue) return queryValue;
        }

        return undefined;
    }
}

const csrfProtection = createCsrfProtection(new KoaAdapter(), {
    strategy: 'signed-double-submit',
    secret: process.env.CSRF_SECRET!
});

app.use(async (ctx, next) => {
    const result = await csrfProtection.protect(ctx, ctx);
    if (!result.success) {
        ctx.status = 403;
        ctx.body = {error: 'CSRF validation failed'};
    } else {
        ctx.csrfToken = result.token;
        await next();
    }
});
```

---

## Migrating from next-csrf

### Current next-csrf Setup

```javascript
// Before: using next-csrf
import csrf from 'next-csrf';

const {csrfToken, nocsrf} = csrf({
    secret: 'my-secret'
});

// API route
export default async function handler(req, res) {
    await nocsrf(req, res);

    if (req.method === 'POST') {
        // Protected
        res.json({success: true});
    } else {
        // Get token
        const token = csrfToken(req, res);
        res.json({csrfToken: token});
    }
}
```

### CSRF Armor Migration

```typescript
// After: using @csrf-armor/nextjs
import {NextRequest, NextResponse} from 'next/server';
import {createNextJSMiddleware} from '@csrf-armor/nextjs';

// Middleware (recommended approach)
export const middleware = createNextJSMiddleware({
    strategy: 'signed-double-submit',
    secret: process.env.CSRF_SECRET!
});

export const config = {
    matcher: ['/api/protected/:path*']
};

// Or manual API route protection
import {createCsrfProtection} from '@csrf-armor/core';
import {NextJSAdapter} from '@csrf-armor/nextjs';

const csrfProtection = createCsrfProtection(new NextJSAdapter(), {
    strategy: 'signed-double-submit',
    secret: process.env.CSRF_SECRET!
});

export default async function handler(req: NextRequest) {
    const response = NextResponse.next();
    const result = await csrfProtection.protect(req, response);

    if (!result.success) {
        return NextResponse.json(
            {error: 'CSRF validation failed'},
            {status: 403}
        );
    }

    if (req.method === 'POST') {
        return NextResponse.json({success: true});
    } else {
        return NextResponse.json({csrfToken: result.token});
    }
}
```

---

## Custom Implementation Migration

If you have a custom CSRF implementation, here's how to migrate:

### Assess Your Current Implementation

**Common custom patterns:**

```javascript
// Pattern 1: Session-based tokens
app.use((req, res, next) => {
    if (!req.session.csrfToken) {
        req.session.csrfToken = crypto.randomBytes(32).toString('hex');
    }

    if (req.method === 'POST') {
        const token = req.headers['x-csrf-token'];
        if (token !== req.session.csrfToken) {
            return res.status(403).json({error: 'Invalid CSRF token'});
        }
    }

    next();
});

// Pattern 2: JWT-based tokens
const jwt = require('jsonwebtoken');

app.use((req, res, next) => {
    if (req.method === 'GET') {
        const token = jwt.sign({type: 'csrf'}, secret, {expiresIn: '1h'});
        req.csrfToken = token;
    } else {
        const token = req.headers['x-csrf-token'];
        try {
            jwt.verify(token, secret);
        } catch (err) {
            return res.status(403).json({error: 'Invalid CSRF token'});
        }
    }

    next();
});
```

### Migration to CSRF Armor

```typescript
// Unified approach with CSRF Armor
const csrfProtection = createCsrfProtection(new ExpressAdapter(), {
    // Choose strategy based on your current approach:
    strategy: 'signed-token',        // For JWT-like implementations
    // OR
    strategy: 'signed-double-submit', // For session-based implementations

    secret: process.env.CSRF_SECRET!,
    token: {
        expiry: 3600, // Match your current token lifetime
        headerName: 'X-CSRF-Token', // Match your current header
        fieldName: 'csrf_token' // Match your current field name
    }
});

// Replace your custom middleware
app.use(async (req, res, next) => {
    const result = await csrfProtection.protect(req, res);
    if (result.success) {
        req.csrfToken = result.token;
        next();
    } else {
        res.status(403).json({error: 'CSRF validation failed'});
    }
});
```

---

## Testing Your Migration

### Unit Tests

```typescript
import {describe, it, expect} from '@jest/globals';
import request from 'supertest';

describe('CSRF Migration Tests', () => {
    it('should maintain backward compatibility with token field names', async () => {
        // Get CSRF token
        const tokenResponse = await request(app)
            .get('/form')
            .expect(200);

        const token = tokenResponse.body.csrfToken;

        // Test with old field name (if you're maintaining compatibility)
        const response = await request(app)
            .post('/submit')
            .send({_csrf: token, data: 'test'}) // Old field name
            .expect(200);

        expect(response.body.success).toBe(true);
    });

    it('should work with existing frontend code', async () => {
        // Test that existing AJAX calls still work
        const tokenResponse = await request(app)
            .get('/api/token')
            .expect(200);

        const token = tokenResponse.body.csrfToken;

        const response = await request(app)
            .post('/api/submit')
            .set('X-CSRF-Token', token) // Existing header name
            .send({data: 'test'})
            .expect(200);

        expect(response.body.success).toBe(true);
    });
});
```

---

## Rollback Strategy

### Preparation

**Before migration:**

1. **Tag your current version**: `git tag pre-csrf-armor-migration`
2. **Document current configuration**: Save all CSRF-related settings
3. **Create rollback scripts**: Automate the rollback process
4. **Test rollback procedure**: Ensure you can quickly revert

### Feature Flag Approach

```typescript
// Gradual migration with feature flags
const USE_CSRF_ARMOR = process.env.USE_CSRF_ARMOR === 'true';

if (USE_CSRF_ARMOR) {
    // CSRF Armor implementation
    app.use(async (req, res, next) => {
        const result = await csrfProtection.protect(req, res);
        if (result.success) {
            req.csrfToken = result.token;
            next();
        } else {
            res.status(403).json({error: 'CSRF validation failed'});
        }
    });
} else {
    // Original implementation
    app.use(csrf({cookie: true}));
}
```

### Monitoring

```typescript
// Add monitoring during migration
app.use((req, res, next) => {
    const startTime = Date.now();

    // Your CSRF protection here

    const endTime = Date.now();

    // Log performance metrics
    console.log('CSRF validation time:', endTime - startTime, 'ms');

    // Track error rates
    if (res.statusCode === 403) {
        console.error('CSRF validation failed for:', req.url);
    }

    next();
});
```

### Quick Rollback

```bash
#!/bin/bash
# rollback.sh

echo "Rolling back CSRF Armor migration..."

# Revert to previous version
git checkout pre-csrf-armor-migration

# Reinstall old dependencies
npm install csurf@1.11.0  # or your previous version

# Restart application
pm2 restart app

echo "Rollback complete"
```

---

## Migration Checklist

### Pre-Migration

- [ ] Document current CSRF configuration
- [ ] Identify all CSRF-protected endpoints
- [ ] Review frontend token handling code
- [ ] Create comprehensive test suite
- [ ] Set up monitoring and logging
- [ ] Prepare rollback strategy

### During Migration

- [ ] Install CSRF Armor packages
- [ ] Create framework adapter
- [ ] Configure CSRF protection strategy
- [ ] Update middleware/route handlers
- [ ] Test token generation and validation
- [ ] Verify frontend compatibility

### Post-Migration

- [ ] Monitor error rates and performance
- [ ] Verify all protected endpoints work
- [ ] Test with real user scenarios
- [ ] Update documentation
- [ ] Train team on new library
- [ ] Remove old CSRF library dependencies

### Common Migration Issues

**Token field name mismatches:**

```typescript
// Solution: Configure field names to match old implementation
const config = {
    token: {
        fieldName: '_csrf',      // Match csurf default
        headerName: 'X-CSRF-Token'
    }
};
```

**Cookie name conflicts:**

```typescript
// Solution: Use different cookie name or clear old cookies
const config = {
    cookie: {
        name: 'new-csrf-token' // Avoid conflicts
    }
};
```

**Frontend token extraction:**

```typescript
// Update frontend to handle new token location
// Old: const token = document.querySelector('meta[name="csrf-token"]').content;
// New: Ensure token is available in same location or update extraction
```

This migration guide provides step-by-step instructions for moving from popular CSRF libraries to CSRF Armor while
maintaining functionality and security.