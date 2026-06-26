# @1shotapi/ows-wallet-utils

Utilities for **wallet iframe implementers** (layer B) to communicate with the host application (layer A).

Built on [@1shotapi/postmate](https://github.com/1Shot-API/postmate) — the 1Shot API fork with passkey iframe support — with typed RPC wrappers for common OWS wallet operations.

## Use cases

- Wallet iframe exposes methods the host can call (`connect`, `signTransaction`, etc.).
- Host events forwarded into the wallet for display / approval flows.
- Passkey-compatible iframe creation (`allow="publickey-credentials-get"`).

## Example (forthcoming)

```typescript
import { OwsWalletChild, OwsWalletParent } from "@1shotapi/ows-wallet-utils";

// Host side
const wallet = await OwsWalletParent.connect({ container, url: walletIframeUrl });

// Wallet iframe side
const host = await OwsWalletChild.handshake();
```

## Status

Scaffold only — implementation forthcoming.
