# OID4VCI flow — Issuer → Wallet

Maps the [OpenID for Verifiable Credential Issuance](https://openid.net/specs/openid-4-verifiable-credential-issuance-1_0.html) pattern to OWS abstractions.

- **Production / demos:** `@1shotapi/ows-oid4` (`HttpOid4vciClient` + `CredentialsHelper`)
- **Unit tests:** optional `MockOid4vciClient` in `examples/shared`
- **DI seam:** `IOid4vciClient` in `@1shotapi/ows-types`
- **Wire hooks:** `wallet.credentials` registrar in `@1shotapi/ows-wallet-utils`

## Sequence

```mermaid
sequenceDiagram
  participant Issuer
  participant Host as proxy.credentials
  participant Wallet as wallet.credentials
  participant Holder as IHolderSigner
  participant Vci as IOid4vciClient
  participant Store as ICredentialRepository

  Issuer->>Host: acceptOffer(credentialOfferUri)
  Host->>Wallet: credentials.acceptOffer
  Wallet->>Vci: resolveOffer(uri)
  Vci-->>Wallet: CredentialOffer
  Wallet->>Vci: fetchIssuerMetadata(issuer)
  Vci-->>Wallet: IssuerMetadata
  Note over Wallet: consent UI
  Wallet->>Vci: prepareCredentialRequest (pre-authorized token + c_nonce)
  Wallet->>Holder: publicKeyJwk + sign OID4VCI proof JWT
  Wallet->>Vci: requestCredential(offer, metadata, context)
  Note over Vci: verify proof; embed cnf.jwk
  Vci-->>Wallet: credential payload
  Wallet->>Store: save(storedCredential)
  Wallet-->>Host: CredentialReceipt
```

## `IOid4vciClient` interface

| Method | OID4VCI step |
|--------|----------------|
| `resolveOffer(uri)` | Parse credential offer (`https://…`, `openid-credential-offer://`) |
| `fetchIssuerMetadata(issuer)` | `/.well-known/openid-credential-issuer` |
| `prepareCredentialRequest?(offer, metadata)` | Pre-authorized token exchange → access token + `c_nonce` |
| `requestCredential(offer, metadata, context)` | Credential endpoint with holder PoP (+ optional wallet attestation) |

## Grant profile (Phase 4)

- **Supported:** `urn:ietf:params:oauth:grant-type:pre-authorized_code` only
- **Deferred:** authorization-code + PKCE / full authorization server

`CredentialsHelper` prefers `c_nonce` from `prepareCredentialRequest`; `getProofNonce` remains an optional fallback for mocks.

## Holder binding (proof-of-possession)

`CredentialIssuanceContext` carries:

- `holderPublicKeyJwk` — key embedded as SD-JWT VC `cnf.jwk` after verification
- `proof` — OID4VCI JWT proof (`proof_type: "jwt"`, `typ: openid4vci-proof+jwt`)
- optional `nonce` — issuer C-nonce echoed in the proof
- optional `walletAttestationJwt` — when the issuer profile requires attestation

Helpers: `ProofUtils.buildOid4vciProofJwt` / `ProofUtils.verifyOid4vciProofJwt` in `@1shotapi/ows-types`.

## Entry point

```ts
await proxy.credentials.acceptOffer({
  credentialOfferUri: CredentialOfferUri("https://issuer.example/offers/demo"),
});
```

Local demos: `examples/credential-issuer` serves `/.well-known/openid-credential-issuer`, `/token`, `/credential`, and `/offers/demo`.
