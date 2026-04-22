---
"@csrf-armor/nextjs": patch
---

fix(react): remove unnecessary `csrfToken` dependency from `useCallback`

`secureFetch` previously listed `csrfToken` in its `useCallback` dependency array, causing the function reference to change every time the token updated. This made the `CsrfContextValue` unstable and triggered unnecessary re-renders in any component consuming `useCsrf()`.

The token equality check (`newToken !== csrfToken`) was also redundant because React's `setState` already bails out for identical primitive values. Removing both the dependency and the comparison fixes the re-render issue without changing behavior.

Fixes #53
