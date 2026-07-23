---
"@1shotapi/ows-signer-utils": patch
---

Always return `yParity` from `signedAuthorizationFromSignature`. After recoverable ECDSA started emitting `v` 27/28, the previous branch returned only `v`, so relayer auth payloads sent `yParity: null` ("Invalid authorization list entry").
