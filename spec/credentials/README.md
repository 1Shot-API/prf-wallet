# OWS Credentials Extension

Standards-aligned verifiable credential support for Open Wallet Standard (OWS) wallets. OWS does **not** invent a new identity system — it exposes existing standards through a dedicated `proxy.credentials` / `wallet.credentials` provider boundary.

## Standards alignment

| Standard | Role in OWS |
|----------|-------------|
| [W3C Verifiable Credentials Data Model 2.0](https://www.w3.org/TR/vc-data-model-2.0/) | Semantic model for credentials (issuer, subject, validity, status) |
| [OpenID for Verifiable Credential Issuance (OID4VCI)](https://openid.net/specs/openid-4-verifiable-credential-issuance-1_0.html) | Issuer → wallet flow |
| [OpenID for Verifiable Presentations (OID4VP)](https://openid.net/specs/openid-4-verifiable-presentations-1_0.html) | Verifier → wallet → verifier flow |
| SD-JWT VC (and pluggable formats) | Selective disclosure for privacy-preserving presentations |

## Layering

```
OWS Credentials Extension
  ├── Credential storage / listing / deletion
  ├── OID4VCI client abstraction (issuance)
  ├── OID4VP client abstraction (presentation)
  ├── Consent UI hooks (branding registry modules)
  ├── Status / revocation validation hooks
  └── Issuer trust metadata hooks

Optional OWS KYC Profile (see kyc-profile.md)
  └── Recommended schemas, trust framework, assurance levels — a profile on VC/OID4VC, not a new credential standard
```

## Provider boundary

Credentials use a **dedicated namespace**, separate from EIP-1193 (`proxy.ethereum`) and generic custom RPC (`proxy.rpc`):

- **Host:** `proxy.credentials.acceptOffer()`, `.present()`, `.list()`, `.delete()`
- **Branding:** `wallet.credentials.register({ acceptOffer, present, list, delete })`
- **Wire:** Postmate keys prefixed with `credentials.` (e.g. `credentials.acceptOffer`)

Host apps must **not** call `proxy.rpc()` for credential operations.

## Actors

| Actor | Description |
|-------|-------------|
| **Issuer** | Signs and issues credentials (KYC provider, bank, employer, …) |
| **Holder** | The user |
| **Wallet** | OWS-compatible branding layer — stores credentials, mediates consent, presents claims |
| **Verifier** | Requests proof (dApp, neobank, agent, …) |

## Non-goals (this reference implementation)

- Proprietary identity product
- Full production VC wallet
- Sensitive KYC/PII onchain (onchain data limited to status, revocation, nullifiers if any)
- Real OID4VCI/OID4VP HTTP servers in the stub phase (mocks only)

## Package map

| Path | Purpose |
|------|---------|
| `spec/credentials/` | Normative extension docs |
| `packages/ows-credentials` | Types, interfaces, mocks |
| `packages/ows-registry/items/credentials-provider` | Branding module — wires wallet.credentials |
| `packages/ows-registry/items/credential-consent` | Presentation consent UI |
| `examples/credential-issuer` | Host demo — mock issuance |
| `examples/credential-verifier` | Host demo — mock verification |

## Future integration (post-stub)

See [roadmap.md](./roadmap.md) for phased delivery. Real OID4VCI/OID4VP HTTP and encrypted credential storage are swappable behind the interfaces in `@1shotapi/ows-credentials`.
