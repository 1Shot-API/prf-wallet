---
"@1shotapi/ows-types": minor
"@1shotapi/ows-signer-utils": patch
"@1shotapi/ows-wallet-utils": patch
---

Add `ChainUtils.asEVMChainId` (throws `OwsInvalidParamsError`) to normalize EIP-155 chain ids from number/string/bigint (with trim), and use it from signer/wallet EIP-1193 helpers instead of local `normalizeChainId` wrappers. Add `IEVMTransactionRequestSchema` and parse `eth_sendTransaction` params with Zod.
