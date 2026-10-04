# CSRF-Armor

<img src="https://cdn.nebz.dev/csrf-armor/logo.jpeg" alt="CSRF Armor" />

[![CodeQL](https://github.com/muneebs/csrf-armor/workflows/CodeQL%20Security%20Analysis/badge.svg)](https://github.com/muneebs/csrf-armor/actions/workflows/codeql-analysis.yml)
[![CI](https://github.com/muneebs/csrf-armor/workflows/CI/badge.svg)](https://github.com/muneebs/csrf-armor/actions/workflows/ci.yml)
[![npm version](https://badge.fury.io/js/%40csrf-armor%2Fcore.svg)](https://badge.fury.io/js/%40csrf-armor%2Fcore)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Modern, framework-agnostic CSRF protection library with multiple security strategies.

* ✅ **Framework Agnostic**: Works with Next.js, Node.js/Express, Vite, and more
* 🔐 **Multiple Strategies**: Signed Token, Double Submit Cookie, Signed Double Submit, Origin Check, Hybrid
* 🚀 **Edge Runtime Compatible**: Uses Web Crypto API for modern environments
* 📦 **Zero Dependencies**: Secure and lightweight core library
* 🔧 **Highly Configurable**: Customize tokens, cookies, paths, and validation logic
* ✅ **Well Tested**: Comprehensive test coverage
* 📦 **ESM Only**: Modern ESM packages with TypeScript support
* 🔒 **Automated Security Scanning**: CodeQL analysis and custom security checks

---

## 📦 Packages

### Framework-Specific Packages

| Package                                      | Description                      | Install                     |
|----------------------------------------------|----------------------------------|-----------------------------|
| **[@csrf-armor/nextjs](./packages/nextjs)**  | Next.js App Router middleware    | `npm i @csrf-armor/nextjs`  |
| **[@csrf-armor/express](./packages/express)** | Express.js middleware | `npm i @csrf-armor/express` |

> more framework specific packages coming soon.

### Core Package

| Package | Description | Install |
|---------|-------------|---------|
| **[@csrf-armor/core](./packages/core)** | Framework-agnostic core | `npm i @csrf-armor/core` |

---

## 🛡️ Security Strategies

### 1. Signed Token Strategy
```typescript
{
  strategy: 'signed-token',
  secret: process.env.CSRF_SECRET!,
  token: { expiry: 3600 }
}
```
- **How it works**: Verifies HMAC and expiration, then requires the submitted token to match the incoming CSRF cookie
- **Best for**: Stateless applications, microservices
- **Security**: High (cryptographic protection + expiry)

### 2. Double Submit Cookie Strategy
```typescript
{
  strategy: 'double-submit'
}
```
- **How it works**: Same token in cookie and request header
- **Best for**: Local Development
- **Security**: Very Low (Not recommended for production)

### 3. Signed Double Submit Cookie Strategy ⭐
```typescript
{
  strategy: 'signed-double-submit',
  secret: process.env.CSRF_SECRET!
}
```
- **How it works**: Unsigned token in client-accessible cookie and request headers, signed token in server-only cookie for validation
- **Best for**: High-security applications, financial services
- **Security**: Very High (combines cryptographic signing + double submit pattern)

### 4. Origin Check Strategy
```typescript
{
  strategy: 'origin-check',
  allowedOrigins: ['https://yourdomain.com']
}
```
- **How it works**: Validates Origin/Referer headers
- **Best for**: APIs with known client origins
- **Security**: Medium (can be bypassed by some proxies)

### 5. Hybrid Strategy
```typescript
{
  strategy: 'hybrid',
  secret: process.env.CSRF_SECRET!,
  allowedOrigins: ['https://yourdomain.com']
}
```
- **How it works**: Combines cookie-bound signed tokens + origin validation
- **Best for**: Maximum security requirements
- **Security**: Maximum (multiple validation layers)

---

## 🔒 Security Recommendations

### Strategy Selection Guide

| Use Case | Recommended Strategy | Why |
|----------|---------------------|-----|
| **Banking/Financial** | `signed-double-submit` | Cryptographic protection + double validation |
| **E-commerce** | `signed-double-submit` or `hybrid` | Strong protection for transactions |
| **General Web Apps** | `double-submit` | Good balance of security and simplicity |
| **Public APIs** | `origin-check` + `signed-token` | Control access origins |
| **Microservices** | `signed-token` | Stateless, works across services |
| **High Traffic Sites** | `double-submit` | Minimal overhead |
| **Enterprise/Admin** | `hybrid` | Maximum security layers |

### Security Best Practices

1. **Always use HTTPS** in production (`cookie.secure: true`)
2. **Use strong secrets** (32+ random characters, rotate periodically)
3. **Set appropriate cookie attributes**:
   - `sameSite: 'strict'` for maximum protection
   - `httpOnly: false` only when client access is needed
   - `secure: true` in production
4. **Monitor for attacks** - log validation failures
5. **Set short token expiry** (1-4 hours) for sensitive operations

**⚠️ Important Security Notes:**
- Never use default secrets in production
- The `signed-double-submit` strategy requires `httpOnly: false` for client cookie access
- Always validate your CSRF secret is properly set: `process.env.CSRF_SECRET`

---

## ⚙️ Configuration Options

All packages share the same core configuration interface:

```typescript
interface CsrfConfig {
  strategy?: 'double-submit' | 'signed-double-submit' | 'signed-token' | 'origin-check' | 'hybrid';
  secret?: string;
  token?: {
    expiry?: number;           // Token expiry in seconds (default: 3600)
    headerName?: string;       // Header name (default: 'X-CSRF-Token')
    fieldName?: string;        // Form field name (default: 'csrf_token')
  };
  cookie?: {
    name?: string;             // Cookie name (default: 'csrf-token')
    prefix?: '__Host-' | '__Secure-' | false; // Browser-enforced name prefix (default: none)
    secure?: boolean;          // Secure flag (default: true)
    httpOnly?: boolean;        // HttpOnly flag (default: false)
    sameSite?: 'strict' | 'lax' | 'none'; // SameSite (default: 'lax')
    path?: string;             // Path (default: '/')
    domain?: string;           // Domain (optional)
    maxAge?: number;           // Max age in seconds (optional)
  };
  allowedOrigins?: string[];   // Allowed origins for origin-check
  excludePaths?: string[];     // Paths to exclude from CSRF protection
  skipContentTypes?: string[]; // Content types to skip
}
```

**Hardening tip:** set `cookie: { prefix: '__Host-' }` in production. The browser
then refuses CSRF cookies set by sibling subdomains or plain-HTTP origins, which
closes cookie-tossing attacks on the cookie-based strategies. It cannot be
combined with `cookie.domain`. See
[Cookie Prefixes](./packages/core/README.md#cookie-prefixes-__host---__secure-).

---


## 🔒 Security & Analysis

### Automated Security Scanning

CSRF-Armor includes comprehensive security analysis:

- **CodeQL Analysis**: Automated scanning on every PR and push
- **Weekly Security Scans**: Scheduled vulnerability detection
- **Custom Security Checks**: CSRF-specific vulnerability detection

### Local Security Testing

```bash
# Run comprehensive security checks
pnpm run security:check

# Check for specific issues
pnpm run security:secrets     # Hardcoded secrets
pnpm run security:timing      # Timing attack vulnerabilities  
pnpm run security:random      # Weak random generation
```
---

## 📚 Framework Documentation

- **[Next.js Package](./packages/nextjs/README.md)** - App Router middleware, React hooks
- **[Core Package](./packages/core/README.md)** - Framework-agnostic implementation

---

## ⚡ Performance Characteristics

**Strategy Performance (Relative):**

| Strategy | Computational Overhead | Memory Usage | Security Level | Best Use Case |
|----------|------------------------|---------------|----------------|---------------|
| **origin-check** | Minimal (header validation) | Minimal | Medium | Known client origins |
| **double-submit** | Very Low (no cryptography) | Low | Medium | General web applications |
| **signed-double-submit** | Low (1 HMAC operation) | Low | High | High-security applications |
| **signed-token** | Low (1 HMAC operation) | Low | High | Stateless APIs |
| **hybrid** | Medium (HMAC + headers) | Low | Highest | Maximum security needs |

**Performance Notes:**
- Origin-check and double-submit have minimal CPU overhead
- Signed strategies require HMAC operations (Web Crypto API)
- Hybrid strategy combines multiple validation steps
- Actual performance depends on hardware, request volume, and implementation details

---

## 🛠️ Development

### Setup
```bash
git clone https://github.com/muneebs/csrf-armor.git
cd csrf-armor
pnpm install
```

### Commands
```bash
pnpm build              # Build all packages
pnpm test               # Run all tests
pnpm lint               # Lint all packages
pnpm security:check     # Run security analysis
pnpm audit              # Check for vulnerable dependencies
pnpm clean              # Clean build artifacts
```

### Package Structure
```
csrf-armor/
├── packages/
│   ├── core/         # Framework-agnostic core
│   └── nextjs/       # Next.js adapter
├── package.json      # Root package
└── pnpm-workspace.yaml
```

---

## 🧪 Testing Your Implementation

### Quick Security Check

```typescript
// Test CSRF protection is working
const testCsrf = async () => {
  // This should fail without proper CSRF token
  try {
    await fetch('/api/protected', { method: 'POST' });
  } catch (error) {
    console.log('✅ CSRF protection is working');
  }

  // This should succeed with proper token
  const response = await csrfFetch('/api/protected', { method: 'POST' });
  console.log('✅ Legitimate requests work');
};
```

### Strategy Validation

```typescript
// Verify your strategy is correctly configured
const config = {
  strategy: 'signed-double-submit',
  secret: process.env.CSRF_SECRET,
};

// Check secret is set
if (!config.secret) {
  throw new Error('❌ CSRF secret not properly configured!');
}

console.log('✅ CSRF configuration looks good');
```

---

## 📄 License

MIT © [Muneeb Samuels](https://github.com/muneebs)

---

## 🔗 Links

- [📚 Documentation](https://github.com/muneebs/csrf-armor#readme)
- [🐛 Issue Tracker](https://github.com/muneebs/csrf-armor/issues)
- [📦 NPM Packages](https://www.npmjs.com/search?q=%40csrf-armor)
- [🔒 Security Policy](./SECURITY.md)
