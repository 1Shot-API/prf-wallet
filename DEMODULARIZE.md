# Demodularize Branding Layer modules

Plan to retire the copy-paste **module** system (`ows-branding-core` + `ows-registry`) in favor of:

1. **Published SDK helpers** for non-UI protocol logic (`RpcHelper`, signer iframe overlay, signing wiring).
2. **Task-oriented Agent Skills** for how to assemble a Branding Layer.
3. **Example-local vanilla UI** in `examples/general-wallet` (no install/module runtime).
4. A **flagship branding app** in a separate open-source repo (React + Tailwind, app-owned state/flow).

## Why

Modules mix protocol recipes, pure logic, and vanilla dialog UI. There is no shared display/flow owner, so concurrent dialogs conflict. Almost no intended OWS implementer will compose MetaMask-shaped UI tiles; specialized wallets use custom host RPC. Teaching agents via skills + thin tested helpers matches that reality better than a shadcn-style registry.

## Target shape

```
packages/
  ows-types          + shared EIP-1193 method tables / request types
  ows-wallet-utils   + RpcHelper (and optional account/signing registrars later)
  ows-signer-utils   + signer iframe overlay + richer signing helpers
  ows-provider       consumes EIP-1193 types from ows-types
  ✗ ows-branding-core
  ✗ ows-registry

examples/
  shared/            rename of credentials-shared
  general-wallet/    same flows; local vanilla UI; no BrandingModule install
  host / issuer / verifier
```

## Module → destination

| Concern | Library? | Example / skill? |
|---------|----------|------------------|
| **rpc-provider** | Yes → `RpcHelper` in `ows-wallet-utils` | — |
| **approval-dialog** wiring | Yes → headless sign helpers (Phase 4) | Dialog DOM |
| **account-connect** | Optional thin helper later | Connect dialog |
| **wallet-setup** | No | Passkey/setup UI; skill for `ensureReady` |
| **create/recover-backup** | Iframe overlay → `ows-signer-utils` | Passphrase/result dialogs |
| **credentials-provider** | Mostly already in wallet-utils / types | Consent + mock OID4 in example |
| **credential-consent** | No | Pure UI |

**Delete with `ows-branding-core`:** `BrandingModule`, `BrandingContext`, `installBrandingModules`, host pick types, install phases.

**Do not copy branding-core into examples.** Inline tiny request shapes locally or put shared ones in `ows-types` only if host and wallet both need them.

---

## Phase 0 — Inventory

Done as part of planning (table above). Re-check when deleting registry that no headless logic was missed.

---

## Phase 1 — Shared EIP-1193 surface in `ows-types` ✅

Move what `ows-wallet-utils`, `ows-provider`, and `RpcHelper` must agree on:

- Wallet method name list / union (`EIP1193_METHODS`, `Eip1193Method`, `isEip1193Method`)
- Read method list (`EIP1193_READ_METHODS`)
- Mapped request table (`EIP1193Requests`, `KnownEIP1193Method`, request args helpers)
- Shared constants (e.g. unrecognized chain id `4902` as `EIP1193_UNRECOGNIZED_CHAIN_ID`)

**Keep Zod param schemas in `ows-wallet-utils`.**

Update provider + wallet-utils imports. Changeset on `ows-types` (+ consumers).

---

## Phase 2 — `RpcHelper` in `ows-wallet-utils` ✅

Port `createRpcProviderModule` into a class:

```ts
new RpcHelper(providers, wallet, signer?, {
  defaultChainId?,
  beforeSwitchChain?(chainId): Promise<void | false>,
  onChainChanged?(chainId): void,
})
```

- Registers `eth_chainId`, `wallet_switchEthereumChain`, and read methods via `wallet.registerEip1193` in the constructor (call after `OWSWallet.prepare()`, before `wallet.start()`).
- `OWSSigner` is optional and unused for reads today (no `ows-signer-utils` dependency); reserved for future broadcast/sign helpers.
- Preserve `events` / `getChainId` / `switchChain` / `getConfiguredChainIds`.
- Unit tests in `ows-wallet-utils`.
- `general-wallet` switches to `RpcHelper`; remove local `ows/rpc-provider` copy.

---

## Phase 3 — Signer iframe helpers in `ows-signer-utils` ✅

- Add `overlaySignerIframe(iframe, slot, options?) → restore` (visible overlay **without reparenting**).
- Distinct from existing `prepareSignerIframeForWebAuthn` (1×1 invisible passkey focus).
- Consolidate shared inline-style capture/restore.
- Update example backup dialogs to use the helper.

---

## Phase 4 — Signing / account wiring helpers ✅

- Headless personal_sign / typed-data: consent → `ensureReady` → sign; return `Eip1193Handler`s for the app to register.
- Prefer helpers in `ows-signer-utils` (or wallet-utils registrars); app owns registration order.
- Account-connect / credentials: leave mostly in the example this pass unless flagship needs them sooner.
- Wallet-setup stays example-local; document in skills.

---

## Phase 5 — Examples: drop module runtime

1. Rename `examples/credentials-shared` → `examples/shared`.
2. `general-wallet`: remove `@1shotapi/ows-branding-core`; replace `installBrandingModules` with explicit wiring; keep local dialog UI.
3. Stop documenting registry sync.
4. Issuer/verifier: path updates for `examples/shared`.

---

## Phase 6 — Delete packages + docs/skills

1. Remove `packages/ows-branding-core` and `packages/ows-registry`.
2. Update `AGENTS.md`, `README.md`, `CONTRIBUTING.md`, spec references.
3. Rewrite `skills/ows-branding-layer` as **task-oriented** subskills (scaffold, unlock, custom host RPC primary, optional EIP-1193 via `RpcHelper`, signing consent, recovery overlay, credentials, display shell). Do **not** 1:1 map old module names.
4. Drop registry-oriented skill references.

---

## Phase 7 — Flagship repo (parallel)

Separate open-source branding app: React + Tailwind, consumes packages + skill. `general-wallet` remains the vanilla smoke demo.

---

## Suggested PR slices

1. **ows-types** EIP-1193 + consumer import fix (Phase 1)
2. **ows-wallet-utils** `RpcHelper` + general-wallet switch (Phase 2)
3. **ows-signer-utils** overlay (+ optional signing handlers)
4. Examples rename shared + remove install runtime
5. Delete branding-core + registry; docs + skills

## Design locks

| Decision | Choice |
|----------|--------|
| `RpcHelper` lifecycle | Register in constructor |
| Signer arg | Optional positional; no wallet-utils → signer-utils dep |
| Zod schemas | Stay in `ows-wallet-utils` |
| First extract pass | `RpcHelper` + iframe overlay + `SignHelper` (personal_sign / typedData) |
| React module kit | No |
| Display queue | App/skill concern, not SDK |
