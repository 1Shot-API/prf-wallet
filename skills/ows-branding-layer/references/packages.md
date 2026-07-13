# OWS packages for a Branding Layer

## Install

```bash
npm install \
  @1shotapi/ows-types \
  @1shotapi/ows-wallet-utils \
  @1shotapi/ows-signer-utils \
  zod
```

Peer / related:

- `postmate` — pulled in by `ows-wallet-utils` / provider; do not vendor
- `@1shotapi/ows-signer` — plain JS sources; **copy or static-serve** into your app (no build step). Same origin as branding so `rpId === location.hostname`.

Until packages are published to npm, depend on the monorepo via workspace, `file:`, or git:

```bash
# example — adjust when consuming from a sibling clone
npm install ../open-wallet/packages/ows-types
```

## Package roles

| Package | Import surface | Branding uses it for |
|---------|----------------|----------------------|
| `ows-types` | primitives, errors, credentials, EIP-1193 tables | Branded addresses, offer/request URIs, shared errors |
| `ows-wallet-utils` | `OWSWallet`, `RpcHelper` | Postmate child, EIP-1193 registration, reads/chain, `requestDisplay` |
| `ows-signer-utils` | `OWSSigner`, `SignHelper`, `overlaySignerIframe`, `evm.*` | Nested signer iframe, consent→sign wiring, digests → signatures |
| `ows-signer` | static files | Custody kernel document under `/signer/` |

There is **no** branding-core / registry package. App-local UI and wiring live in your repo (see `examples/general-wallet/src/ows/`).

## Serving the Signing Layer

Mirror `examples/general-wallet`:

- Dev: Vite middleware (or equivalent) maps `/signer/src` → `ows-signer/src` and `/signer/` → signer `index.html`
- Prod: copy `ows-signer` HTML + `src/` into `dist/signer/` (see `scripts/copy-signer.mjs`)

Signer URL in app code:

```typescript
const signerUrl = new URL("/signer/", window.location.origin).href;
```

## Host apps (not branding)

Hosts use `@1shotapi/ows-provider` (`OWSProxy`) only. Do not add `ows-provider` to a branding-only app unless the same origin also hosts a demo host page.
