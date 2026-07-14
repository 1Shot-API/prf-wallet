# Branding Layer tasks

Task-oriented guidance — not a 1:1 map of old registry modules. Specialize freely; many production branding apps lead with **custom host RPC** and skip MetaMask-shaped EIP-1193.

## 1. Scaffold

1. Install `@1shotapi/ows-types`, `ows-wallet-utils`, `ows-signer-utils` (+ `zod` as needed).
2. Serve `@1shotapi/ows-signer` as static `/signer/` on the **same origin** as branding (`rpId === location.hostname`).
3. Create a hidden `#signer-container`, then register handlers and **start the Postmate child before awaiting the nested Signing Layer** (Postmate parents stop after ~5 handshake attempts):

```typescript
const wallet = OWSWallet.prepare();
const signerPromise = OWSSigner.create(container, signerUrl, {
  hidden: true,
  credentialId: loadCredentialId(),
});
// …register handlers (ensureReady should await signerPromise)…
void wallet.start(); // registers Model immediately
const signer = await signerPromise;
```

See `examples/general-wallet` `WalletProvider` for the deferred-signer pattern.

## 2. Unlock (`ensureReady`)

App-owned passkey create / login before connect or sign:

- Persist credential id + cached addresses in app storage.
- Gate signing and account-connect behind `ensureReady()`.
- Embedded first-run UI (when `window.parent !== window`) is optional demo pattern — see `examples/general-wallet` `OnboardingPanel` / `WalletProvider`.

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

Host `OWSProxy` shows a lower-right opaque flyout (no modal backdrop). **Display queuing** (serializing concurrent dialogs) is an app/skill concern, not an SDK.

## 4. Host RPC (primary) + optional EIP-1193

**Primary path for specialized wallets:** register custom methods the host calls via `proxy.rpc` / your protocol — not MetaMask parity.

**Optional EIP-1193 reads / chain switch:**

```typescript
new RpcHelper(
  new Map([[chainId, rpcUrl], …]),
  wallet,
  signer, // optional; unused for reads today
  { defaultChainId },
);
```

Call after `prepare()`, before `start()`. Zod param schemas live in `ows-wallet-utils`; method name tables in `ows-types`.

Account connect (`eth_accounts` / `eth_requestAccounts`) is usually app-local — see `examples/general-wallet/src/ows/registerAccountConnect.ts`.

## 5. Signing consent

Headless wiring in `SignHelper` (`ows-signer-utils`):

```
requestDisplay → consent UI → ensureReady → signer.evm.signMessage | signTypedData → hide
```

App supplies `requestPersonalSignApproval` / `requestSignTypedDataApproval` (return `boolean`). Register returned handlers yourself:

```typescript
const signHelper = new SignHelper(signer, wallet, { ensureReady, … });
for (const [method, handler] of Object.entries(signHelper.handlers)) {
  wallet.registerEip1193(method, handler);
}
```

Consent UI stays in the app (`examples/general-wallet` modal components under `src/components/modals/`).

## 6. Recovery overlay

Create / restore encrypted backup:

1. `wallet.requestDisplay` for the dialog shell.
2. `overlaySignerIframe(iframe, slot, { homeContainer })` so the signer passphrase UI appears over a slot **without reparenting** (reparenting can reload the iframe and drop RPCs).
3. Call `signer.createRecoveryData` / `signer.recoverKey`.
4. Restore overlay styles; `display.hide()`.

Distinct from `prepareSignerIframeForWebAuthn` (1×1 invisible passkey focus used inside `OWSSigner`).

Reference: `examples/general-wallet` `CreateBackupModal` / `RestoreBackupModal` (`overlaySignerIframe` + signer slot).

## 7. Credentials (optional)

1. Implement or reuse a `CredentialStore` + OID4 clients (demo mocks: `examples/shared`).
2. `wallet.credentials.register({ acceptOffer, present, list, delete })`.
3. Consent UI before accept/present; wrap with `requestDisplay`.
4. Holder KB JWT: `createOwsEd25519HolderSigner` from `ows-wallet-utils` with signer digests.

Host demos: `examples/credential-issuer`, `examples/credential-verifier`.
