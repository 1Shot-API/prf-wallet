# OWS Example — Mock Credential Issuer

Host Layer demo that sends a mock OID4VCI credential offer to the wallet via `proxy.credentials.acceptOffer()`.

## Run

```bash
# Terminal 1 — branding wallet with credentials modules
npm run dev:general-wallet

# Terminal 2 — issuer host
npm run dev -w @1shotapi/ows-example-credential-issuer
```

Open http://localhost:5175 and click **Send offer to wallet**.
