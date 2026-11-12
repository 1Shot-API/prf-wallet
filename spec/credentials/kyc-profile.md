# OWS KYC Profile

An **optional profile** layered on W3C VC + OID4VC standards. It is not a new credential standard — it recommends schemas, trust metadata, and verifier policies for reusable KYC credentials.

## Recommended credential type

```json
{
  "type": ["VerifiableCredential", "KycCredential"],
  "credentialSchema": {
    "id": "https://schemas.ows.example/kyc/v1",
    "type": "JsonSchema"
  }
}
```

## Recommended claims (credentialSubject)

| Claim | Type | Notes |
|-------|------|-------|
| `ageOver18` | boolean | Selective disclosure friendly |
| `country` | string (ISO 3166-1 alpha-2) | Jurisdiction |
| `assuranceLevel` | enum | `low` \| `substantial` \| `high` |
| `verifiedAt` | ISO 8601 datetime | Freshness input |

Avoid placing full legal name, government ID numbers, or biometrics in default reusable credentials. Verifiers request minimum necessary claims via presentation definitions.

## Trust framework

`IssuerTrustMetadata` (in `@1shotapi/ows-types`) describes issuers the wallet or verifier may trust:

```json
{
  "issuerId": "https://kyc.demo.issuer.example",
  "name": "Demo KYC Issuer",
  "assuranceLevels": ["substantial", "high"],
  "jurisdictions": ["US", "GB"]
}
```

Wallets may surface issuer name during consent. Verifiers maintain a host-side allow-list (`acceptedIssuers` on `present`) and `KycProfilePolicy`; wallets maintain an `IIssuerTrustRegistry`:

- Allowed issuer IDs
- Maximum credential age (`maxAgeDays`)
- Required claims for a given use case
- Minimum assurance level

## Presentation policy example

```ts
const policy: KycProfilePolicy = {
  requiredClaims: ["ageOver18", "country"],
  minAssuranceLevel: "substantial",
  maxAgeDays: 365,
  allowedIssuers: ["https://kyc.demo.issuer.example"],
};
```

## Compliance nuance

A reusable KYC credential proves that **an issuer made a claim** at a point in time. It does **not** automatically satisfy every verifier's legal obligations. Verifiers must still decide:

- Whether they trust the issuer
- What verification process the issuer performed
- Credential freshness and jurisdiction
- Whether sanctions screening is current
- Liability allocation

OWS separates **credential transport and storage** (wallet extension) from **verifier compliance policy** (`KycProfilePolicy` and app-specific rules).

## Wallet / account binding

Future profiles may bind credentials to wallet keys (e.g. holder binding JWT signed via `ows-signer`). Not required in the stub phase.
