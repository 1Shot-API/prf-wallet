# Contributing to OWS

Thank you for contributing to the **Open Wallet Standard (OWS)** reference implementation.

## Getting started

1. Fork and clone [open-wallet](https://github.com/1Shot-API/open-wallet).
2. Use Node.js 22+ (`nvm use`).
3. `npm install` from the repo root.
4. `npm run build` and `npm test`.

## Package boundaries

| Path | Language | Build | Published |
|------|----------|-------|-----------|
| `packages/ows-signer` | Plain JavaScript | **None** | `@1shotapi/ows-signer` |
| `packages/ows-types` | TypeScript | `tsc` | `@1shotapi/ows-types` |
| `packages/ows-signer-utils` | TypeScript | `tsc` | `@1shotapi/ows-signer-utils` |
| `packages/ows-wallet-utils` | TypeScript | `tsc` | `@1shotapi/ows-wallet-utils` |
| `packages/ows-provider` | TypeScript | `tsc` | `@1shotapi/ows-provider` |
| `packages/ows-onchain` | TypeScript + Solidity | Hardhat | `@1shotapi/ows-onchain` |
| `examples/*` | TypeScript | Webpack (dev) | No |

**Critical rule:** `@1shotapi/ows-signer` must never acquire a build step or npm dependencies. Source is published verbatim and deployed on-chain as-is.

**Postmate:** Use the external [`@1shotapi/postmate`](https://github.com/1Shot-API/postmate) package — do not vendor it in this repo.

### Workspace commands

```bash
npm run dev -w @1shotapi/ows-example-host
npm run build -w @1shotapi/ows-signer-utils
```

### Versioning

Include a changeset for user-facing changes to publishable packages: `npm run changeset`.

## Porting from 1ShotPay (maintainers)

[1ShotPay](https://1shotpay.com) validates OWS patterns in a **private repository**:

1. Signing Layer logic → `packages/ows-signer` (plain JS, curve-based signing only).
2. Chain marshalling → `packages/ows-signer-utils`.
3. General-purpose Branding Layer patterns → `examples/general-wallet` via `ows-wallet-utils`.
4. Host Layer EIP-1193 → `packages/ows-provider`.

Do not commit proprietary assets, API keys, or 1ShotPay-specific endpoints.

## Pull requests

- Keep PRs focused on one OWS package or concern.
- Ensure `npm run build` and `npm test` pass.
- Do not add dependencies to `ows-signer`.

## Security

Report security issues to info@1shotapi.com rather than opening a public issue.
