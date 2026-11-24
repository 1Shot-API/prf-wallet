# @1shotapi/wagmi-connector

## 0.2.0

### Minor Changes

- ba29850: New package: `oneShotWallet()` wagmi connector for the 1Shot Embedded Wallet. Wraps `@1shotapi/ows-provider/evm`, supports connect / silent reconnect / EIP-2255 disconnect, and `switchChain` for networks the wallet already supports. The wallet does not implement `wallet_addEthereumChain`, so other chains fail with `SwitchChainError`. Non-EVM `chainChanged` events are ignored.

### Patch Changes

- Updated dependencies [ba29850]
  - @1shotapi/ows-provider@0.9.0
