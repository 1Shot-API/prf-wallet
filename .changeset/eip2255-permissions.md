---
"@1shotapi/ows-types": minor
"@1shotapi/ows-wallet-utils": minor
---

Add EIP-2255 wallet permissions to the shared protocol surface. `ows-types` lists `wallet_requestPermissions`, `wallet_getPermissions`, and `wallet_revokePermissions` in `EIP1193_METHODS`, types them in `EIP1193Requests`, and exports `IRequestedPermissions` / `IWalletPermission`. `ows-wallet-utils` validates their params in `EIP1193_PARAM_SCHEMAS`. Revoking `eth_accounts` is how Hosts (e.g. the wagmi connector) disconnect.
