---
"@1shotapi/ows-provider": minor
"@1shotapi/ows-types": patch
---

**ows-provider:** Add Wallet Standard discovery on `proxy.solana.registerSolanaWallet()` / `unregisterSolanaWallet()`, forwarding connect and Solana features to the existing Branding wire. Host-side `@solana/transactions` helpers split/merge full serialized transactions for `signTransaction` / `signAndSendTransaction`.

**ows-types:** Add `ConversionUtils.bytesToBase64` / `base64ToBytes` for standard (non-URL-safe) base64 branded as `Base64String`, used by the Host Solana Standard adapter and other Host↔Branding wire payloads.
