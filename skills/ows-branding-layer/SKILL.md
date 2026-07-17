---
name: ows-branding-layer
description: >-
  Build an Open Wallet Standard (OWS) Branding Layer with @1shotapi/ows-wallet-utils,
  ows-signer-utils, ows-types, and optional ows-oid4. Use when scaffolding a branding
  wallet, wiring OWSWallet/OWSSigner, RpcHelper/SignHelper/CredentialsHelper, passkey
  unlock, custom host RPC, signing consent, recovery overlay, credentials, or display
  shell in a separate repo.
license: MIT
metadata:
  author: 1Shot-API
  version: "0.3.0"
  repository: https://github.com/1Shot-API/open-wallet
---

# OWS Branding Layer

Teach an agent how to scaffold and extend an **OWS Branding Layer** in any repository.

UI, flow ownership, and display queuing stay **app-owned**. Published packages provide thin protocol helpers (`RpcHelper`, `SignHelper`, `CredentialsHelper`, `overlaySignerIframe`) — not a module/registry runtime.

When a local clone of [open-wallet](https://github.com/1Shot-API/open-wallet) is available (multi-root workspace), prefer grepping `examples/general-wallet` over guessing from this skill alone.

## Install this skill (consumer repo)

```bash
npx skills add 1Shot-API/open-wallet@ows-branding-layer
# or: npx skills add https://github.com/1Shot-API/open-wallet --skill ows-branding-layer
# or from a sibling clone: npx skills add ../open-wallet --skill ows-branding-layer
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
- `allowLocalAccess` is a **host** `OWSProxy` option (LAN OID4 from a public branding origin). Do not put it on branding APIs.

Details: [references/architecture.md](references/architecture.md)

## Packages

| Package | Role |
|---------|------|
| `@1shotapi/ows-types` | Branded primitives, errors, credential types, EIP-1193 tables, `CredentialCryptoUtils` / `PresentationUtils` / `ProofUtils` |
| `@1shotapi/ows-wallet-utils` | Branding ↔ Host (`OWSWallet`, `RpcHelper`, `requestDisplay`) |
| `@1shotapi/ows-signer-utils` | Branding ↔ Signing (`OWSSigner`, `SignHelper`, `overlaySignerIframe`) |
| `@1shotapi/ows-oid4` | Optional credentials (`CredentialsHelper`, HTTP OID4VCI/OID4VP clients) |
| `@1shotapi/ows-signer` | Plain JS Signing Layer sources (serve as static `/signer/`) |

```bash
npm install \
  @1shotapi/ows-types \
  @1shotapi/ows-wallet-utils \
  @1shotapi/ows-signer-utils \
  @1shotapi/ows-oid4 \
  viem
# zod is transitive via ows-wallet-utils — add a direct dep only for custom registerRpc schemas
# Serve/copy ows-signer HTML+JS from the same origin as branding (rpId = signer hostname)
```

Details: [references/packages.md](references/packages.md)

## Task checklist

Copy and track progress. Order matches a typical first branding app; specialized wallets may skip EIP-1193 and lead with custom host RPC. The reference wallet (`examples/general-wallet`) is **EIP-1193-first**.

```
Branding Layer Progress:
- [ ] 1. Scaffold — packages + serve Signing Layer on same origin at /signer/
- [ ] 2. Unlock — passkey create/login (`awaitSignerReady` vs `ensureReady`)
- [ ] 3. Display shell — requestDisplay / hide + app-owned modal queue
- [ ] 4. Host RPC — EIP-1193 (RpcHelper + account connect) and/or custom registerRpc
- [ ] 5. Signing consent — SignHelper + app approval UI
- [ ] 6. Recovery overlay — create/restore with overlaySignerIframe (no reparent)
- [ ] 7. Credentials — CredentialsHelper.register + consent UI (optional)
```

Task details + exact example paths: [references/tasks.md](references/tasks.md)

### Minimal boot sequence

Stock Postmate parents only retry the handshake briefly after branding iframe `load`. **Register `Postmate.Model` via `wallet.start()` before the nested Signing Layer finishes loading.** Use a deferred signer proxy so helpers can register with an `OWSSigner`-shaped object immediately.

Canonical implementation: `examples/general-wallet/src/wallet/WalletProvider.tsx` (`createDeferredSigner` + `boot`).

```typescript
import { OWSSigner, SignHelper } from "@1shotapi/ows-signer-utils";
import { OWSWallet, RpcHelper } from "@1shotapi/ows-wallet-utils";
// Optional credentials:
// import { CredentialsHelper } from "@1shotapi/ows-oid4";

const wallet = OWSWallet.prepare({ debug: false });

const signerPromise = OWSSigner.create(signerContainer, signerUrl, {
  hidden: true,
  credentialId: loadCredentialId(),
});
// Proxy that throws until signerPromise resolves — do NOT await signer before start().
const signer = createDeferredSigner(() => signerPromise); // copy pattern from WalletProvider

// Register before start (order in general-wallet):
// account connect → RpcHelper → SignHelper handlers → CredentialsHelper.register()
const rpcHelper = new RpcHelper(providers, wallet, signer, { defaultChainId });

const signHelper = new SignHelper(signer, wallet, {
  // Setup-only when no credential; signing ceremony unlocks when credential exists
  ensureReady: ensureOnboardedForSigning,
  onAuthenticated: markUnlockedAndRefreshAddresses,
  chainRpc: rpcHelper,
  requestPersonalSignApproval,
  requestSignTypedDataApproval,
  requestSendTransactionApproval,
});
for (const [method, handler] of Object.entries(signHelper.handlers)) {
  wallet.registerEip1193(method, handler);
}

// Optional:
// new CredentialsHelper(wallet, signer, { … }).register();
// Note arg order: CredentialsHelper(wallet, signer) vs SignHelper(signer, wallet)

void wallet.start(); // registers Model immediately — do not await nested signer first
void signerPromise; // background load; UI can paint
```

Prefer **`OWSWallet.prepare()` → register handlers → `start()`**. Do not use a module install runtime.

Split readiness in your app:

| API | Meaning |
|-----|---------|
| `awaitSignerReady()` | Nested Signing Layer iframe + `OWSSigner` loaded |
| `ensureReady()` | Signer loaded **and** unlocked / onboarded (passkey) — for connect, credentials, recovery create |
| `ensureOnboardedForSigning()` | Setup/login **only if no credential id**; otherwise no-op — for `SignHelper` signed actions |
| `onAuthenticated` | After successful sign / send: set unlocked + refresh addresses |

For custom RPCs such as `eth_sendTransaction` or future ERC-7710 sends, use the same **centralized signed-action gate**: setup-only before consent when the credential is missing; one passkey ceremony for the sign itself when the credential is known.

Restore-backup must use **`awaitSignerReady` only** — calling `ensureReady` first can force setup/login before recovery.

## Hard rules (from OWS)

1. **Branded types** from `@1shotapi/ows-types` — use constructors (`EVMAccountAddress(...)`), never `as` casts.
2. **No deprecations** during pre-1.0 — rename and update all call sites.
3. Prefer **methods on objects** over free helpers when logic belongs to one class.
4. Set iframe `allow` for WebAuthn/clipboard **before** navigation (`OWSSigner` / host `OWSProxy` already do this).
5. Do not vendor Postmate — use the `postmate` package (transitive).
6. Do **not** reparent the signer iframe for passphrase UI — use `overlaySignerIframe`.
7. Prefer Vite `/signer/` at **origin root** even if the branding app uses a subpath `base` (e.g. `/wallet/`).

## Reference implementation

Canonical React + Vite + Tailwind demo: `examples/general-wallet` in [1Shot-API/open-wallet](https://github.com/1Shot-API/open-wallet).

| Concern | Start here |
|---------|------------|
| Boot / deferred signer | `src/wallet/WalletProvider.tsx` |
| Account connect | `src/ows/registerAccountConnect.ts` |
| Sign consent | `src/ows/registerApprovalSigning.ts`, `src/components/modals/SignModals.tsx` |
| Credentials | `src/ows/registerCredentialsProvider.ts`, `src/components/modals/CredentialModals.tsx` |
| Recovery | `src/components/modals/BackupModals.tsx` |
| Serve signer | `vite.config.ts`, `scripts/copy-signer.mjs`, `signer-static/index.html` |

## Out of scope for this skill

- Host Layer apps (`ows-provider`) — separate concern (`allowLocalAccess`, flyout chrome)
- Implementing or modifying `ows-signer` internals
- Publishing npm packages / changesets
- Shared React/Tailwind UI kits (apps own their UI)
- Calling `PresentationUtils` / SD-JWT low-level APIs unless you bypass `CredentialsHelper`
