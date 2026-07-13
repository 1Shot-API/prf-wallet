---
"@1shotapi/ows-types": minor
"@1shotapi/ows-provider": patch
---

Add OID4VCI holder proof-of-possession via `ProofUtils` (`buildOid4vciProofJwt` / `verifyOid4vciProofJwt`, branded `JWKThumbprint`) and require proof in issuance context. Enforce `kb+jwt` audience during SD-JWT VC presentation verify.
