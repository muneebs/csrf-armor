# CSRF Armor: Next.js example

A small App Router app protected by `@csrf-armor/nextjs`. It has an in-memory
counter so you can see whether a request got through.

## Run it

From the repository root:

```bash
pnpm install
pnpm --filter ./packages/core build
pnpm --filter ./packages/nextjs build
pnpm --filter ./examples/nextjs-app dev
```

Then open http://localhost:3000.

## Pages and routes

| Path | What it does |
|------|--------------|
| `/` | Lists the strategy demos, then shows the app strategy, session and counter. Has a "Log in" button. |
| `/demo/<strategy>` | One page per strategy, each with four tests: a plain HTML **form** post, a **fetch** with `csrfFetch`, a **server action**, and a link to the **attacker** page for that strategy. Each page wraps its tests in a `CsrfProvider` that reads the `csrf-<strategy>` cookie. |
| `POST /api/demo/<strategy>` | Increments the counter, protected by that strategy. |
| `/form` | Plain HTML form post with the token in a hidden `csrf_token` field. |
| `/fetch` | `csrfFetch` from `useCsrf()`, token in the `x-csrf-token` header. |
| `/actions` | A server component with a server action form. It reads the token from the `csrf-token` cookie with `cookies()` and sends it in a hidden `csrf_token` field. Works with and without JavaScript. |
| `/attacker` | Forged form posts (no token, and a guessed token) to every demo endpoint and to `/api/counter`. Open it from another origin, such as `http://127.0.0.1:3000/attacker`. `?strategy=<name>` shows one strategy's forms. |
| `GET /api/counter` | Returns `{count}`. |
| `POST /api/counter` | Increments the counter. Protected by the middleware. |
| `POST /login` | Starts a new fake session (`demo-session` cookie). Protected by the middleware. |

`middleware.ts` follows the package README: it returns a 403 when
`result.success` is false. The helper only reports the result, so leaving that
check out would let every forged request through.

## Configuration

The `/demo/<strategy>` pages always use their own strategy. `middleware.ts`
creates one protector per strategy and chooses one by URL, and each protector
uses its own cookie name. A real app would use a single strategy.

For the other pages, the middleware reads these environment variables so you can try each strategy
without editing code:

| Variable | Default | Notes |
|----------|---------|-------|
| `CSRF_STRATEGY` | `signed-double-submit` | `double-submit`, `signed-double-submit`, `signed-token`, `origin-check` or `hybrid` |
| `CSRF_SECRET` | dev-only value | Required in production |
| `CSRF_TOKEN_EXPIRY` | `3600` | Seconds |
| `CSRF_SESSION_BINDING` | `false` | `true` binds signed tokens to the `demo-session` cookie through `getSessionId` |
| `CSRF_ALLOWED_ORIGINS` | `http://localhost:$PORT` | Comma-separated, used by `origin-check` and `hybrid` |

For example:

```bash
CSRF_STRATEGY=hybrid pnpm --filter ./examples/nextjs-app dev
```

The fake session is for demonstration only. In a real app, `getSessionId`
should return your session library's server-side id, never a value the client
can choose.

See [LIVE-TEST-RESULTS.md](./LIVE-TEST-RESULTS.md) for browser test results
for each strategy.
