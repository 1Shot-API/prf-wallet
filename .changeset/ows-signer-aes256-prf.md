---
"@1shotapi/ows-signer": minor
"@1shotapi/ows-signer-utils": patch
"@1shotapi/ows-types": patch
---

Implement PRF-derived `encryptAES256` / `decryptAES256` in the Signing Layer: AES-256-GCM keyed via HKDF from the wallet secp256k1 scalar (same material as `signDigest`), `ows-aes1:` envelopes, batch + recovery-session paths.
