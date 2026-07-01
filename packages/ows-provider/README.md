# @1shotapi/ows-provider

EIP-1193 provider for **host applications** (layer A) using an OWS-compatible wallet iframe.

Embed your wallet iframe, get `proxy.ethereum` for viem/ethers/wagmi, and call custom wallet RPC via `proxy.rpc()`.

## Install

```bash
npm install @1shotapi/ows-provider
```

Your host app must also have a wallet iframe running [`OWSWallet`](https://github.com/1Shot-API/open-wallet/tree/main/packages/ows-wallet-utils) from `@1shotapi/ows-wallet-utils`.

## Quick start

```typescript
import { OWSProxy } from "@1shotapi/ows-provider";
import { createWalletClient, custom } from "viem";

const container = document.getElementById("wallet")!;
const proxy = await OWSProxy.create(container, "https://wallet.example.com");

const accounts = await proxy.ethereum.request({ method: "eth_requestAccounts" });

const client = createWalletClient({
  transport: custom(proxy.ethereum),
});
```

### Custom wallet RPC

```typescript
const status = await proxy.rpc<{ connected: boolean }>("getStatus");
```

Returns `OwsUnimplementedError` if the wallet iframe did not register that method.

## API

### `OWSProxy.create(container, walletUrl, options?)`

| Option | Description |
|--------|-------------|
| `name` | iframe `name` attribute (default `ows-wallet`) |
| `classList` | CSS classes on iframe at creation |
| `rpcTimeoutMs` | RPC timeout (default 120s) |

### `proxy.ethereum`

`EIP1193Provider` — EIP-1193 `request` with typed results for known methods (`eth_requestAccounts` → `EVMAccountAddress[]`, `personal_sign` → signature hex, etc.). Construct with `new EIP1193Provider(invoke)` or use `OWSProxy.create`, which wires RPC automatically.

### `proxy.rpc(method, params?)`

Extension RPC for wallet-specific methods (non–EIP-1193).

## Architecture

```
Host (A) — OWSProxy
  └── Postmate iframe
        └── Wallet (B) — OWSWallet
              └── OWSSigner (C) via ows-signer-utils
```

`@1shotapi/postmate` sets `allow="publickey-credentials-get; publickey-credentials-create"` when the iframe is created.

## License

MIT
