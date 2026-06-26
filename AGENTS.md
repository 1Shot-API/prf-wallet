# Agent instructions — Open Wallet Standard (OWS)

Monorepo: **1Shot API Open Wallet Standard** (`@1shotapi/open-wallet`).

## Stack

```
examples/host                 Layer A — @1shotapi/ows-provider (EIP-1193)
examples/wallet-iframe        Layer B — wallet wrapper demo
packages/ows-signer           Layer C — custody signer (plain JS, zero deps, on-chain)
packages/ows-signer-utils     Wallet iframe ↔ custody signer (evm.signMessage, etc.)
packages/ows-wallet-utils     Host ↔ wallet iframe (@1shotapi/postmate wrappers)
packages/ows-onchain          EIP-8244 deploy pipeline for ows-signer
```

## Hard rules

1. **`packages/ows-signer` is plain JavaScript only.** No TypeScript, bundler, dependencies, or build step.
2. **Custody signer signs curves/digests, not chain APIs.** EIP-191, EIP-712, etc. belong in `ows-signer-utils`.
3. **Host (A) must never embed custody signer (C) directly.** Always A → B → C.
4. **C accepts `postMessage` only when `event.source === window.parent` and `window.parent !== window.top`.**
5. **Do not vendor Postmate.** Use `@1shotapi/postmate` from npm / GitHub.
6. **Examples are not published.**

## Tooling

- Node.js 22+, npm workspaces
- TypeScript packages: `tsc` → `dist/`
- Changesets for `@1shotapi/*` independent versioning
- On-chain: https://github.com/TtheBC01/eip-8244

## Common commands

```bash
npm install && npm run build && npm test
npm run dev -w @1shotapi/ows-example-wallet
npm run dev -w @1shotapi/ows-example-host
```

## Status

Bootstrapped; OWS signer logic and SDKs not yet implemented.
