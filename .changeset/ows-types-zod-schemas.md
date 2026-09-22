---
"@1shotapi/ows-types": minor
"@1shotapi/ows-wallet-utils": patch
"@1shotapi/ows-signer-utils": patch
---

Add Zod 4 schemas on branded primitives (and `EChainTechnology`), with viem checksum / `@scure/base` address checks. Split AES-256 into `AES256CipherText` (raw hex) and `AES256CipherTextEnvelope` (`ows-aes1:…`). Wallet-utils EIP-1193 and credential composites now import the shared primitive schemas.
