# Security Policy

## Reporting Security Vulnerabilities

**Security is important to me.** If you find a security vulnerability in CSRF-Armor, I'd appreciate you letting me know privately so I can fix it quickly.

### How to Report

**Please don't report security vulnerabilities through public GitHub issues.**

Instead, please email me at: **security@nebz.dev**

Please include:
- What type of issue it is (e.g., authentication bypass, token validation flaw, etc.)
- Which files or functions are affected
- Steps to reproduce the issue
- Any proof-of-concept code if you have it
- How serious you think the impact might be

### What to Expect

As a solo developer, here's what I can realistically promise:

- **Quick acknowledgment**: I'll respond within 2-3 days (usually sooner)
- **Investigation**: I'll assess the issue within a week
- **Updates**: I'll keep you posted on my progress
- **Fix timeline**: Critical issues get fixed ASAP, others within 2-4 weeks
- **Credit**: You'll get full credit for the discovery (unless you prefer anonymity)

*Note: I work on this project in my spare time, but security issues always get priority.*

---

## Supported Versions

I provide security updates for these versions:

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | ✅ **Current** (actively maintained) |

**My recommendation:** Always use the latest version for the best security and features.

---

## Security Approach

### My Security Process

As a solo maintainer, here's how I handle security:

1. **Private fixes first**: I fix security issues privately before announcing them
2. **Community coordination**: I work with reporters to make sure fixes actually work
3. **Responsible disclosure**: Once a fix is ready, I publish details to help everyone stay secure
4. **Learning opportunity**: Every security issue helps me make the library better

### Timeline (Realistic for Solo Dev)

- **Day 1-3**: I see your report and respond
- **Week 1**: I understand the issue and start working on a fix
- **Week 2-4**: I develop, test, and release the fix
- **After release**: I publish details so others can learn

For serious actively-exploited vulnerabilities, I'll drop everything and fix it immediately.

---

## Security Best Practices for Users

*This is the really important stuff - please read this section!*

### 🔒 Essential Security Setup

#### 1. Use Strong Secrets

```typescript
// ✅ GOOD: Strong, random secret
const secret = process.env.CSRF_SECRET; // 32+ random characters
```

```typescript
// ❌ BAD: Don't do this
const secret = 'password123';
const secret = 'default-secret-change-this'; // Never use the default!
```

**Generate a strong secret:**
```bash
# Easy way to generate a good secret
openssl rand -base64 32

# Or in Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

#### 2. Production Configuration

```typescript
// This is how I recommend setting it up for production
const csrfProtect = createCsrfMiddleware({
  strategy: 'signed-double-submit',
  secret: process.env.CSRF_SECRET!,
  cookie: {
    secure: true,           // HTTPS only - this is important!
    sameSite: 'strict',     // Strict protection
    httpOnly: false,        // Needed for client access in some strategies
  },
});

// Always validate your secrets
if (process.env.NODE_ENV === 'production' && !process.env.CSRF_SECRET) {
  throw new Error('You MUST set CSRF_SECRET in production!');
}
```

#### 3. Strategy Recommendations

Based on my experience, here's what I recommend:

| Your Situation | Strategy | Why |
|---------------|----------|-----|
| **Just starting out** | `double-submit` | Simple and effective |
| **Production web app** | `signed-double-submit` | Good security without complexity |
| **High-security app** | `hybrid` | Maximum protection |
| **API with known clients** | `origin-check` + `signed-token` | Fast and secure |

---

## What CSRF-Armor Actually Protects

### ✅ What I Built This to Stop

- **CSRF attacks** - The main thing! Stops malicious sites from making requests as your users
- **Session riding** - Prevents unauthorized actions using someone's session
- **Cross-origin form submissions** - Blocks forms from other sites

### ⚠️ What This Doesn't Fix

CSRF-Armor is focused on one thing. It doesn't protect against:
- **XSS attacks** - Use Content Security Policy for this
- **SQL injection** - Use parameterized queries
- **Bad authentication** - That's a separate concern
- **Authorization bugs** - Still need proper access controls

Think of CSRF-Armor as one layer in your security stack, not the whole thing.

---

## Best Practices

### ❌ Please Don't Do This

```typescript
// These configurations are dangerous:
const csrfProtect = createCsrfMiddleware({
  secret: 'password123',              // Too weak!
  cookie: { 
    secure: false,                    // Allows HTTP in production - bad!
    sameSite: 'none'                  // Too permissive
  },
  excludePaths: ['/*'],               // This disables all protection!
  allowedOrigins: ['*']               // Allows requests from anywhere
});
```

### ✅ Do This Instead

```typescript
const csrfProtect = createCsrfMiddleware({
  strategy: 'signed-double-submit',
  secret: process.env.CSRF_SECRET!,    // Strong secret from environment
  cookie: {
    secure: process.env.NODE_ENV === 'production', // HTTPS in prod
    sameSite: 'strict',               // Strict protection
  },
  excludePaths: [
    '/api/webhooks',                  // Only exclude what you need to
    '/health'                         // Be specific!
  ],
  allowedOrigins: [
    'https://yourdomain.com',         // List your actual domains
    'https://app.yourdomain.com'
  ]
});
```

---

## How I Test Security

### Automated Security Pipeline

**GitHub Actions (Every Push/PR):**
- **CodeQL Analysis**: Comprehensive security scanning for vulnerabilities
- **Custom Security Checks**: CSRF-specific vulnerability detection
- **Dependency Scanning**: Automatic alerts for vulnerable dependencies
- **Weekly Security Scans**: Scheduled deep security analysis

**Local Development Tools:**
```bash
# Comprehensive security analysis (run before committing)
pnpm run security:check

# Specific vulnerability checks
pnpm run security:secrets     # Detects hardcoded secrets
pnpm run security:timing      # Finds timing attack vulnerabilities  
pnpm run security:random      # Identifies weak random generation
```

### What You Can Do

Monitor your app for weird stuff:

```typescript
// Log CSRF failures - this helps you spot attacks
export async function middleware(request: NextRequest) {
  const result = await csrfProtect(request, response);
  
  if (!result.success) {
    console.warn('CSRF validation failed:', {
      reason: result.reason,
      ip: request.ip,
      userAgent: request.headers.get('user-agent'),
      url: request.url,
      timestamp: new Date().toISOString(),
    });
  }
  
  return result.response;
}
```

If you see lots of failures from the same IP, that might be an attack.

---

## Staying Secure

### Get Security Updates

- **Watch this repo** on GitHub for security announcements
- **Run `npm audit`** regularly to check for dependency issues
- **Update promptly** when I release security fixes
- **Test first** but don't wait too long to deploy security updates

### When I Release Security Fixes

1. **Update immediately** for critical issues
2. **Test in staging** if you can, but don't delay too long
3. **Check the changelog** for any breaking changes
4. **Watch your logs** after updating

---

## Security Monitoring

### Continuous Security

**Automated Monitoring:**
- **Weekly scans**: Comprehensive security analysis every Monday
- **Dependency alerts**: Real-time notifications for vulnerable packages
- **Build security**: Every release is automatically scanned
- **Community reports**: GitHub security advisories integration

**Security Metrics I Track:**
- Time to fix critical security issues (target: < 24 hours)
- Security test coverage percentage
- False positive rates in automated scans
- Community security feedback response time

### How You Can Help

**Report Security Issues:**
- Use private reporting (email) for vulnerabilities
- Include reproduction steps and impact assessment
- Test on your own systems, not production apps

**Stay Secure:**
- Enable GitHub security alerts for your projects using CSRF-Armor
- Run `pnpm audit` regularly in your applications
- Monitor your application logs for unusual CSRF failure patterns

## Contact Me

### For Security Issues
- **Email**: muneeb@nebz.dev
  - *Questions? Email me: security@nebz.dev*
- **Response time**: Usually within 24-48 hours
- **Best for**: Vulnerabilities, security questions, urgent issues

### For Everything Else
- **GitHub Issues**: Bug reports, feature requests, general questions
- **GitHub Discussions**: Community help, usage questions

---

## The Fine Print

### Responsible Security Research

I welcome security research! If you're testing CSRF-Armor:
- Report issues privately first (give me a chance to fix them)
- Don't test on other people's apps without permission
- Be patient - I'm just one person, but I take security seriously

### What This Policy Covers

This applies to:
- All official CSRF-Armor packages (`@csrf-armor/*`)
- Code and examples in this repository
- Official releases on NPM

This doesn't cover:
- Apps that use CSRF-Armor (that's between you and the app developers)
- Unofficial forks or modifications
- Third-party dependencies (report those to their maintainers)

---

## A Personal Note

Security is something I care deeply about, especially for a library that's supposed to protect people. I know I'm just one person maintaining this, but I take that responsibility seriously.

If you find a security issue, please reach out. I'd much rather fix it privately than have people get hurt because I missed something.

And if you're using CSRF-Armor in production, please take the time to configure it properly. The defaults are decent, but security always needs thoughtful configuration for your specific situation.

Stay safe out there! 🔒

---

*Last updated: 01 April 2025*  
*Questions? Email me: security@nebz.dev*
