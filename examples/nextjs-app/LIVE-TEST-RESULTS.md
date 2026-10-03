# Live browser test results

Run on 2026-10-03 against `next dev` (Next.js 16.3.6, React 19.3.0, Turbopack)
with the workspace builds of `@csrf-armor/core` 1.3.0 and
`@csrf-armor/nextjs` 1.4.6, in Chromium 152 (Claude desktop browser pane).
Each strategy ran in its own dev server, started with `CSRF_STRATEGY` set.

Evidence for each case is the HTTP status, the counter before and after
(read from `GET /api/counter`), and the `reason` that `middleware.ts` logs for
every rejected request.

## Method

- **Legitimate (fetch):** `POST /api/counter` with the `csrf-token` cookie
  value in `x-csrf-token`, run twice.
- **Legitimate (form):** load `/form` and submit it. The hidden `csrf_token`
  field is sent as `application/x-www-form-urlencoded`, followed by a 303 to
  `/form?submitted=1`.
- **Missing token:** the same POST without the header.
- **Tampered token:** one character of the token changed. For the signed
  strategies, a second run changes the `csrf-token` cookie and the header the
  same way, so the request reaches the signature check.
- **Token from another browser:** `fetch('/', {credentials: 'omit'})` returns
  a token issued to a cookieless client in `x-csrf-token`. That token is then
  sent with this browser's cookies.
- **Foreign Origin:** load `/attacker` from `http://127.0.0.1:3000` (a
  different origin, and a different site) and submit its form to
  `http://localhost:3000/api/counter`. Browsers ignore an `Origin` header set
  with `fetch`. A run that set `Origin: https://evil.example` that way showed
  the header was dropped: the request went out with the real origin and got a
  200. A real second origin is therefore the only valid test.

## Results

| Strategy | Legit fetch | Legit form | Missing token | Tampered token | Token from other browser | Foreign Origin |
|---|---|---|---|---|---|---|
| `double-submit` | PASS: 200, 0→1, again 1→2 | PASS: 303, 2→3 | PASS: 403, 1→1, `No CSRF token submitted` | PASS: 403, 1→1, `Token mismatch` | PASS: 403, 1→1, `Token mismatch` | PASS: 403, 3→3, `No CSRF cookie found` (no origin check in this strategy; the cross-site post carries no Lax cookies) |
| `signed-double-submit` | PASS: 200, 0→1, again 1→2 | PASS: 303, 2→3 | PASS: 403, 1→1, `No CSRF token submitted` | PASS: 403, 1→1, `Token mismatch` | PASS: 403, 1→1, `Token mismatch` | PASS: 403, 3→3, `Missing CSRF cookies` (no origin check in this strategy) |
| `signed-token` | PASS: 200, 0→1, again 1→2 | PASS: 303, 2→3 | PASS: 403, 1→1, `No CSRF token provided` | PASS: 403, 1→1, `Token mismatch`; cookie and header both tampered: 403, 3→3, `CSRF token is invalid: Invalid signature` | PASS: 403, 1→1, `Token mismatch` | PASS: 403, 3→3, `No CSRF token provided` (no origin check in this strategy) |
| `origin-check` | PASS: 200, 0→1 | PASS: 303, 3→4 | N/A: 200, 1→2. Expected, because this strategy does not check tokens | N/A (no token check) | N/A (no token check) | PASS: 403, 4→4, `Origin "http://127.0.0.1:3000" is not allowed` |
| `hybrid` | PASS: 200, 0→1, again 1→2 | PASS: 303, 2→3 | PASS: 403, 1→1, `No CSRF token provided` | PASS: 403, 1→1, `Token mismatch`; cookie and header both tampered: 403, 2→2, `CSRF token is invalid: Invalid signature` | PASS: 403, 1→1, `Token mismatch` | PASS: 403, 3→3, `Origin "http://127.0.0.1:3000" is not allowed` |

### Session binding (`getSessionId`, `CSRF_SESSION_BINDING=true`)

`getSessionId` returns the `demo-session` cookie, which `POST /login` sets to
a new random id on each call. The CSRF pair in the login response itself is
still bound to the session the request arrived with, so it is the pair
"issued before login". Each step below runs with no other request in between.

| Strategy | Case | Result |
|---|---|---|
| `signed-double-submit` | Anonymous pair, anonymous request | PASS: 200, 0→1 |
| `signed-double-submit` | Pair issued before `/login`, used after login (session A) | PASS: 403, 1→1, `CSRF token is invalid: Invalid signature` |
| `signed-double-submit` | Same session after the next GET reissued the pair | PASS: 200, 1→2 |
| `signed-double-submit` | Pair issued in session A, used in session B (second `/login`) | PASS: 403, 2→2, `CSRF token is invalid: Invalid signature` |
| `signed-double-submit` | Session B after the next GET | PASS: 200, 2→3 |
| `signed-double-submit` | UI: "Log in" button, then `/fetch` page | PASS: session id changed, then `200 {"count":4}` |
| `signed-token` | Token from session A used after login as session B | PASS: 403, 1→1, `CSRF token is invalid: Invalid signature` |
| `signed-token` | Session B after the next GET | PASS: 200, 1→2 |

### Expiry (`signed-double-submit`, `CSRF_TOKEN_EXPIRY=5`)

| Case | Result |
|---|---|
| Fresh pair used immediately | PASS: 200, 0→1 |
| Pair used 7.0 s after issue | PASS: 403, 1→1, `CSRF token has expired` |
| Next pair used immediately | PASS: 200, 1→2 |

### Server actions (`/actions`, `signed-double-submit`)

`/actions` is a server component. It reads the token with `cookies()` and
renders `<form action={serverAction}>` with a hidden `csrf_token` field.

Before the adapter fix in this PR, every JavaScript submission was rejected
with `No CSRF token submitted`. React sends the field as `_1_csrf_token`, and
the adapter only accepted the exact field name. These results are after the
fix:

| Case | Body | Result |
|---|---|---|
| Submit with JavaScript (React handles the post), twice | `_1_csrf_token` | PASS: 200 both times, 0→1→2 (the page re-renders with the rotated token) |
| Submit with JavaScript, tampered token | `_1_csrf_token` | PASS: 403, 2→2, `Token mismatch` |
| Native submit (no JavaScript) | `csrf_token` | PASS: action ran, 2→3 |
| Native submit, token removed | none | PASS: 403, 3→3 |
| Action arguments as `text/plain` JSON, real token first | `["<token>"]` | PASS: 200, 4→5 |
| Action arguments as `text/plain` JSON, wrong token | `["not-the-token"]` | PASS: 403, 4→4 |

## Notes

- The strategy, session and expiry tests found no library bugs. The server
  action tests found one, which is fixed in this PR (see above).
- For `signed-token` and `hybrid`, a tampered header fails the cookie-match
  check before the signature check. The extra cookie-and-header run confirms
  the signature check also rejects it.
- Any safe request (including `GET /api/counter`) can reissue tokens, and
  every unsafe request rotates them. Tests that tamper with cookies therefore
  read the counter before tampering, not between tampering and the POST.
- Next.js 16 logs a deprecation warning for the `middleware.ts` file name
  (it is now `proxy.ts`). The example keeps `middleware.ts` to match the
  package README.
