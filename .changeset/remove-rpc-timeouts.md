---
"@1shotapi/ows-types": minor
"@1shotapi/ows-provider": minor
"@1shotapi/ows-signer-utils": minor
---

Remove RPC timeouts across Host and Signing layers. `RpcHostClient` (ows-provider) and `SignerRpcClient` (ows-signer-utils) no longer impose a 120s deadline — user-paced requests (`personal_sign`, `wallet_requestExecutionPermissions`, signer Confirm / WebAuthn, …) stay pending until the other layer responds, or reject on destroy / session clear. Removed: `OWSProxyOptions.rpcTimeoutMs`, `OWSSignerOptions.rpcTimeoutMs`, `RequestOptions.timeoutMs`, `DEFAULT_RPC_TIMEOUT_MS`, `OwsRpcTimeoutError`, and `OwsTimeoutError`. Hosts that need a bound on a non-interactive call should race their own deadline at the call site.
