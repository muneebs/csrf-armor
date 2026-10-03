---
"@csrf-armor/core": patch
---

Enforce `token.expiry` for the `signed-double-submit` strategy on the server. Its server cookie is now signed as `{expiration}.{nonce}.{signature}` and checked with `parseSignedToken`, so an expired pair is rejected even if the browser still sends it. Previously the signature covered only the nonce, so a pair stayed valid for as long as the secret was unchanged. Safe-method requests reissue the pair when it is close to expiry, using `token.reissueThreshold`. Server cookies issued before this release have no expiry and are rejected: clients get a new pair on their next GET, HEAD or OPTIONS request. The client token format does not change. Adds the `signNonceWithExpiry` helper.
