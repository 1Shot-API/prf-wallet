# OWS Example — Mock Credential Issuer

Host Layer demo that sends a mock OID4VCI credential offer to the wallet via `proxy.credentials.acceptOffer()`.

## Run

```bash
# Terminal 1 — branding wallet with credentials
npm run dev:general-wallet

# Terminal 2 — issuer host
npm run dev -w @1shotapi/ows-example-credential-issuer
```

Open http://localhost:5175 (or https — see below) and click **Send offer to wallet**.

## HTTPS (passkeys)

An HTTPS wallet iframe requires an HTTPS host page (secure-context ancestor chain). Same setup as [`examples/host`](../host/README.md):

```bash
mkcert -install
mkcert -cert-file examples/host/certs/dev-cert.pem \
  -key-file examples/host/certs/dev-key.pem \
  ows-host.com localhost 127.0.0.1
```

Issuer/verifier reuse `examples/host/certs/` when present (or their own `certs/`, or `HOST_SSL_*`). Then open `https://ows-host.com:5175`.
