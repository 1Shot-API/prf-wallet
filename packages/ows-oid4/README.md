# @1shotapi/ows-oid4

Optional **credentials add-on** for Branding Layers that issue/present via OID4VCI / OID4VP.

Use with `@1shotapi/ows-wallet-utils` (wire registration hooks) and an `IOWSSigner`
(`OWSSigner` from `@1shotapi/ows-signer-utils`). Skip this package if your branding
layer is crypto-only.

## Features

- `CredentialsHelper` — consent-before-PoP orchestration against `wallet.credentials`
- `FetchUtils` / `ParseUtils` — injected `IFetchUtils` / `IParseUtils` defaults
- `HttpOid4vciClient` / `HttpOid4vpClient` — fetch-based OID4 clients (pre-authorized grant, DCQL subset, `direct_post.jwt` encrypt)
- Demo wallet attestation helper

Holder signing bridge: `CredentialCryptoUtils.createOwsEd25519HolderSigner` from `@1shotapi/ows-types`.

Issuer/verifier **server** demos live under `examples/credential-*` (not this package).

## Install

```bash
npm install @1shotapi/ows-oid4 @1shotapi/ows-wallet-utils
```
