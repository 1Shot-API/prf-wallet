# OWS Example General Wallet

Reference **general-purpose Branding Layer** for the Open Wallet Standard — a MetaMask-style wallet in the browser. Serves the branding app and Signing Layer on **one origin** (required for WebAuthn `rpId` and signer nesting).

Built with **Vite + React + TypeScript + Tailwind CSS**.

## Stack

```
Host Layer (ows-example-host)
  └── This example (Branding Layer)   @1shotapi/ows-wallet-utils ↔ host
        └── Signing Layer             @1shotapi/ows-signer-utils ↔ signer
```

| Path | Content |
|------|---------|
| `/wallet/` | Vite React app — `OWSWallet` + UI via `WalletProvider` |
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

## Architecture

- `WalletProvider` boots `OWSSigner` + `OWSWallet`, registers EIP-1193 / credentials handlers, and owns unlock / address / chain state.
- Shared `Modal` + modal queue drive connect, sign, credential consent, backup/restore (signer iframe overlay via `overlaySignerIframe`).
- Protocol wiring lives under `src/ows/`; UI under `src/components/`.

## Status

React rewrite with passkey create/unlock, EIP-191 `personal_sign` / typed data, `RpcHelper` / `SignHelper`, credentials, backup/restore, and EVM/Solana address display.
