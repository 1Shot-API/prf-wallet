# OWS Credentials Extension — Roadmap

This document tracks implementation phases for the OWS Credentials Extension. Normative wire contracts live in the sibling docs (`provider-methods.md`, `oid4vci-flow.md`, `oid4vp-flow.md`).

## Architecture principles

| Layer | Responsibility |
|-------|----------------|
| **Branding Layer** | Owns `CredentialStore` — save, get, list, delete. Storage may be client-side (IndexedDB, `localStorage`), server-backed, or hybrid. Mediates consent UI. |
| **`@1shotapi/ows-types`** | Credential wire contracts, domain types, OID4VCI/OID4VP client interfaces, status/trust hooks. |
| **`@1shotapi/ows-wallet-utils`** | Zod param schemas, `wallet.credentials` registrar, SD-JWT VC presentation assembly + holder binding. |
| **`@1shotapi/ows-provider`** | `proxy.credentials` host client, SD-JWT VC presentation verification. |
| **Host Layer** | Calls `proxy.credentials.*`; never touches credential payloads or signing keys directly. |
| **Signing Layer** | Signs digests/curves only (`signDigest` with `ed25519` for SD-JWT key binding). JWT assembly stays in `ows-wallet-utils` / `ows-signer-utils`. |

Branding registers handlers on `wallet.credentials`. The library builds presentations; branding fetches the stored credential and supplies a `HolderSigner` adapter wired to the OWS signer.

---

## Phase 1 — Real SD-JWT VC presentations (current)

**Goal:** Replace mock presentation blobs with standards-compliant SD-JWT VC selective disclosure and holder key binding (`kb+jwt`).

**Library:** [OpenWallet Foundation `@sd-jwt/core` + `@sd-jwt/sd-jwt-vc`](https://github.com/openwallet-foundation/sd-jwt-js) (RFC 9901, SD-JWT VC draft).

**Deliverables:**

- [x] `HolderSigner` interface and `buildSdJwtVcPresentation()` in `@1shotapi/ows-wallet-utils`
- [x] Mock OID4VCI issues real SD-JWT VCs (demo issuer key; `cnf.jwk` binds holder)
- [x] Mock OID4VP builds real presentations with selective disclosure + `kb+jwt`
- [x] `createOwsEd25519HolderSigner()` bridges `BrandingSignerHost` → `HolderSigner`
- [x] Verifier demo validates presentations cryptographically (not string-prefix checks)

**Out of scope for Phase 1:** Real HTTP OID4VCI/OID4VP, issuance PoP at token endpoint, status list fetching.

---

## Phase 2 — Holder binding at issuance (OID4VCI PoP)

**Goal:** Bind credentials to the wallet key at issuance time per OID4VCI (`proof` / `cnf` in token request).

- Extend `Oid4vciClient.requestCredential` with wallet-provided holder key material
- Real issuers validate `cnf.jwk` matches presentation `kb+jwt` signer
- Remove demo-only fixed keypairs where a live issuer is used

---

## Phase 3 — Production wallet hardening

- Encrypted credential storage (branding-owned; optional helpers in library)
- Status / revocation (`@owf/token-status-list` integration behind `CredentialStatusValidator`)
- Issuance consent UI (registry `credential-consent` extensions)
- Issuer trust registry wiring for production verifiers

---

## Phase 4 — Real OID4VCI / OID4VP HTTP clients

- Replace `MockOid4vciClient` / `MockOid4vpClient` with HTTP implementations
- DCQL / presentation definition resolution from `request_uri`
- Wallet attestation and response encryption where required by deployment profile

---

## Phase 5 — Credential delegation (holder-signed grants)

**Preferred model (Model A):** Holder-signed **delegation grant** — scoped, time-bound authorization for a delegatee key to present specific credentials/claims. Not on-chain ERC-7710 delegation for v1.

- Spec: `spec/credentials/delegation.md`
- New `proxy.credentials` / `wallet.credentials` methods for grant create/revoke/list
- Consent UI for delegation approval
- v1 signing: Ed25519 via existing OWS signer (`ed25519` scheme); ES256/P-256 only if issuers require

---

## Package map (reference)

| Path | Role |
|------|------|
| `packages/ows-types/src/credentials/` | Domain types, OID4 client interfaces |
| `packages/ows-wallet-utils/src/credentials/` | Wire schemas, registrar, SD-JWT present |
| `packages/ows-provider/src/credentials/` | Host client, SD-JWT verify |
| `packages/ows-registry/items/credentials-provider` | Wires store + OID4 clients + holder signer |
| `examples/credentials-shared/` | Demo mocks (OID4 clients, stores, fixtures) |
| `examples/credential-issuer` | Host demo — mock issuance |
| `examples/credential-verifier` | Host demo — mock verification |
