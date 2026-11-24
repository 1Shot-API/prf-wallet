# @1shotapi/wagmi-connector

[wagmi](https://wagmi.sh) connector for the **1Shot Embedded Wallet** — a passkey wallet that runs in an iframe on your page. No `OWSProxy` wiring: add `oneShotWallet()` to your wagmi config and use the normal wagmi hooks/actions.

## Install

```bash
npm install @1shotapi/wagmi-connector @1shotapi/ows-provider wagmi viem @tanstack/react-query
```

`@1shotapi/ows-provider` is a peer dependency (like other wagmi connector SDKs). The connector only imports its EVM entry (`@1shotapi/ows-provider/evm`, ~7 KB gzipped).

## Usage

```ts
import { oneShotWallet } from "@1shotapi/wagmi-connector";
import { createConfig, http } from "wagmi";
import { base, baseSepolia } from "wagmi/chains";

export const config = createConfig({
  chains: [base, baseSepolia],
  connectors: [oneShotWallet()],
  transports: {
    [base.id]: http(),
    [baseSepolia.id]: http(),
  },
});
```

```tsx
const { connect, connectors } = useConnect();
const oneShot = connectors.find((c) => c.id === "oneShotWallet")!;
<button onClick={() => connect({ connector: oneShot })}>Connect 1Shot Wallet</button>;
```

### Parameters

| Option | Default | Description |
|--------|---------|-------------|
| `walletUrl` | `https://wallet.1shotapi.com` | Branding Layer URL. |
| `container` | new `div` on `document.body` | Element (or factory) the wallet iframe mounts into. Never reparent it. |
| `presentationMode` | `"flyout"` | `"flyout"`: lower-right panel / mobile drawer shown on demand. `"inline"`: always-visible fill of `container`. |
| `walletSizeX` / `walletSizeY` | `360` / `600` | Flyout panel size in CSS pixels. |
| `configure` | — | Host RPC [`configure`](https://1shotapi.com/docs) payload (copy, theme, `destinationUrl`) applied once after the iframe loads. |

### 1Shot-specific Host RPC

The connector exposes the underlying proxy for wallet features beyond EIP-1193:

```ts
const proxy = await (oneShot as unknown as { getProxy(): Promise<OWSProxyCore> }).getProxy();
await proxy.rpc("onramp", { chainId: 8453 });
proxy.showWallet();
```

## Behavior

- **Connect:** `eth_requestAccounts` opens the wallet for passkey approval.
- **Reconnect:** after a page refresh the session restores silently (no wallet panel).
- **Disconnect:** calls EIP-2255 `wallet_revokePermissions`; the next page load stays disconnected until the user approves again.
- **Chains:** `switchChain` uses `wallet_switchEthereumChain` and only works for networks the wallet supports. The wallet does not implement `wallet_addEthereumChain`, so other chains (4902) fail with `SwitchChainError`. Bitcoin / Solana session switches inside the wallet are ignored by wagmi.
- **SSR:** nothing touches `window` until wagmi asks for the provider in the browser.

## Development

`src/oneShotWallet.ts` and its test follow wagmi's code style (single quotes, no semicolons, string-literal options) on purpose: they are copied verbatim into `wevm/wagmi` (`packages/connectors/src/`). Keep the two copies byte-identical.
