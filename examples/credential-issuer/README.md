# OWS Example — Credential Issuer (OID4VCI HTTP)

Host Layer demo that offers a real HTTPS OID4VCI credential offer to the wallet via `proxy.credentials.acceptOffer()`.

Vite middleware serves:

- `GET /.well-known/openid-credential-issuer`
- `GET /jwks`
- `GET /offers/demo`
- `POST /token` (pre-authorized_code → access token + `c_nonce`)
- `POST /credential` (verify PoP JWT; issue SD-JWT VC)

Public issuer identity is **`ows-issuer.com`** (offer URI, well-known `credential_issuer`, and SD-JWT `iss`), even if you open the UI via `localhost`. Bind locally; point hosts + wallet fetches at `ows-issuer.com`.

**Chrome third-party storage partitioning:** the Branding Layer iframe’s `localStorage` is keyed by top-level site. Issuing on `ows-issuer.com` and presenting on `ows-verifier.com` yields **separate credential stores**. For end-to-end demos, open both hosts under the same site:

- Issuer UI: `https://ows-host.com:5175`
- Verifier UI: `https://ows-host.com:5176`

(`iss` / offer URLs can still say `ows-issuer.com`; only the browser address bar needs the shared host.)

## Run

```bash
# Terminal 1 — branding wallet (HttpOid4vciClient)
npm run dev:general-wallet

# Terminal 2 — issuer host
npm run dev -w @1shotapi/ows-example-credential-issuer
```

Open **https://ows-host.com:5175** (or https://ows-issuer.com:5175) and click **Send offer to wallet**.

Optional: override with `ISSUER_ORIGIN` (default `http(s)://ows-issuer.com:5175`). Branding iframe URL follows the same rules as [`examples/host`](../host/README.md) (`WALLET_IFRAME_URL` → `NGROK_DOMAIN` → localhost).

## HTTPS (passkeys)

An HTTPS wallet iframe requires an HTTPS host page (secure-context ancestor chain). Same setup as [`examples/host`](../host/README.md):

```bash
mkcert -install
mkcert -cert-file examples/host/certs/dev-cert.pem \
  -key-file examples/host/certs/dev-key.pem \
  ows-host.com ows-issuer.com ows-verifier.com localhost 127.0.0.1
```

Hosts file:

```text
127.0.0.1  ows-host.com ows-issuer.com ows-verifier.com
```

Issuer/verifier reuse `examples/host/certs/` when present. Then open `https://ows-issuer.com:5175`.
