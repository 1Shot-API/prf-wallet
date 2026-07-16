---
"@1shotapi/ows-types": patch
"@1shotapi/ows-signer-utils": patch
"@1shotapi/ows-signer": patch
---

Replace PasskeyPublicKey with branded COSEPublicKey / SPKIPublicKey. Signing Layer emits COSE (`cosePublicKey`) from attestation authenticator data; add COSEToSPKIPublicKey in ows-signer-utils for Web Crypto consumers.
