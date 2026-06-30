# OWS Example Host

Reference **host application** (layer A) using `@1shotapi/ows-provider` for EIP-1193.

## Run

```bash
# Terminal 1 — wallet + signer + ngrok (repo root)
npm run dev:wallet

# Terminal 2 — host
npm run dev -w @1shotapi/ows-example-host
```

| Service | URL |
|---------|-----|
| Host (layer A) | http://localhost:5173 |
| Wallet iframe (layer B) | http://localhost:5174/wallet/ |

The host embeds the wallet iframe URL from repo root `.env`:

- `NGROK_DOMAIN` set → `https://<domain>/wallet/`
- otherwise → `http://localhost:5174/wallet/`

Copy [`.env.example`](../../.env.example) to `.env` at the repo root and set `NGROK_AUTHTOKEN` + `NGROK_DOMAIN` when using ngrok for passkey testing.

## E2E signing

1. Start wallet dev (`npm run dev:wallet`) and host dev (above).
2. Open http://localhost:5173
3. Enter a message and click **Sign**
4. First sign triggers passkey creation in the wallet/signer stack; subsequent signs reuse the stored credential.

Passkeys require HTTPS on the wallet origin — use the ngrok wallet URL (via `NGROK_DOMAIN`) when testing cross-origin from localhost.

## Build

```bash
npm run build -w @1shotapi/ows-example-host
npm run clean -w @1shotapi/ows-example-host
```
