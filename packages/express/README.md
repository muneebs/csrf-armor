# @csrf-armor/express

<img src="https://cdn.nebz.dev/csrf-armor/logo.jpeg" alt="CSRF Armor" />

[![CI](https://github.com/muneebs/csrf-armor/workflows/CI/badge.svg)](https://github.com/muneebs/csrf-armor/actions/workflows/ci.yml)
[![npm version](https://badge.fury.io/js/@csrf-armor%2Fexpress.svg)](https://badge.fury.io/js/@csrf-armor%2Fexpress)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)
[![Express.js](https://img.shields.io/badge/Express.js-4%2B-black.svg)](https://expressjs.com)

Express.js adapter for CSRF Armor - Advanced CSRF protection for Express.js applications.

---
## Installation

```bash
npm install @csrf-armor/express
# or
yarn add @csrf-armor/express
# or
pnpm add @csrf-armor/express
```
---
## Usage

```typescript
import express from 'express';
import { csrfMiddleware } from '@csrf-armor/express';

const app = express();

// Create the CSRF middleware
const csrfProtect = csrfMiddleware({
  // Optional configuration
  excludePaths: ['/webhook'], // Paths to exclude from CSRF protection
  strategy: 'signed-double-submit', // CSRF protection strategy
  secret: 'your-secret-key', // Required for signed strategies
  cookie: {
    name: 'csrf-token',
    options: {
      httpOnly: true,
      secure: true,
      sameSite: 'strict'
    }
  }
});

// Apply the middleware to protected routes
app.use('/api', csrfProtect);

// Your routes here
app.post('/api/data', (req, res) => {
  res.json({ success: true });
});
```
---
## Configuration

The middleware accepts all configuration options from `@csrf-armor/core`. See the [core documentation](../core) for detailed configuration options.

---

## 📄 License

MIT © [Muneeb Samuels](https://github.com/muneebs)

---

## 📦 Related Packages

- **[@csrf-armor/core](../core)** - Framework-agnostic CSRF protection

---

**Questions?** [Open an issue](https://github.com/muneebs/csrf-armor/issues)
or [start a discussion](https://github.com/muneebs/csrf-armor/discussions)!
