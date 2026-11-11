---
"@1shotapi/ows-types": minor
"@1shotapi/ows-wallet-utils": minor
---

Add the EIP-5792 Wallet Call API to the shared protocol surface. `ows-types` exports `wallet_getCapabilities`, `wallet_sendCalls`, `wallet_getCallsStatus`, and `wallet_showCallsStatus`, the `2.0.0` call types, and error codes 5700–5760. `ows-wallet-utils` validates those methods in `EIP1193_PARAM_SCHEMAS`, including the strict chain id.
