---
name: ows-branding-layer
description: >-
  Build an Open Wallet Standard (OWS) Branding Layer with @1shotapi/ows-wallet-utils,
  ows-signer-utils, ows-branding-core, ows-types, and ows-registry modules. Use when
  scaffolding a branding wallet, installing OWS packages, copying registry modules,
  wiring OWSWallet/OWSSigner, or implementing a 1ShotAPI (or any) Branding Layer in a
  separate repository.
license: MIT
metadata:
  author: 1Shot-API
  version: "0.1.0"
  repository: https://github.com/1Shot-API/open-wallet
---

# OWS Branding Layer

Teach an agent how to scaffold and extend an **OWS Branding Layer** in any repository.

## Install this skill (consumer repo)

```bash
npx skills add 1Shot-API/open-wallet@ows-branding-layer
# or: npx skills add https://github.com/1Shot-API/open-wallet --skill ows-branding-layer
```

Then invoke `/ows-branding-layer` or ask to build a branding wallet.

## Architecture (non-negotiable)

```
Host Layer          @1shotapi/ows-provider     EIP-1193 / credentials proxy
  └── Branding      THIS APP                   UX + modules + Postmate child
        └── Signing @1shotapi/ows-signer       WebAuthn PRF custody (nested iframe)
```

- Host **never** embeds the Signing Layer. Always Host → Branding → Signing.
- Signing Layer accepts `postMessage` only from `window.parent` when `window.parent !== window.top`.
- Passkeys require a **secure context on the entire ancestor chain** — Host and Branding/Signer must be HTTPS (or `localhost` / `*.localhost`). An HTTPS wallet iframe under an HTTP host is **not** secure.

## Packages

| Package | Role |
|---------|------|
| `@1shotapi/ows-types` | Branded primitives, errors, credential types |
| `@1shotapi/ows-wallet-utils` | Branding ↔ Host (`OWSWallet`, Postmate RPC) |
| `@1shotapi/ows-signer-utils` | Branding ↔ Signing (`OWSSigner`, EVM helpers) |
| `@1shotapi/ows-branding-core` | `BrandingModule` / `installBrandingModules` |
| `@1shotapi/ows-signer` | Plain JS Signing Layer sources (serve as static `/signer/`) |

Copy-paste UI modules live in the open-wallet monorepo under `packages/ows-registry` (not an npm runtime dependency — copy files into the app).

```bash
npm install @1shotapi/ows-types @1shotapi/ows-wallet-utils @1shotapi/ows-signer-utils @1shotapi/ows-branding-core zod
# Serve ows-signer HTML/JS from the same origin as branding (rpId = signer hostname)
```

Details: [references/packages.md](references/packages.md)

## Scaffold workflow

Copy this checklist and track progress:

```
Branding Layer Progress:
- [ ] 1. Install npm packages
- [ ] 2. Serve Signing Layer on same origin as branding (`/signer/`)
- [ ] 3. Create OWSSigner iframe (hidden until WebAuthn)
- [ ] 4. OWSWallet.prepare() → register modules → start()
- [ ] 5. Copy registry modules into src/ows/ and installBrandingModules
- [ ] 6. HTTPS host when embedding from a real domain
```

### Minimal boot sequence

```typescript
import { OWSSigner } from "@1shotapi/ows-signer-utils";
import { OWSWallet } from "@1shotapi/ows-wallet-utils";
import { installBrandingModules } from "@1shotapi/ows-branding-core";

const signerUrl = new URL("/signer/", window.location.origin).href;
const signer = await OWSSigner.create(signerContainer, signerUrl, {
  hidden: true,
  credentialId: loadCredentialId(), // optional
});

const wallet = OWSWallet.prepare({ debug: false });

await installBrandingModules(
  { wallet, signer, ensureReady },
  [/* BrandingModule instances */],
);

// Register any remaining EIP-1193 handlers, then:
await wallet.start();
```

Prefer **`OWSWallet.prepare()` + `installBrandingModules` + `start()`** over `OWSWallet.create()` when using modules — modules register in `pre-start` / `post-start` phases.

### Module contract

Modules implement `BrandingModule` from `@1shotapi/ows-branding-core`:

- Receive `BrandingContext` (`wallet`, `signer`, optional `ensureReady`, `ui`)
- Register EIP-1193 / credentials handlers on `wallet`
- Do **not** talk to the Host Layer except via `OWSWallet` APIs (`requestDisplay` / `requestHide` for flyout UX)

Module catalog and copy steps: [references/modules.md](references/modules.md)

## Hard rules (from OWS)

1. **Branded types** from `@1shotapi/ows-types` — use constructors (`EVMAccountAddress(...)`), never `as` casts.
2. **No deprecations** during pre-1.0 — rename and update all call sites.
3. Prefer **methods on objects** over free helpers when logic belongs to one class.
4. Set iframe `allow` for WebAuthn/clipboard **before** navigation (`OWSSigner` / `OWSProxy` already do this).
5. Do not vendor Postmate — use the `postmate` package.

## Display / WebAuthn UX

Before passkey or approval UI in a cross-origin host embed, call `wallet.requestDisplay({ width, height })`, then `hide()` in `finally`. Host `OWSProxy` shows a lower-right flyout (no modal backdrop).

## Reference implementation

Canonical demo: `examples/general-wallet` in [1Shot-API/open-wallet](https://github.com/1Shot-API/open-wallet).

Deeper architecture notes: [references/architecture.md](references/architecture.md)

## Out of scope for this skill

- Host Layer apps (`ows-provider`) — separate concern
- Implementing or modifying `ows-signer` internals
- Publishing npm packages / changesets
