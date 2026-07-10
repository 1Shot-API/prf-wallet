# Branding modules and registry

## `BrandingModule`

From `@1shotapi/ows-branding-core`:

```typescript
type BrandingModule = {
  id: string;
  phase?: "pre-start" | "post-start"; // default pre-start
  install(ctx: BrandingContext): void | Promise<void>;
};
```

`BrandingContext` includes:

- `wallet` — `registerEip1193`, `requestDisplay`, `requestHide`, `credentials`
- `signer` — EVM/Solana helpers, `createCredential`, recovery, `getPublicKey`, …
- `ensureReady?` — unlock / create passkey before signing
- `ui?` — optional consent hooks (personal_sign, typed data, credentials, backup)

Install:

```typescript
await installBrandingModules(ctx, [moduleA, moduleB]);
await wallet.start();
```

## Registry items (open-wallet)

Typical vanilla modules under `packages/ows-registry/items/`:

| Item | Purpose |
|------|---------|
| `wallet-setup` | Create / unlock passkey, `ensureReady` |
| `account-connect` | `eth_accounts` / `eth_requestAccounts` + connect dialog |
| `approval-dialog` | `personal_sign` + EIP-712 approval UI |
| `rpc-provider` | JSON-RPC reads (`eth_call`, chain id, …) |
| `create-backup` / `recover-backup` | Recovery envelope UX |
| `credential-consent` | OID4 offer / presentation consent UI |
| `credentials-provider` | `wallet.credentials` acceptOffer / present |

Copy `vanilla/` sources into the branding app; wire factories with app-specific storage / DOM ids.

## Writing a custom module

1. Create `src/ows/<name>/install.ts` exporting `createXModule(options)` or a constant module.
2. In `install(ctx)`, register handlers on `ctx.wallet` (and use `ctx.signer` for custody).
3. Call `ctx.ensureReady?.()` before any WebAuthn-backed operation.
4. Wrap sensitive UI with `requestDisplay` / `hide`.
5. Add the module to the `installBrandingModules([...])` array **before** `wallet.start()` for `pre-start` phase.

## Do / don't

- **Do** keep UI and storage in the branding app; SDKs stay protocol-only.
- **Do** use branded constructors from `ows-types` at validation boundaries.
- **Don't** embed the signer iframe from a Host Layer page.
- **Don't** call Signing Layer `postMessage` from branding except through `OWSSigner`.
