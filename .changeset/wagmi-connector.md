---
"@1shotapi/wagmi-connector": minor
---

New package: `oneShotWallet()` wagmi connector for the 1Shot Embedded Wallet. Wraps `@1shotapi/ows-provider/evm`, supports connect / silent reconnect / EIP-2255 disconnect, `switchChain` (with `wallet_addEthereumChain` fallback), and ignores the wallet's non-EVM `chainChanged` events.
