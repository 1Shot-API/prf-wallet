---
"@1shotapi/ows-signer": patch
---

Derive Ed25519 from the secp256k1 scalar (same IKM as `signDigest` / AES-256) so passkey/PRF and recovery/import emit the same pubkey. Existing Solana addresses from the previous PRF-direct HKDF path will change.
