---
"@1shotapi/ows-signer": patch
"@1shotapi/ows-signer-utils": patch
---

Fix recoverable ECDSA `v` for on-chain ecrecover (`27`/`28` instead of yParity `0`/`1`), which caused MetaMask Delegation / OpenZeppelin `ECDSAInvalidSignature()` on relayer estimate. Canonicalize message and typed-data signatures in `EvmSigner`. Prefer optional display `release()` over `hide()` in `SignHelper` so nested host RPC flyouts stay visible. Prefer cached address / public key in `toViemLocalAccount` to avoid an extra WebAuthn ceremony when warming a viem account.
