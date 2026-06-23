# @csrf-armor/sveltekit

SvelteKit adapter for CSRF Armor v2.

This package is staged under `examples/stage-v2/sveltekit/` because the
workspace sandbox prevents creating new top-level `packages/*` directories.
When the repo is moved to a writable environment, copy this folder to
`packages/sveltekit/` and add it to `pnpm-workspace.yaml`.

## Usage

```ts
// src/hooks.server.ts
import { csrfHandle } from '@csrf-armor/sveltekit';

export const handle = csrfHandle({ secret: process.env.CSRF_SECRET });
```

See the core package documentation for strategy and configuration details.
