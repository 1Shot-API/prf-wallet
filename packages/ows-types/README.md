# @1shotapi/ows-types

Shared TypeScript types and error classes for the Open Wallet Standard (OWS) SDKs.

## Contents

- **Host ↔ Branding RPC** — Postmate callback envelopes, JSON-RPC error codes, serde helpers
- **Branding ↔ Signing RPC** — Signing Layer wire protocol types
- **Errors** — `OwsRpcError` / `OwsSignerError` hierarchies used by `@1shotapi/ows-provider`, `@1shotapi/ows-wallet-utils`, and `@1shotapi/ows-signer-utils`

## Usage

```ts
import {
  OwsRpcError,
  OwsUserRejectedError,
  OWS_RPC_CALLBACK_EVENT,
  type RpcRequestEnvelope,
} from "@1shotapi/ows-types";
```
