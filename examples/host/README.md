# OWS Example Host

Reference **host application** (layer A) using `@1shotapi/ows-provider` for EIP-1193.

## Run

```bash
# Terminal 1 — wallet iframe
npm run dev -w @1shotapi/ows-example-wallet

# Terminal 2 — host
npm run dev -w @1shotapi/ows-example-host
```

| Service | URL |
|---------|-----|
| Host (layer A) | http://localhost:5173 |
| Wallet iframe (layer B) | http://localhost:5174 |

## HTTPS / ngrok

Passkeys require a secure context. See `.env.example` for tunnel configuration.

## Status

Scaffold only.
