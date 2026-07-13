# OID4VCI flow — Issuer → Wallet

Maps the [OpenID for Verifiable Credential Issuance](https://openid.net/specs/openid-4-verifiable-credential-issuance-1_0.html) pattern to OWS abstractions. The demo uses `MockOid4vciClient`; a production wallet swaps in an HTTP client behind `Oid4vciClient`.

## Sequence

```mermaid
sequenceDiagram
  participant Issuer
  participant Host as proxy.credentials
  participant Wallet as wallet.credentials
  participant Holder as HolderSigner
  participant Vci as Oid4vciClient
  participant Store as CredentialStore

  Issuer->>Host: acceptOffer(credentialOfferUri)
  Host->>Wallet: credentials.acceptOffer
  Wallet->>Vci: resolveOffer(uri)
  Vci-->>Wallet: CredentialOffer
  Wallet->>Vci: fetchIssuerMetadata(issuer)
  Vci-->>Wallet: IssuerMetadata
  Note over Wallet: authorization stubbed in mock
  Wallet->>Holder: publicKeyJwk + sign OID4VCI proof JWT
  Wallet->>Vci: requestCredential(offer, metadata, context)
  Note over Vci: verify proof; embed cnf.jwk
  Vci-->>Wallet: credential payload
  Wallet->>Store: save(storedCredential)
  Wallet-->>Host: CredentialReceipt
```

## `Oid4vciClient` interface

| Method | OID4VCI step |
|--------|----------------|
| `resolveOffer(uri)` | Parse credential offer (URI or QR) |
| `fetchIssuerMetadata(issuer)` | `/.well-known/openid-credential-issuer` |
| `requestCredential(offer, metadata, context)` | Token + credential endpoint exchange with holder PoP |

## Holder binding (proof-of-possession)

`CredentialIssuanceContext` carries:

- `holderPublicKeyJwk` — key embedded as SD-JWT VC `cnf.jwk` after verification
- `proof` — OID4VCI JWT proof (`proof_type: "jwt"`, `typ: openid4vci-proof+jwt`)
- optional `nonce` — issuer C-nonce echoed in the proof

Helpers: `ProofUtils.buildOid4vciProofJwt` / `ProofUtils.verifyOid4vciProofJwt` in `@1shotapi/ows-types`.

The mock issuer verifies the proof signature, audience (credential issuer), and that the proof header `jwk` matches `holderPublicKeyJwk` before issuing.

## Entry point

Host apps trigger issuance via:

```ts
await proxy.credentials.acceptOffer({
  credentialOfferUri: CredentialOfferUri("mock://kyc-offer/demo"),
});
```

## Stub behavior

- `mock://` URIs resolve to fixtures in `examples/shared`
- No real HTTP or OAuth token endpoint (Phase 4); PoP JWT is still required and verified in-process
- Real integration: add HTTP client implementing `Oid4vciClient`, pass the same proof in the credential request body
