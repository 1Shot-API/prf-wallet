# @1shotapi/ows-branding-core

Headless **Branding Layer** module contracts for the Open Wallet Standard.

Registry UI blocks (copied into your app via `@1shotapi/ows-registry`) implement `BrandingModule` and receive a `BrandingContext` with `OWSWallet` and `OWSSigner` instances — they do not extend the protocol SDKs.

## Usage

```typescript
import { installBrandingModules } from "@1shotapi/ows-branding-core";
import { OWSWallet } from "@1shotapi/ows-wallet-utils";
import { approvalDialogModule } from "./ows/approval-dialog/install.js";

const wallet = OWSWallet.prepare();
const ctx = { wallet, signer, ensureReady: ensureWalletReady };

await installBrandingModules(ctx, [approvalDialogModule]);
wallet.registerEip1193("eth_requestAccounts", ...);
await wallet.start();
```

## Related

| Package | Role |
|---------|------|
| `@1shotapi/ows-registry` | Copy-paste module templates |
| `@1shotapi/ows-wallet-utils` | Host ↔ Branding protocol |
| `@1shotapi/ows-signer-utils` | Branding ↔ Signing protocol |
