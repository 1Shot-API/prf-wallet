# OWS Example General Wallet

Reference **general-purpose Branding Layer** for the Open Wallet Standard — a MetaMask-style wallet in the browser. Serves the branding app and Signing Layer on **one origin** (required for WebAuthn `rpId` and signer nesting).

A separate, app-specific Branding Layer example (e.g. 1ShotPay with scoped `transfer()` / custom RPC) will be added later.

## Stack

```
Host Layer (ows-example-host)
  └── This example (Branding Layer)   @1shotapi/ows-wallet-utils ↔ host
        └── Signing Layer             @1shotapi/ows-signer-utils ↔ signer
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
# Branding Layer + Signing Layer + ngrok (from repo root)
npm run dev:general-wallet

# Local HTTP only (no tunnel)
npm run dev:local -w @1shotapi/ows-example-general-wallet
```

| Service | Local URL |
|---------|-----------|
| Branding Layer (`/wallet/`) | http://localhost:5174/wallet/ |
| Signing Layer (`/signer/`) | http://localhost:5174/signer/ |

When ngrok starts, the script prints HTTPS URLs for the branding iframe. The host reads `NGROK_DOMAIN` from repo root `.env`.

## Full E2E (with host)

```bash
# Terminal 1 — Branding Layer + Signing Layer
npm run dev:general-wallet

# Terminal 2 — Host Layer (reads NGROK_DOMAIN from repo root .env)
npm run dev -w @1shotapi/ows-example-host
```

Passkeys require HTTPS — use the ngrok branding URL for cross-origin host testing.

## Status

Bootstrapped wallet with passkey creation, EIP-191 `personal_sign` (approval dialog UI), `RpcHelper` / `SignHelper`, credentials, backup/restore, and EVM/Solana address display.

Example-local UI and wiring live under `src/ows/` (explicit registrars; no module install runtime).
