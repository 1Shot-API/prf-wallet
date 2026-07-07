# OID4VP flow — Verifier → Wallet → Verifier

Maps the [OpenID for Verifiable Presentations](https://openid.net/specs/openid-4-verifiable-presentations-1_0.html) pattern to OWS abstractions. The stub uses `MockOid4vpClient`.

## Sequence

```mermaid
sequenceDiagram
  participant Verifier
  participant Host as proxy.credentials
  participant Wallet as wallet.credentials
  participant Vp as Oid4vpClient
  participant UI as credential_consent
  participant Store as CredentialStore

  Verifier->>Host: present(requestUri)
  Host->>Wallet: credentials.present
  Wallet->>Vp: resolveRequest(uri)
  Vp-->>Wallet: PresentationDefinition
  Wallet->>Store: list(matching filter)
  Wallet->>Vp: matchCredentials(definition, credentials)
  Wallet->>UI: requestCredentialPresentationApproval
  UI-->>Wallet: user approved
  Wallet->>Vp: buildPresentation(credential, definition)
  Vp-->>Wallet: PresentationResult
  Wallet-->>Host: presentation
  Verifier->>Verifier: validate (mock or real)
```

## `Oid4vpClient` interface

| Method | OID4VP step |
|--------|-------------|
| `resolveRequest(uri)` | Parse presentation request |
| `matchCredentials(definition, credentials)` | Find satisfying credentials |
| `buildPresentation(credential, definition)` | Selective disclosure + response |

## Consent

Before `buildPresentation`, the wallet must show the verifier identity and requested claims via `UiHost.requestCredentialPresentationApproval` (implemented by the `credential-consent` registry module).

## Entry point

```ts
const result = await proxy.credentials.present({
  requestUri: PresentationRequestUri("mock://kyc-presentation/demo"),
});
```

## Stub behavior

- Mock presentations are labeled blobs, not valid SD-JWT VC
- Verifier demo validates against `KycProfilePolicy` + `IssuerTrustRegistry` mocks
- Real integration: SD-JWT VC library behind `buildPresentation`, DCQL/presentation exchange per OID4VP
