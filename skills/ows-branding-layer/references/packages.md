# OWS packages for a Branding Layer

## Install

```bash
npm install \
  @1shotapi/ows-types \
  @1shotapi/ows-wallet-utils \
  @1shotapi/ows-signer-utils \
  @1shotapi/ows-branding-core \
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
| `ows-types` | primitives, errors, credentials | Branded addresses, offer/request URIs, shared errors |
| `ows-wallet-utils` | `OWSWallet` | Postmate child, EIP-1193 registration, `requestDisplay` |
| `ows-signer-utils` | `OWSSigner`, `evm.*` | Nested signer iframe, digests → signatures |
| `ows-branding-core` | `BrandingModule`, `installBrandingModules` | Module install lifecycle |
| `ows-signer` | static files | Custody kernel document under `/signer/` |

## Serving the Signing Layer

Mirror `examples/general-wallet`:

- Dev: webpack `devServer.static` (or equivalent) maps `/signer/src` → `ows-signer/src` and `/signer/` → signer `index.html`
- Prod: copy `ows-signer` HTML + `src/` into `dist/signer/`

Signer URL in app code:

```typescript
const signerUrl = new URL("/signer/", window.location.origin).href;
```

## Registry (copy-paste, not npm runtime)

Source: `packages/ows-registry/items/<name>/vanilla/` in open-wallet.

Copy into your app (e.g. `src/ows/<name>/`) and import the module factory / default export. Keep a sync script if you track upstream registry updates.

## Host apps (not branding)

Hosts use `@1shotapi/ows-provider` (`OWSProxy`) only. Do not add `ows-provider` to a branding-only app unless the same origin also hosts a demo host page.
