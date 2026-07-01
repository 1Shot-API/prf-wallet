# OWS Example Host

Reference **Host Layer** application using `@1shotapi/ows-provider` for EIP-1193.

## Run

```bash
# Terminal 1 — Branding Layer + Signing Layer + ngrok (repo root)
npm run dev:general-wallet

# Terminal 2 — Host Layer
npm run dev -w @1shotapi/ows-example-host
```

| Service | URL |
|---------|-----|
| Host Layer | http://localhost:5173 |
| Branding Layer | http://localhost:5174/wallet/ |

The host embeds the Branding Layer iframe URL from repo root `.env`:

- `NGROK_DOMAIN` set → `https://<domain>/wallet/`
- otherwise → `http://localhost:5174/wallet/`

Copy [`.env.example`](../../.env.example) to `.env` at the repo root and set `NGROK_AUTHTOKEN` + `NGROK_DOMAIN` when using ngrok for passkey testing.

## E2E signing

1. Start general-wallet dev (`npm run dev:general-wallet`) and host dev (above).
2. Open http://localhost:5173
3. Enter a message and click **Sign**
4. First sign triggers passkey creation in the branding/signing stack; subsequent signs reuse the stored credential.

Passkeys require HTTPS on the branding origin — use the ngrok branding URL (via `NGROK_DOMAIN`) when testing cross-origin from localhost.

## Build

```bash
npm run build -w @1shotapi/ows-example-host
npm run clean -w @1shotapi/ows-example-host
```
