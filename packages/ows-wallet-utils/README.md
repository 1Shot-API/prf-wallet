# @1shotapi/ows-wallet-utils

Utilities for **wallet iframe implementers** (layer B) to communicate with the host application (layer A).

Built on [@1shotapi/postmate](https://github.com/1Shot-API/postmate) with a JSON-RPC-style callback protocol and Zod-validated EIP-1193 params.

## Install

```bash
npm install @1shotapi/ows-wallet-utils zod
```

## Quick start (wallet iframe)

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
- `@1shotapi/postmate` sets passkey `allow` on iframe creation — do not override after the fact

## Exports

- `OWSWallet` — child-side Postmate model
- `EIP1193_PARAM_SCHEMAS`, `getEip1193ParamSchema` — Zod validators for standard methods
- `OwsRpcError`, `OwsUnimplementedError`, `OwsInvalidParamsError` — shared error types

## Related

| Package | Role |
|---------|------|
| `@1shotapi/ows-provider` | Host-side `OWSProxy` + EIP-1193 |
| `@1shotapi/ows-signer-utils` | Wallet ↔ custody signer (layer B→C) |

## License

MIT
