# OWS Example — Credential Verifier (OID4VP HTTP)

Host Layer demo that requests an OID4VP presentation from the wallet via `proxy.credentials.present()` and validates it (JWKS + KYC policy + custody UI).

Vite middleware serves:

- `GET /request/demo` — DCQL query, nonce, `response_uri`, `direct_post.jwt` + encryption JWKS
- `POST /response` — plaintext or JWE VP token
- `GET /request/latest` / `GET /response/latest` — inspection helpers
- `GET /issuer-jwks` — proxy/fallback issuer signing keys

Public verifier identity is **`ows-verifier.com`**. Issuer allow-list / JWKS use **`ows-issuer.com`**.

**Chrome third-party storage partitioning:** open the verifier as **`https://ows-host.com:5176`** when you issued on **`https://ows-host.com:5175`**, so the wallet iframe shares the same partitioned `localStorage` as issuance. Using `ows-verifier.com` after issuing on `ows-issuer.com` looks like an empty wallet.

## Run

```bash
# Terminal 1 — branding wallet (HttpOid4vpClient)
npm run dev:general-wallet

# Terminal 2 — issue a demo credential first
npm run dev -w @1shotapi/ows-example-credential-issuer

# Terminal 3 — verifier host
npm run dev -w @1shotapi/ows-example-credential-verifier
```

Open **https://ows-host.com:5176** (or https://ows-verifier.com:5176) and click **Request presentation**.

Optional env: `ISSUER_ORIGIN` / `VERIFIER_ORIGIN` (defaults `ows-issuer.com:5175` / `ows-verifier.com:5176`).

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

Then open `https://ows-verifier.com:5176`.
