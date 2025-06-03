# Security Analysis

This document provides a comprehensive security analysis of @csrf-armor/core, including attack vectors,
security guarantees, and best practices for secure deployment.

## Table of Contents

- [Security Model Overview](#security-model-overview)
- [CSRF Attack Vectors](#csrf-attack-vectors)
- [Strategy Security Analysis](#strategy-security-analysis)
- [Security Best Practices](#security-best-practices)
- [Additional Security Resources](#additional-security-resources)

---

## Security Model Overview

### Core Security Principles

CSRF Armor is built on several fundamental security principles:

1. **Defense in Depth**: Multiple strategies can be layered for enhanced protection
2. **Principle of Least Privilege**: Tokens have minimal necessary scope and lifetime
3. **Cryptographic Integrity**: Signed strategies use HMAC-SHA256 for token validation
4. **Same-Origin Policy Enforcement**: Origin validation prevents cross-site attacks
5. **Secure by Default**: Production configurations emphasize security over convenience

### Security Guarantees

**What CSRF Armor Protects Against:**

- ✅ Cross-Site Request Forgery (CSRF/XSRF) attacks
- ✅ State-changing operations from malicious sites
- ✅ Subdomain-based CSRF attacks (with proper configuration)
- ✅ Token replay attacks (with signed strategies and proper expiry)
- ✅ Man-in-the-middle token tampering (with signed strategies)

**What CSRF Armor Does NOT Protect Against:**

- ❌ Cross-Site Scripting (XSS) - use Content Security Policy (CSP)
- ❌ SQL Injection - use parameterized queries
- ❌ Authentication bypass - use proper session management
- ❌ Authorization failures - implement proper access controls
- ❌ Social engineering attacks

---

## CSRF Attack Vectors

### Traditional CSRF Attack

**Attack Scenario:**

1. User logs into `bank.com` and receives session cookie
2. User visits malicious site `evil.com`
3. `evil.com` contains hidden form targeting `bank.com/transfer`
4. Form auto-submits with user's session cookie
5. Bank processes fraudulent transfer

**How CSRF Armor Prevents This:**

```html
<!-- Malicious form on evil.com -->
<form action="https://bank.com/transfer" method="POST" style="display:none">
    <input name="to" value="attacker-account">
    <input name="amount" value="10000">
    <!-- ❌ Missing CSRF token - request will be rejected -->
</form>
```

### Subdomain CSRF Attack

**Attack Scenario:**

1. Attacker compromises subdomain `blog.bank.com`
2. Attacker injects malicious JavaScript
3. Script makes CSRF requests to `app.bank.com`
4. Requests include session cookies due to shared domain

**Protection Strategy:**

```typescript
// ✅ Proper subdomain protection
const config = {
    strategy: 'signed-double-submit',
    secret: process.env.CSRF_SECRET!,
    cookie: {
        domain: '.bank.com',      // Shared across subdomains
        sameSite: 'lax',          // Allow cross-subdomain requests
        secure: true             // HTTPS only
    },
    allowedOrigins: [
        'https://app.bank.com',   // Explicitly allow known subdomains
        'https://admin.bank.com'
    ]
};
```

### JSON CSRF Attack

**Attack Scenario:**

1. API accepts JSON requests without CSRF protection
2. Attacker uses HTML form with `text/plain` content-type
3. Browser sends form data that gets parsed as JSON
4. API processes malicious request

**Example Vulnerable Endpoint:**

```typescript
// ❌ Vulnerable: No CSRF protection for JSON endpoint
app.post('/api/transfer', (req, res) => {
    const {to, amount} = req.body;
    processTransfer(req.user.id, to, amount);
});
```

**Secure Implementation:**

```typescript
// ✅ Protected: CSRF validation for all state-changing requests
app.use(csrfProtection);
app.post('/api/transfer', (req, res) => {
    // CSRF validation happens in middleware
    const {to, amount} = req.body;
    processTransfer(req.user.id, to, amount);
});
```

### PDF-based CSRF

**Attack Scenario:**

1. Attacker hosts malicious PDF file
2. Plugin makes cross-origin requests ignoring same-origin policy
3. Requests include cookies and bypass CSRF protection

**Protection Strategy:**

```typescript
// ✅ Strict origin validation
const config = {
    strategy: 'hybrid',
    allowedOrigins: [
        'https://app.com'  // Only allow specific origins
    ],
    cookie: {
        sameSite: 'strict'  // Block all cross-site requests
    }
};
```

---

## Strategy Security Analysis

### Double Submit Cookie

**Security Level:** ⭐⭐⭐ (Good)

**How It Works:**

- Same token stored in cookie and submitted via form/header
- Relies on Same-Origin Policy preventing cookie access from other domains

**Security Strengths:**

- ✅ Simple and fast implementation
- ✅ No server-side token storage required
- ✅ Protects against basic CSRF attacks

**Security Weaknesses:**

- ❌ Vulnerable if attacker can set cookies (subdomain takeover)
- ❌ No cryptographic validation
- ❌ Susceptible to token fixation attacks

**Recommended Use Cases:**

- Development environments
- Low-risk applications
- Applications with good subdomain security

**Security Configuration:**

```typescript
const secureDoubleSubmit = {
    strategy: 'double-submit',
    cookie: {
        secure: true,           // HTTPS only
        sameSite: 'strict',     // Prevent cross-site cookie sending
        httpOnly: false,        // Allow client access for token comparison
        path: '/'
    },
    excludePaths: []          // Minimize exclusions
};
```

### Signed Double Submit Cookie

**Security Level:** ⭐⭐⭐⭐⭐ (Excellent)

**How It Works:**

- Client receives unsigned token in header/accessible cookie
- Server stores cryptographically signed token in httpOnly cookie
- Server validates unsigned token against signed cookie using HMAC

**Security Strengths:**

- ✅ Cryptographic validation prevents tampering
- ✅ Protection against subdomain attacks
- ✅ No server-side state required
- ✅ Resistant to token fixation

**Security Weaknesses:**

- ❌ Slightly higher computational overhead
- ❌ Requires secure secret management

**Recommended Use Cases:**

- Production web applications
- E-commerce platforms
- Financial services
- Healthcare applications

**Security Configuration:**

```typescript
const secureSignedDoubleSubmit = {
    strategy: 'signed-double-submit',
    secret: generateSecureSecret(), // 32+ bytes
    token: {
        expiry: 1800  // 30 minutes max
    },
    cookie: {
        secure: true,
        sameSite: 'strict',
        httpOnly: false,
        path: '/',
        domain: '.yourdomain.com'
    }
};

function generateSecureSecret(): string {
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}
```

### Signed Token

**Security Level:** ⭐⭐⭐⭐ (Very Good)

**How It Works:**

- Self-contained tokens with timestamp, nonce, and HMAC signature
- Stateless validation using cryptographic verification
- Format: `{timestamp}.{nonce}.{signature}`

**Security Strengths:**

- ✅ Stateless operation (good for microservices)
- ✅ Cryptographic integrity protection
- ✅ Built-in expiration handling
- ✅ Suitable for API-first architectures

**Security Weaknesses:**

- ❌ Token replay possible within expiry window
- ❌ Requires clock synchronization
- ❌ No protection against XSS-based token theft

**Recommended Use Cases:**

- REST APIs
- Microservices
- Mobile app backends
- Stateless applications

**Security Configuration:**

```typescript
const secureSignedToken = {
    strategy: 'signed-token',
    secret: process.env.CSRF_SECRET!,
    token: {
        expiry: 900,  // 15 minutes for APIs
        headerName: 'X-CSRF-Token'
    },
    allowedOrigins: [
        'https://api.yourdomain.com'
    ]
};
```

### Origin Check

**Security Level:** ⭐⭐⭐ (Good)

**How It Works:**

- Validates Origin and Referer headers against whitelist
- Relies on browser security headers
- Minimal computational overhead

**Security Strengths:**

- ✅ Very fast performance
- ✅ Simple implementation
- ✅ Good for known-origin scenarios

**Security Weaknesses:**

- ❌ Relies on browser header integrity
- ❌ Some browsers/proxies strip headers
- ❌ Vulnerable to header spoofing in some scenarios

**Recommended Use Cases:**

- Mobile app backends with known origins
- High-performance APIs
- Internal services with controlled clients

**Security Configuration:**

```typescript
const secureOriginCheck = {
    strategy: 'origin-check',
    allowedOrigins: [
        'https://app.yourdomain.com',
        'https://mobile.yourdomain.com'
        // Be very specific - never use wildcards
    ],
    cookie: {
        secure: true,
        sameSite: 'strict'
    }
};
```

### Hybrid

**Security Level:** ⭐⭐⭐⭐⭐ (Maximum)

**How It Works:**

- Combines signed token validation with origin checking
- Multiple layers of protection
- Highest security but more computational overhead

**Security Strengths:**

- ✅ Multiple independent security layers
- ✅ Cryptographic validation + header validation
- ✅ Protection against various attack vectors
- ✅ Suitable for high-security environments

**Security Weaknesses:**

- ❌ Higher computational cost
- ❌ More complex configuration
- ❌ Potential for misconfiguration

**Recommended Use Cases:**

- Banking and financial applications
- Healthcare systems
- Government applications
- High-value transaction systems

**Security Configuration:**

```typescript
const maximumSecurity = {
    strategy: 'hybrid',
    secret: process.env.CSRF_SECRET!,
    token: {
        expiry: 900  // Short expiry for high security
    },
    allowedOrigins: [
        'https://secure.bank.com'  // Very restrictive origins
    ],
    cookie: {
        secure: true,
        sameSite: 'strict',
        httpOnly: false,
        path: '/'
    },
    excludePaths: [],  // No exclusions for maximum security
    skipContentTypes: []
};
```

---

## Security Best Practices

### Secret Management

#### Secret Generation

```typescript
// ✅ Secure secret generation
function generateCsrfSecret(): string {
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    return Array.from(bytes, byte =>
        byte.toString(16).padStart(2, '0')
    ).join('');
}

// ✅ Environment-based configuration
const secret = process.env.CSRF_SECRET;
if (!secret || secret.length < 64) {
    throw new Error('CSRF_SECRET must be at least 64 hex characters');
}
```

#### Secret Rotation

```typescript
// ✅ Support for secret rotation
class RotatingSecretManager {
    constructor(
        private currentSecret: string,
        private previousSecret?: string
    ) {
    }

    async validateToken(token: string): Promise<boolean> {
        try {
            // Try current secret first
            await parseSignedToken(token, this.currentSecret);
            return true;
        } catch {
            // Fall back to previous secret during rotation
            if (this.previousSecret) {
                try {
                    await parseSignedToken(token, this.previousSecret);
                    return true;
                } catch {
                    return false;
                }
            }
            return false;
        }
    }
}
```

#### Secret Storage

```typescript
// ✅ Secure secret storage patterns
// 1. Environment variables (development/simple deployments)
const secret = process.env.CSRF_SECRET;

// 2. Key management services (production)
import {SecretsManager} from 'aws-sdk';

const secretsManager = new SecretsManager();
const secret = await secretsManager.getSecretValue({
    SecretId: 'csrf-secret'
}).promise();

// 3. Kubernetes secrets
// Mount secret as file and read
const secret = fs.readFileSync('/etc/secrets/csrf-secret', 'utf8');
```

### Cookie Security

#### Secure Cookie Configuration

```typescript
const productionCookieConfig = {
    name: 'csrf-token',
    secure: true,           // HTTPS only
    httpOnly: false,        // Allow client access where needed
    sameSite: 'strict',     // Strictest same-site policy
    path: '/',              // Minimize path scope
    domain: '.yourdomain.com', // Specific domain only
    maxAge: 1800           // 30 minutes maximum
};
```

#### Cookie Security Headers

```typescript
// ✅ Additional security headers
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    next();
});
```

### Origin Validation

#### Strict Origin Configuration

```typescript
// ✅ Secure origin validation
const secureOrigins = {
    allowedOrigins: [
        'https://app.yourdomain.com',
        'https://admin.yourdomain.com'
        // Never use wildcards or 'null'
        // Never include 'http://' in production
    ]
};

// ✅ Dynamic origin validation for complex scenarios
function createOriginValidator(allowedPatterns: RegExp[]) {
    return (origin: string): boolean => {
        if (!origin) return false;
        return allowedPatterns.some(pattern => pattern.test(origin));
    };
}

const validator = createOriginValidator([
    /^https:\/\/[\w-]+\.yourdomain\.com$/,
    /^https:\/\/yourdomain\.com$/
]);
```

### Token Management

#### Token Expiry

```typescript
// ✅ Appropriate token expiry by use case
const expiryByRisk = {
    'high-risk': 300,      // 5 minutes - financial transactions
    'medium-risk': 1800,   // 30 minutes - general web apps
    'low-risk': 3600      // 1 hour - read-heavy applications
};

// ✅ Grace period handling
const config = {
    token: {
        expiry: 1800,
        gracePeriod: 300  // 5 minute grace for clock skew
    }
};
```

#### Token Storage

```typescript
// ✅ Secure client-side token storage
class SecureTokenStorage {
    private static readonly TOKEN_KEY = 'csrf-token';

    static storeToken(token: string): void {
        // Use sessionStorage, not localStorage
        sessionStorage.setItem(this.TOKEN_KEY, token);
    }

    static getToken(): string | null {
        return sessionStorage.getItem(this.TOKEN_KEY);
    }

    static clearToken(): void {
        sessionStorage.removeItem(this.TOKEN_KEY);
    }
}
```

### Path and Content-Type Exclusions

#### Minimal Exclusions

```typescript
// ✅ Secure exclusion patterns
const secureExclusions = {
    excludePaths: [
        '/api/webhooks',      // External webhooks only
        '/health',            // Health checks only
        '/metrics'            // Monitoring only
        // Avoid excluding entire API paths
    ],
    skipContentTypes: [
        // Only exclude if absolutely necessary
        // Consider CSRF protection for all content types
    ]
};

// ❌ Dangerous exclusions
const dangerousExclusions = {
    excludePaths: [
        '/api/*',             // Too broad
        '/admin/*',           // Admin actions need protection
        '/user/*'             // User actions need protection
    ],
    skipContentTypes: [
        'application/json'    // JSON APIs still need CSRF protection
    ]
};
```

## Additional Security Resources

- [OWASP Cheat Sheet Series](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)

This security analysis provides comprehensive coverage of CSRF Armor's security model, best practices, and deployment
considerations. Regular updates to this document ensure continued alignment with evolving security threats and industry
standards.
