---
"@1shotapi/ows-types": minor
"@1shotapi/ows-wallet-utils": minor
---

Add EIP-7715 execution-permission types and optional RpcHelper hooks

ows-types exports PermissionRequest/Response shapes and the four draft method names on the EIP-1193 method table. RpcHelper registers those methods when branding passes `executionPermissions` callbacks; UI remains app-owned.
