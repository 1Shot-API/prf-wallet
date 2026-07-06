# OWS Branding Layer Registry

ShadCN-style **copy-paste modules** for Branding Layer apps. Source of truth lives here; examples commit synced copies under `src/ows/`.

## Items

| Item | Target | Description |
|------|--------|-------------|
| `approval-dialog` | `vanilla` | EIP-191 `personal_sign` + EIP-712 typed-data approval UI |

## Sync into an example

```bash
npm run sync:general-wallet -w @1shotapi/ows-registry
```

Copies `items/approval-dialog/vanilla/*` → `examples/general-wallet/src/ows/approval-dialog/`.

## Adding a module

1. Add `items/<name>/registry-item.json` and `items/<name>/vanilla/` (or `react-tailwind/`).
2. Export a `BrandingModule` from `install.ts` (see `@1shotapi/ows-branding-core`).
3. Run sync for affected examples and commit both registry + example copies.
