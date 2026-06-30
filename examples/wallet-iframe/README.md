# OWS Example Wallet Iframe

Reference **wallet wrapper** (layer B) for the Open Wallet Standard. Serves the wallet app and custody signer on **one origin** (required for WebAuthn `rpId` and signer nesting).

## Stack

```
Host (ows-example-host)
  └── This example (layer B)     @1shotapi/ows-wallet-utils ↔ host
        └── Custody signer (C)   @1shotapi/ows-signer-utils ↔ signer
```

| Path | Content |
|------|---------|
| `/wallet/` | Webpack bundle — `OWSWallet` + `OWSSigner` stub |
| `/signer/` | Static `@1shotapi/ows-signer` ES modules (not bundled) |

## Setup

1. From repo root: `npm install && npm run build`
2. Copy [`.env.example`](../../.env.example) to `.env` at repo root and set:
   - `NGROK_AUTHTOKEN` ([ngrok dashboard](https://dashboard.ngrok.com/get-started/your-authtoken))
   - `NGROK_DOMAIN` — optional reserved domain from [ngrok Domains](https://dashboard.ngrok.com/domains) (e.g. `immune-sheep-light.ngrok-free.app`) for a stable URL

## Run

```bash
# Wallet + signer + ngrok (from repo root)
npm run dev:wallet

# Local HTTP only (no tunnel)
npm run dev:local -w @1shotapi/ows-example-wallet
```

| Service | Local URL |
|---------|-----------|
| Wallet | http://localhost:5174/wallet/ |
| Signer | http://localhost:5174/signer/ |

When ngrok starts, the script prints HTTPS URLs and `VITE_WALLET_IFRAME_URL` for the host example.

## Full E2E (with host)

```bash
# Terminal 1 — wallet + signer
npm run dev:wallet

# Terminal 2 — host (use ngrok /wallet/ URL from terminal 1)
# Set VITE_WALLET_IFRAME_URL in examples/host/.env.local
npm run dev -w @1shotapi/ows-example-host
```

Passkeys require HTTPS — use the ngrok wallet URL for cross-origin host testing.

## Status

Stub implementation — instantiates `OWSSigner` and `OWSWallet`; signing UX forthcoming.
