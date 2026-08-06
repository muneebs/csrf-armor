---
"@csrf-armor/core": patch
"@csrf-armor/express": patch
"@csrf-armor/nextjs": patch
---

Fix JSR publishing, which had never produced a release.

The `jsr.json` configs pointed `exports` at `./dist/index.js`, a file the build never emits (it emits `.mjs`), and their versions had drifted up to three minors behind `package.json` because `changeset version` only knows about `package.json`. The JSR scope was empty as a result.

Configs now export TypeScript source, so JSR can generate documentation and Node type declarations, and versions are synced from `package.json` at release time. Peer frameworks (`express`, `next`, `react`) are mapped to open ranges so JSR does not pin them.

`csrfMiddleware`, `createCsrfMiddleware`, and `CsrfProvider` gained explicit return types — required by JSR's no-slow-types rule, and better `.d.ts` output for npm consumers too.

`@csrf-armor/nuxt` is intentionally not published to JSR: its runtime imports Nuxt's virtual modules (`#app`, `#imports`), which only exist inside a Nuxt build.
