# OWS Example — Mock Credential Verifier

Host Layer demo that requests a mock OID4VP presentation from the wallet via `proxy.credentials.present()` and validates it against the OWS KYC profile policy (mock).

## Run

```bash
# Terminal 1 — branding wallet with credentials modules
npm run dev:general-wallet

# Terminal 2 — issue a demo credential first (optional but recommended)
npm run dev -w @1shotapi/ows-example-credential-issuer

# Terminal 3 — verifier host
npm run dev -w @1shotapi/ows-example-credential-verifier
```

Open http://localhost:5176 (or https — see below) and click **Request presentation**.

## HTTPS (passkeys)

An HTTPS wallet iframe requires an HTTPS host page (secure-context ancestor chain). Same setup as [`examples/host`](../host/README.md):

```bash
mkcert -install
mkcert -cert-file examples/host/certs/dev-cert.pem \
  -key-file examples/host/certs/dev-key.pem \
  ows-host.com localhost 127.0.0.1
```

Issuer/verifier reuse `examples/host/certs/` when present (or their own `certs/`, or `HOST_SSL_*`). Then open `https://ows-host.com:5176`.
