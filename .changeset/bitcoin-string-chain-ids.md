---
"@1shotapi/ows-types": minor
"@1shotapi/ows-signer-utils": patch
"@1shotapi/ows-wallet-utils": patch
"@1shotapi/ows-provider": patch
---

Bitcoin chain ids are now descriptive string sentinels (`"Bitcoin"`, `"BitcoinTestnet"`) instead of numeric `-1`/`-2`. Add `ChainUtils` for narrowing `OWSChainId` across EVM, Bitcoin, and Solana, plus `SolanaChainId` sentinels.
