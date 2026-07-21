# Branding Layer tasks

Task-oriented guidance aligned with `examples/general-wallet`. Specialize freely; production branding apps may lead with **custom host RPC** and skip MetaMask-shaped EIP-1193. The reference wallet is **EIP-1193-first**.

Paths below are under `examples/general-wallet/` unless noted.

## 1. Scaffold

1. Install packages (see [packages.md](packages.md)).
2. Serve `@1shotapi/ows-signer` as static **`/signer/` on the same origin** as branding (`rpId === location.hostname`).
   - Dev: Vite middleware maps `/signer/` → `signer-static/index.html` and `/signer/src/` → package `src/` (**outside** Vite `base`, e.g. `/wallet/`). See `vite.config.ts`.
   - Prod: `scripts/copy-signer.mjs` into `dist/signer/`.
3. Signer URL: `new URL("/signer/", window.location.origin).href` (origin root, not under app `base`).
4. Create a hidden signer host (`src/components/SignerHost.tsx`), then **start Postmate before awaiting nested signer load**:

```typescript
const wallet = OWSWallet.prepare();
const signerPromise = OWSSigner.create(container, signerUrl, {
  hidden: true,
  credentialId: loadCredentialId(),
});
const signer = createDeferredSigner(() => signerPromise); // WalletProvider.tsx
// …register handlers (ensureReady awaits signerPromise + unlock)…
void wallet.start(); // registers Model immediately
void signerPromise; // background — do not block UI/paint on this
```

Also see `scripts/dev.mjs` (ngrok HTTPS for passkeys). Do not run leftover `--no-tunnel` processes on the same port while hosts expect a tunnel URL.

## 2. Unlock (`awaitSignerReady` vs `ensureReady`)

App-owned passkey create / login. Split readiness:

| Helper | Waits for |
|--------|-----------|
| `awaitSignerReady()` | Signing Layer iframe + `OWSSigner` instance |
| `ensureReady()` | Signer ready **plus** unlocked / wallet created |

- Persist credential id + cached addresses in app storage (`src/storage.ts`).
- Gate signing and account-connect behind `ensureReady()`.
- Embedded first-run UI when `window.parent !== window.top` is optional — `OnboardingPanel.tsx` / `WalletProvider.tsx` `runSetupFlow`.
- Host-driven setup: wrap with `requestDisplay` + setup modals (`SetupModals.tsx`).

No published SDK for setup dialogs; keep UI local.

## 3. Display shell

Before WebAuthn or consent UI in a cross-origin host embed:

```typescript
const display = await wallet.requestDisplay({ width, height });
try {
  // dialogs / passkey / overlay
} finally {
  await display.hide();
}
```

Also available: `wallet.requestHide()`. Host wire event `ows:releaseDisplay` is reached via `DisplaySession.release()` / hide paths — branding apps should prefer `display.hide()`.

Host `OWSProxy` shows a lower-right opaque flyout (no modal backdrop).

**App concerns (not SDK):**

- **Modal queue** — serialize concurrent dialogs (`WalletProvider` `pushModal` / `ModalHost.tsx`).
- Nested `requestDisplay` may reuse an active session (depth). Helpers (`SignHelper`, `CredentialsHelper`) already call `requestDisplay` — **do not double-wrap** those handler paths with another outer display.

## 4. Host RPC (primary for specialized wallets) + EIP-1193

**Specialized wallets:** register custom methods the host calls via `proxy.rpc` / your protocol (`wallet.registerRpc`).

**Reference wallet path (EIP-1193):**

1. `src/ows/registerAccountConnect.ts` — `eth_accounts` / `eth_requestAccounts` (cached addresses; connect consent + `ensureReady`).
2. `RpcHelper` for JSON-RPC reads / `wallet_switchEthereumChain` (`src/ows/demoChains.ts`, construct in `WalletProvider.tsx`).
3. `SignHelper` for `personal_sign` / typed data (task 5).

```typescript
new RpcHelper(
  new Map([[chainId, rpcUrl] /* … */]),
  wallet,
  signer, // optional; unused for reads today
  { defaultChainId },
);
```

Call after `prepare()`, before `start()`. Zod EIP-1193 / credential wire schemas live in `ows-wallet-utils` (transitive).

## 5. Signing consent

Headless wiring in `SignHelper` (`@1shotapi/ows-signer-utils`):

```
requestDisplay → consent UI → ensureReady → signer.evm.signMessage | signTypedData → hide
```

Registers: `personal_sign`, `eth_signTypedData`, `eth_signTypedData_v3`, `eth_signTypedData_v4`, `eth_sendTransaction`. Reject with `OwsUserRejectedError`.

Create `RpcHelper` before `SignHelper`. Pass `getChainId` from RpcHelper. Branding implements `approveAndSignTransaction` (consent + prepare + sign + broadcast; use exported `prepareEvmTransaction`). Use a **setup-only** `ensureReady` plus `onAuthenticated` after message/typed-data ceremonies (send auth side effects live in branding's approve callback).

```typescript
const signHelper = new SignHelper(signer, wallet, {
  ensureReady: ensureOnboardedForSigning,
  onAuthenticated,
  getChainId: () => rpcHelper.getChainId(),
  requestPersonalSignApproval, // PersonalSignApprovalRequest → boolean
  requestSignTypedDataApproval, // SignTypedDataApprovalRequest → boolean
  approveAndSignTransaction, // SendTransactionApprovalRequest → EVMTransactionHash
});
for (const [method, handler] of Object.entries(signHelper.handlers)) {
  wallet.registerEip1193(method, handler);
}
```

Reference: `src/ows/registerApprovalSigning.ts`, `src/components/modals/SignModals.tsx`, `src/wallet/withWalletReady.ts` (embedded-wallet).

## 6. Recovery overlay

Create / restore encrypted backup — **never reparent** the signer iframe.

Reference: `src/components/modals/BackupModals.tsx`, called from `WalletProvider` `openCreateBackup` / `openRestoreBackup`.

1. Outer `wallet.requestDisplay` for the dialog shell (WalletProvider wrappers).
2. `overlaySignerIframe(iframe, slot, { homeContainer })` so the passphrase UI appears over a slot.
3. **Double `requestAnimationFrame`** after overlay before calling signer RPCs (layout must settle).
4. Create: `ensureReady()` then `signer.createRecoveryData(passwordText, buttonText, minPasswordLength)`.
5. Restore: **`awaitSignerReady()` only** (not `ensureReady`) then `signer.recoverKey(encrypted, passwordText, buttonText)`.
6. Always restore overlay styles in `finally` / abort cleanup; then `display.hide()`.

Distinct from `prepareSignerIframeForWebAuthn` (1×1 invisible passkey focus used **inside** `OWSSigner`).

## 7. Credentials (optional)

Prefer `CredentialsHelper` from `@1shotapi/ows-oid4` (not exported from `ows-wallet-utils`):

```typescript
new CredentialsHelper(wallet, signer, {
  repository,
  oid4vci,
  oid4vp,
  trust,
  ensureReady,
  requestCredentialOfferApproval,
  requestCredentialPresentationApproval,
  // holderSigner optional — defaults via CredentialCryptoUtils.createOwsEd25519HolderSigner
}).register();
```

Constructor arg order: **`(wallet, signer, options)`** — opposite of `SignHelper(signer, wallet, …)`.

Reference stack:

- Wiring: `src/ows/registerCredentialsProvider.ts`
- Consent UI: `src/components/modals/CredentialModals.tsx`
- Demo repositories / trust / HTTP clients fixtures: `examples/shared` (alias `@ows-shared` in the monorepo — not published)
- Wire methods: `credentials.acceptOffer` / `present` / `list` / `delete`

Do **not** call `PresentationUtils` / low-level SD-JWT helpers unless you bypass `CredentialsHelper`. Holder KB JWT lives in `CredentialCryptoUtils.createOwsEd25519HolderSigner` (`@1shotapi/ows-types`).

Host demos: `examples/credential-issuer`, `examples/credential-verifier` (use `ows-provider`; `allowLocalAccess` is host-only).
