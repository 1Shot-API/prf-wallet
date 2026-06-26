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

Passkeys require a secure context. Use the official [@ngrok/ngrok](https://www.npmjs.com/package/@ngrok/ngrok) SDK (not the vulnerable third-party `ngrok` npm package):

```bash
# Set token from https://dashboard.ngrok.com/get-started/your-authtoken
export NGROK_AUTHTOKEN=your_token   # PowerShell: $env:NGROK_AUTHTOKEN="your_token"

npm run dev -w @1shotapi/ows-example-host
npm run tunnel -w @1shotapi/ows-example-host
```

Set `VITE_WALLET_IFRAME_URL` in `.env.local` to the wallet iframe's HTTPS URL when testing cross-origin passkeys.

## Status

Scaffold only.
