# @1shotapi/ows-onchain

EIP-8244 build and deploy pipeline for publishing `@1shotapi/ows-signer` on-chain as part of the **Open Wallet Standard (OWS)**.

## Pipeline overview

Adapted from the [EIP-8244 template](https://github.com/TtheBC01/eip-8244):

1. **Input** — `../ows-signer/html/index.html` (plain JS, no build step).
2. **Compress** — minify → gzip (level 9) → base64 encode.
3. **Store** — SSTORE2-style data contract bytecode; main contract holds an immutable pointer.
4. **Serve** — `html()` returns a bootstrap document that gunzips client-side.
5. **Gateway** — optional HTTP server for local dev and ERC-4804 / ERC-5219 clients.

```
ows-signer/html/index.html
        │
        ▼ minify → gzip → base64
        │
        ▼ codegen → contracts/OwsSignerFrontend.sol (generated)
        │
        ▼ Hardhat Ignition deploy
        │
        ▼ html() → browser gunzip → OWS Signing Layer runs
```

## Local development

```bash
# Terminal 1 — local chain
npm run node -w @1shotapi/ows-onchain

# Terminal 2 — build, deploy, serve
npm run deploy:local -w @1shotapi/ows-onchain
RPC_URL=http://127.0.0.1:8545 npm run serve -w @1shotapi/ows-onchain
```

## Generated artifacts

`contracts/OwsSignerFrontend.sol` is **generated** by `npm run build:html`. Do not edit by hand.

## Status

Scaffold only — build scripts forthcoming (ported from eip-8244).
