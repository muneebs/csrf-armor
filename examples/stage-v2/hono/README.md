# @csrf-armor/hono

Hono adapter for CSRF Armor v2.

This package is staged under `examples/stage-v2/hono/` because the workspace
sandbox prevents creating new top-level `packages/*` directories. When the
repo is moved to a writable environment, copy this folder to
`packages/hono/` and add it to `pnpm-workspace.yaml`.

## Usage

```ts
import { Hono } from 'hono';
import { csrfMiddleware } from '@csrf-armor/hono';

const app = new Hono();
app.use(csrfMiddleware({ secret: process.env.CSRF_SECRET }));
```

See the core package documentation for strategy and configuration details.
