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

Open http://localhost:5176 and click **Request presentation**.
