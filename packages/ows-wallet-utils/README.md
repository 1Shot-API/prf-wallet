# @1shotapi/ows-wallet-utils

Utilities for **Branding Layer** implementers to communicate with the **Host Layer**.

Built on [postmate](https://github.com/dollarshaveclub/postmate) with a JSON-RPC-style callback protocol and Zod-validated EIP-1193 params.

## Install

```bash
npm install @1shotapi/ows-wallet-utils zod
```

## Quick start (Branding Layer)

```typescript
import { OWSWallet } from "@1shotapi/ows-wallet-utils";
import { z } from "zod";

const wallet = await OWSWallet.create({
  eip1193: {
    async eth_requestAccounts() {
      return ["0xYourAddress"];
    },
    async personal_sign(params) {
      const [message] = params as [string, string];
      return "0x…";
    },
  },
  rpc: {
    getStatus: {
      handler: async () => ({ connected: true }),
    },
  },
});

// Or register before handshake:
const prepared = OWSWallet.prepare();
prepared.registerRpc(
  "customMethod",
  async (params) => ({ ok: true }),
  z.object({ foo: z.number() }),
);
await prepared.start();
```

Unregistered EIP-1193 methods respond with `OwsUnimplementedError` (`-32601`). Custom RPC methods must be registered via `options.rpc` or `registerRpc()` before `start()`.

### Debug logging

Enable `console.debug` traces for Postmate handshake and RPC traffic:

```typescript
await OWSWallet.create({ debug: true, eip1193: { ... } });
```

Or in the browser console before the wallet loads:

```javascript
localStorage.setItem("ows-wallet-utils:debug", "1");
// or: globalThis.OWS_WALLET_UTILS_DEBUG = true;
```

## Protocol

- Host calls `child.call(method, envelope)` via Postmate
- Child emits `ows:rpcCallback` with `{ callId, success, result | error }`
- Host-side `OWSProxy` sets iframe `allow` (WebAuthn, clipboard) before navigation — do not override after load

## Exports

- `OWSWallet` — child-side Postmate model
- `RpcHelper` — EIP-1193 read methods + chain switching against JSON-RPC URLs
- `EIP1193_PARAM_SCHEMAS`, `getEip1193ParamSchema` — Zod validators for standard methods
- `CredentialWalletRegistrar`, `createOwsEd25519HolderSigner` — credentials wire helpers

Shared protocol types and errors live in `@1shotapi/ows-types`.

## Related

| Package | Role |
|---------|------|
| `@1shotapi/ows-provider` | Host Layer `OWSProxy` + EIP-1193 |
| `@1shotapi/ows-signer-utils` | Branding Layer ↔ Signing Layer |

## License

MIT
