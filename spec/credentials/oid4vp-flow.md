# OID4VP flow — Verifier → Wallet → Verifier

Maps the [OpenID for Verifiable Presentations](https://openid.net/specs/openid-4-verifiable-presentations-1_0.html) pattern to OWS abstractions.

- **Production / demos:** `@1shotapi/ows-oid4` (`HttpOid4vpClient` + `CredentialsHelper`)
- **Unit tests:** optional `MockOid4vpClient` in `examples/shared`
- **DI seam:** `IOid4vpClient` in `@1shotapi/ows-types`
- **Wire hooks:** `wallet.credentials` registrar in `@1shotapi/ows-wallet-utils`

## Sequence

```mermaid
sequenceDiagram
  participant Verifier
  participant Host as proxy.credentials
  participant Wallet as wallet.credentials
  participant Vp as IOid4vpClient
  participant UI as credential_consent
  participant Store as ICredentialRepository

  Verifier->>Host: present(requestUri)
  Host->>Wallet: credentials.present
  Wallet->>Vp: resolveRequest(uri)
  Vp-->>Wallet: PresentationDefinition
  Wallet->>Store: list(matching filter)
  Wallet->>Vp: matchCredentials(definition, credentials)
  Wallet->>UI: requestCredentialPresentationApproval
  UI-->>Wallet: user approved
  Wallet->>Vp: buildPresentation(credential, definition)
  Note over Vp: optional attestation; encrypt; POST response_uri
  Vp-->>Wallet: PresentationResult
  Wallet-->>Host: presentation
  Verifier->>Verifier: validate (JWKS + policy + custody)
```

## `IOid4vpClient` interface

| Method | OID4VP step |
|--------|-------------|
| `resolveRequest(uri)` | Fetch `request_uri` (JSON); map DCQL or claim-list PD |
| `getAuthorizationRequest?(id)` | Raw auth request (response_uri, encryption JWKS, DCQL) |
| `matchCredentials(definition, credentials)` | Find satisfying credentials |
| `buildPresentation(credential, definition, context)` | SD-JWT VC + kb+jwt; optional JWE + `direct_post` |

## DCQL subset (Phase 4)

Supported:

- Single credential query (`credentials.length === 1`)
- `meta.vct_values` → OWS `credentialTypes`
- Claim `path` entries → OWS `requestedClaims` (last path segment)

Unsupported constructs fail closed (reject). Full PE 2.0 / multi-credential presentations are deferred.

## Response modes

| Mode | Behavior |
|------|----------|
| `direct_post` | POST `vp_token` + `presentation_submission` to `response_uri` |
| `direct_post.jwt` | Encrypt VP with verifier JWKS (`ECDH-ES` + `A256GCM` by default); POST `response` |

`PresentationResult` still returns plaintext `presentation` for host custody UI when available, plus optional `encryptedResponse` / `responseMode` / `submittedToResponseUri`.

## Wallet attestation

When `client_metadata.require_wallet_attestation` is set, `HttpOid4vpClient` invokes `IWalletAttestationProvider` (demo profile only — not production trust roots).

## Consent

Before `buildPresentation`, the wallet must show the verifier identity and requested claims via `requestCredentialPresentationApproval`.

## Entry point

```ts
const result = await proxy.credentials.present({
  requestUri: PresentationRequestUri("https://verifier.example/request/demo"),
  acceptedIssuers: [CredentialIssuer("https://issuer.example")],
});
```

Local demos: `examples/credential-verifier` serves `/request/demo` (DCQL + encryption JWKS), `/response`, and `/issuer-jwks`.
