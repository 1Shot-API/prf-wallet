# @1shotapi/ows-oid4

Optional **credentials add-on** for Branding Layers that issue/present via OID4VCI / OID4VP.

Use with `@1shotapi/ows-wallet-utils` (wire registration hooks) and an `IOWSSigner`
(`OWSSigner` from `@1shotapi/ows-signer-utils`). Skip this package if your branding
layer is crypto-only.

## Features

- `CredentialsHelper` — thin adapter: resolve/match/trust → `requestDisplay` → branding `approveAnd*` → `release()`
- `issueCredentialAfterApproval` / `presentCredentialAfterApproval` — PoP + OID4 helpers for branding hooks
- `FetchUtils` / `ParseUtils` — injected `IFetchUtils` / `IParseUtils` defaults
- `HttpOid4vciClient` / `HttpOid4vpClient` — fetch-based OID4 clients (pre-authorized grant, DCQL subset, `direct_post.jwt` encrypt)
- Demo wallet attestation helper

Holder signing bridge: `createCredentialsHolderSigner` (or `CredentialCryptoUtils.createOwsEd25519HolderSigner` from `@1shotapi/ows-types`).

Issuer/verifier **server** demos live under `examples/credential-*` (not this package).

## Install

```bash
npm install @1shotapi/ows-oid4 @1shotapi/ows-wallet-utils
```

## Branding ownership (SignHelper parity)

```ts
import {
  CredentialsHelper,
  createCredentialsHolderSigner,
  issueCredentialAfterApproval,
  presentCredentialAfterApproval,
} from "@1shotapi/ows-oid4";

const resolveHolderSigner = createCredentialsHolderSigner(signer);

new CredentialsHelper(wallet, {
  repository,
  oid4vci,
  oid4vp,
  trust,
  approveAndAcceptOffer: async (request) => {
    // setup-only if needed, consent UI, then:
    return issueCredentialAfterApproval({
      offer: request.offer,
      metadata: request.metadata,
      oid4vci,
      repository,
      resolveHolderSigner,
      getProofNonce,
      attestationProvider,
    });
  },
  approveAndPresent: async (request) => {
    // consent UI, then:
    return presentCredentialAfterApproval({
      definition: request.definition,
      credential: request.credential,
      oid4vp,
      resolveHolderSigner,
      attestationProvider,
    });
  },
}).register();
```

Setup / unlock and passkey ceremonies belong **inside** `approveAnd*`, not on helper options.
