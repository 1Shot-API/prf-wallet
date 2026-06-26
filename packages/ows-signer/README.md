# @1shotapi/ows-signer

The **OWS custody signer** (layer C in the Open Wallet Standard stack).

This package is intentionally **plain JavaScript with zero dependencies and no compilation step**. The files here are published verbatim to npm and deployed on-chain via `@1shotapi/ows-onchain`.

## Design

The custody signer behaves like a minimal **KMS / HSM**: it holds a PRF-derived key and signs digests on supported curves. It does **not** implement chain-specific APIs (EIP-191, EIP-712, Bitcoin PSBT, etc.). Those are marshalled by `@1shotapi/ows-signer-utils` in the wallet iframe layer.

Initial curve support targets **secp256k1** (EVM, Bitcoin, and related ecosystems). Additional curves may be added without changing the on-chain deployment model.

## Layout

```
html/index.html     Entry document served in the custody signer iframe
src/                Plain .js modules — no build step
test/               Node test runner tests
```

## Communication

- Accepts `postMessage` RPC **only from its direct parent** (the wallet iframe).
- Returns signatures, never private key material (except on-demand human-readable export modes).
- Triggers a passkey ceremony for each signing request.

## On-chain deployment

See [`@1shotapi/ows-onchain`](../ows-onchain/README.md).

## Status

Scaffold only — implementation forthcoming.
