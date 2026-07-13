# @1shotapi/ows-provider

EIP-1193 provider for **Host Layer** applications using an OWS-compatible Branding Layer iframe.

Embed your branding iframe, get `proxy.ethereum` for viem/ethers/wagmi, and call custom wallet RPC via `proxy.rpc()`.

## Install

```bash
npm install @1shotapi/ows-provider
```

Your host app must also have a Branding Layer iframe running [`OWSWallet`](https://github.com/1Shot-API/open-wallet/tree/main/packages/ows-wallet-utils) from `@1shotapi/ows-wallet-utils`.

For SD-JWT VC presentation building and crypto helpers, import from `@1shotapi/ows-types`. Use `verifySdJwtVcPresentation` from this package for host-side verification.

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

Returns `OwsUnimplementedError` if the Branding Layer did not register that method.

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
Host Layer — OWSProxy
  └── Postmate iframe
        └── Branding Layer — OWSWallet
              └── Signing Layer — OWSSigner via ows-signer-utils
```

`OWSProxy` sets iframe Permissions Policy (`allow`) before navigation (WebAuthn + clipboard), including when using stock `postmate`.

## License

MIT
