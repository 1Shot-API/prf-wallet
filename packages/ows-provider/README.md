# @1shotapi/ows-provider

EIP-1193 provider for **host applications** (layer A) using an OWS wallet iframe.

Embed your wallet iframe, get a standards-compliant `EthereumProvider`, and pass it to viem, ethers, wagmi, or any EIP-1193 consumer.

## Example (forthcoming)

```typescript
import { createOwsProvider } from "@1shotapi/ows-provider";

const provider = await createOwsProvider({
  container: document.getElementById("wallet")!,
  walletUrl: "https://wallet.example.com",
});

const accounts = await provider.request({ method: "eth_requestAccounts" });
```

## Architecture

```
Host app
  └── @1shotapi/ows-provider  (EIP-1193)
        └── @1shotapi/ows-wallet-utils  (Postmate ↔ wallet iframe)
              └── Your wallet iframe (layer B)
                    └── @1shotapi/ows-signer-utils ↔ custody signer (layer C)
```

## Status

Scaffold only — implementation forthcoming.
