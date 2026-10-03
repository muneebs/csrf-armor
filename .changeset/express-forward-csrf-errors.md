---
"@csrf-armor/express": patch
---

Pass CSRF validation failures and unexpected errors to `next(error)` instead of rejecting the middleware promise. Express 4 ignores rejected middleware promises, so an invalid request could previously cause an unhandled rejection and stop the process. Error handlers that check `err.code === 'CSRF_VERIFICATION_ERROR'` keep working.
