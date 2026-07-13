---
name: ows-branding-layer
description: >-
  Build an Open Wallet Standard (OWS) Branding Layer with @1shotapi/ows-wallet-utils,
  ows-signer-utils, and ows-types. Use when scaffolding a branding wallet, wiring
  OWSWallet/OWSSigner, RpcHelper/SignHelper, passkey unlock, custom host RPC,
  signing consent, recovery overlay, credentials, or display shell in a separate repo.
license: MIT
metadata:
  author: 1Shot-API
  version: "0.2.0"
  repository: https://github.com/1Shot-API/open-wallet
---

# OWS Branding Layer

Teach an agent how to scaffold and extend an **OWS Branding Layer** in any repository.

UI, flow ownership, and display queuing stay **app-owned**. Published packages provide thin protocol helpers (`RpcHelper`, `SignHelper`, `overlaySignerIframe`) — not a module/registry runtime.

## Install this skill (consumer repo)

```bash
npx skills add 1Shot-API/open-wallet@ows-branding-layer
# or: npx skills add https://github.com/1Shot-API/open-wallet --skill ows-branding-layer
```

Then invoke `/ows-branding-layer` or ask to build a branding wallet.

## Architecture (non-negotiable)

```
Host Layer          @1shotapi/ows-provider     EIP-1193 / credentials proxy
  └── Branding      THIS APP                   UX + Postmate child + helpers
        └── Signing @1shotapi/ows-signer       WebAuthn PRF custody (nested iframe)
```

- Host **never** embeds the Signing Layer. Always Host → Branding → Signing.
- Signing Layer accepts `postMessage` only from `window.parent` when `window.parent !== window.top`.
- Passkeys require a **secure context on the entire ancestor chain** — Host and Branding/Signer must be HTTPS (or `localhost` / `*.localhost`).

Details: [references/architecture.md](references/architecture.md)

## Packages

| Package | Role |
|---------|------|
| `@1shotapi/ows-types` | Branded primitives, errors, credential types, EIP-1193 method tables |
| `@1shotapi/ows-wallet-utils` | Branding ↔ Host (`OWSWallet`, `RpcHelper`, Postmate RPC) |
| `@1shotapi/ows-signer-utils` | Branding ↔ Signing (`OWSSigner`, `SignHelper`, iframe overlay) |
| `@1shotapi/ows-signer` | Plain JS Signing Layer sources (serve as static `/signer/`) |

```bash
npm install @1shotapi/ows-types @1shotapi/ows-wallet-utils @1shotapi/ows-signer-utils zod
# Serve ows-signer HTML/JS from the same origin as branding (rpId = signer hostname)
```

Details: [references/packages.md](references/packages.md)

## Task checklist

Copy and track progress. Order matches a typical first branding app; specialized wallets may skip EIP-1193 and lead with custom host RPC.

```
Branding Layer Progress:
- [ ] 1. Scaffold — packages + serve Signing Layer on same origin
- [ ] 2. Unlock — passkey create/login (`ensureReady`)
- [ ] 3. Display shell — requestDisplay / requestHide around UX
- [ ] 4. Host RPC — custom methods (primary) and/or EIP-1193 via RpcHelper + SignHelper
- [ ] 5. Signing consent — app-owned approval UI wired into SignHelper
- [ ] 6. Recovery overlay — create/restore backup with overlaySignerIframe
- [ ] 7. Credentials — wallet.credentials.register + consent UI (optional)
```

Task details: [references/tasks.md](references/tasks.md)

### Minimal boot sequence

```typescript
import { OWSSigner, SignHelper } from "@1shotapi/ows-signer-utils";
import { OWSWallet, RpcHelper } from "@1shotapi/ows-wallet-utils";

const signerUrl = new URL("/signer/", window.location.origin).href;
const signer = await OWSSigner.create(signerContainer, signerUrl, {
  hidden: true,
  credentialId: loadCredentialId(), // optional
});

const wallet = OWSWallet.prepare({ debug: false });

// Optional EIP-1193 reads / chain switch
new RpcHelper(providers, wallet, signer, { defaultChainId });

// Optional personal_sign / typed data (app supplies consent UI)
const signHelper = new SignHelper(signer, wallet, {
  ensureReady,
  requestPersonalSignApproval,
  requestSignTypedDataApproval,
});
for (const [method, handler] of Object.entries(signHelper.handlers)) {
  wallet.registerEip1193(method, handler);
}

// Register custom host RPC and other handlers, then:
await wallet.start();
```

Prefer **`OWSWallet.prepare()` → register handlers → `start()`**. Do not use a module install runtime.

## Hard rules (from OWS)

1. **Branded types** from `@1shotapi/ows-types` — use constructors (`EVMAccountAddress(...)`), never `as` casts.
2. **No deprecations** during pre-1.0 — rename and update all call sites.
3. Prefer **methods on objects** over free helpers when logic belongs to one class.
4. Set iframe `allow` for WebAuthn/clipboard **before** navigation (`OWSSigner` / `OWSProxy` already do this).
5. Do not vendor Postmate — use the `postmate` package.
6. Do **not** reparent the signer iframe for passphrase UI — use `overlaySignerIframe`.

## Reference implementation

Canonical React + Vite + Tailwind demo: `examples/general-wallet` in [1Shot-API/open-wallet](https://github.com/1Shot-API/open-wallet).

## Out of scope for this skill

- Host Layer apps (`ows-provider`) — separate concern
- Implementing or modifying `ows-signer` internals
- Publishing npm packages / changesets
- Shared React/Tailwind UI kits (apps own their UI)
