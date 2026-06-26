# @1shotapi/ows-signer-utils

TypeScript utilities for **wallet iframe implementers** to embed the OWS custody signer and communicate with it over `postMessage`.

## Responsibilities

- Create and configure the custody signer `<iframe>` (including `allow="publickey-credentials-get"`).
- Enforce A → B → C nesting: the custody signer must not be mounted by the host directly.
- Marshal chain-specific signing requests into the binary digest format expected by `@1shotapi/ows-signer`.
- Expose ergonomic namespaces, e.g. `signer.evm.signMessage()`, `signer.evm.signTypedData()`.

## Example (forthcoming)

```typescript
import { OwsSignerHost } from "@1shotapi/ows-signer-utils";

const signer = new OwsSignerHost({ signerUrl: "https://…" });

const signature = await signer.evm.signMessage("hello");
const typedSig = await signer.evm.signTypedData(domain, types, message);
```

The custody signer itself only signs digests on a curve (e.g. secp256k1). This package owns all EVM/Bitcoin/Solana marshalling logic.

## Related packages

| Package | Role |
|---------|------|
| `@1shotapi/ows-signer` | Plain JS custody signer (layer C) |
| `@1shotapi/ows-wallet-utils` | Host ↔ wallet iframe messaging |
| `@1shotapi/ows-provider` | EIP-1193 provider for host apps |

## Status

Scaffold only — implementation forthcoming.
