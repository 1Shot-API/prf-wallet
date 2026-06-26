# OWS Example Wallet Iframe

Reference **wallet wrapper** (layer B) for the Open Wallet Standard.

## Run

```bash
npm run dev -w @1shotapi/ows-example-wallet
```

Opens at `http://localhost:5174`.

## Stack

```
Host (ows-example-host)
  └── This example (layer B)     @1shotapi/ows-wallet-utils ↔ host
        └── Custody signer (C)   @1shotapi/ows-signer-utils ↔ signer
```

## 1ShotPay

Production patterns live in the private 1ShotPay repo. This example will be an open-source extraction — see [CONTRIBUTING.md](../../CONTRIBUTING.md).

## Status

Scaffold only.
