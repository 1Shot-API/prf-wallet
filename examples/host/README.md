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
| Host Layer | http://localhost:5173 (or https — see below) |
| Branding Layer | http://localhost:5174/wallet/ or `https://<NGROK_DOMAIN>/wallet/` |

The host embeds the Branding Layer iframe URL from repo root `.env`:

- `NGROK_DOMAIN` set → `https://<domain>/wallet/`
- otherwise → `http://localhost:5174/wallet/`

Copy [`.env.example`](../../.env.example) to `.env` at the repo root and set `NGROK_AUTHTOKEN` + `NGROK_DOMAIN` when using ngrok for passkey testing.

## Secure contexts (passkeys)

WebAuthn only works in a **secure context**. An HTTPS branding/signer iframe embedded in an **HTTP** host is **not** secure — browsers walk the ancestor chain, so `window.isSecureContext` is `false` and `navigator.credentials` is missing even when `location.origin` is the ngrok HTTPS URL.

Therefore the Host Layer must also be HTTPS (or `localhost` / `*.localhost` over HTTP) when testing passkeys with an HTTPS wallet iframe.

### Local HTTPS with mkcert

```bash
# Once per machine
mkcert -install

# From repo root — SANs for hosts-file testing + localhost
mkcert -cert-file examples/host/certs/dev-cert.pem \
  -key-file examples/host/certs/dev-key.pem \
  ows-host.com ows-issuer.com ows-verifier.com localhost 127.0.0.1
```

Optional hosts entry (`C:\Windows\System32\drivers\etc\hosts`):

```text
127.0.0.1  ows-host.com ows-issuer.com ows-verifier.com
```

If `examples/host/certs/dev-cert.pem` and `dev-key.pem` exist, `npm run dev` enables HTTPS automatically for **host, credential-issuer, and credential-verifier** (shared helper in `examples/host-dev.mjs`). Or set in repo root `.env`:

```bash
HOST_HTTPS=1
# optional overrides:
# HOST_SSL_CERT=examples/host/certs/dev-cert.pem
# HOST_SSL_KEY=examples/host/certs/dev-key.pem
```

Then open **`https://ows-host.com:5173`** (accept the local CA once via `mkcert -install`). Credential demos use **`https://ows-issuer.com:5175`** / **`https://ows-verifier.com:5176`**.

Confirm in the **signer** iframe console:

```js
window.isSecureContext  // true
navigator.credentials   // CredentialsContainer
location.origin         // https://<ngrok>/…
```

## E2E signing

1. Start general-wallet dev (`npm run dev:general-wallet`) and host dev (above).
2. Open the host URL (HTTPS when using ngrok wallet).
3. Enter a message and click **Sign**
4. First sign triggers passkey creation in the branding/signing stack; subsequent signs reuse the stored credential.

## Build

```bash
npm run build -w @1shotapi/ows-example-host
npm run clean -w @1shotapi/ows-example-host
```
