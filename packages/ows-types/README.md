# @1shotapi/ows-types

Shared TypeScript types and error classes for the Open Wallet Standard (OWS) SDKs.

## Contents

- **Host ↔ Branding RPC** — Postmate callback envelopes, JSON-RPC error codes, serde helpers
- **Host ↔ Branding analytics** — `OWS_ANALYTICS_EVENT`, `IOWSAnalyticsEvent` / `OWSAnalyticsEvent` (required base; branding extends the class; extras passthrough on the wire)
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
