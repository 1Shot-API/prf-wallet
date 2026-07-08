---
"@1shotapi/ows-credentials": minor
"@1shotapi/ows-branding-core": patch
---

Add real SD-JWT VC presentation building with selective disclosure and holder key binding (`kb+jwt`) via `@sd-jwt/core` and `@sd-jwt/sd-jwt-vc`. Mock OID4VCI/OID4VP clients issue and present cryptographically valid demo credentials. Extend `BrandingSignerHost` with `getPublicKey` and `signDigest` for wallet-bound presentations.
