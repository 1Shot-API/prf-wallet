# OWS Credentials Extension — Roadmap

This document tracks implementation phases for the OWS Credentials Extension. Normative wire contracts live in the sibling docs (`provider-methods.md`, `oid4vci-flow.md`, `oid4vp-flow.md`).

## Architecture principles

| Layer | Responsibility |
|-------|----------------|
| **Branding Layer** | Owns `ICredentialRepository` — store, get, list, delete, revoke (local). Storage may be client-side (IndexedDB, `localStorage`), server-backed, or hybrid. Mediates consent UI and `IIssuerTrustRegistry`. |
| **`@1shotapi/ows-types`** | Credential wire contracts, domain types, OID4VCI/OID4VP client interfaces, status/trust hooks, SD-JWT VC presentation/crypto utils. |
| **`@1shotapi/ows-wallet-utils`** | Zod param schemas, `wallet.credentials` registrar (hooks). |
| **`@1shotapi/ows-oid4`** | Optional credentials add-on: `CredentialsHelper`, HTTP OID4 clients, holder signer bridge. |
| **`@1shotapi/ows-provider`** | `proxy.credentials` host client, SD-JWT VC presentation verification. |
| **Host Layer** | Calls `proxy.credentials.*` (may pass `acceptedIssuers` on present); never touches credential payloads or signing keys directly. |
| **Signing Layer** | Signs digests/curves; PRF-derived AES seal/unseal (`encryptAES256` / `decryptAES256`). JWT assembly stays in `ows-types` / `ows-signer-utils`. |

Branding registers handlers on `wallet.credentials` (typically via `CredentialsHelper` from `ows-oid4`). The library builds presentations; branding fetches the stored credential and supplies a `IHolderSigner` adapter wired to the OWS signer.

---

## Phase 1 — Real SD-JWT VC presentations

**Goal:** Replace mock presentation blobs with standards-compliant SD-JWT VC selective disclosure and holder key binding (`kb+jwt`).

**Library:** [OpenWallet Foundation `@sd-jwt/core` + `@sd-jwt/sd-jwt-vc`](https://github.com/openwallet-foundation/sd-jwt-js) (RFC 9901, SD-JWT VC draft).

**Deliverables:**

- [x] `IHolderSigner` interface and `PresentationUtils` in `@1shotapi/ows-types`
- [x] Mock OID4VCI issues real SD-JWT VCs (demo issuer key; `cnf.jwk` binds holder)
- [x] Mock OID4VP builds real presentations with selective disclosure + `kb+jwt`
- [x] `CredentialCryptoUtils.createOwsEd25519HolderSigner()` bridges Signing Layer digests → `IHolderSigner` (`ows-types`)
- [x] Verifier demo validates presentations cryptographically (not string-prefix checks)

**Out of scope for Phase 1:** Real HTTP OID4VCI/OID4VP, issuance PoP at token endpoint, status list fetching.

---

## Phase 2 — Holder binding at issuance (OID4VCI PoP)

**Goal:** Bind credentials to the wallet key at issuance time per OID4VCI (`proof` / `cnf` in token request).

- [x] Extend `IOid4vciClient.requestCredential` with wallet-provided holder key material + JWT proof
- [x] Mock issuer verifies OID4VCI proof before embedding matching `cnf.jwk`
- [x] Live wallet path (`CredentialsHelper` in `ows-oid4` / `registerCredentialsProvider`) builds proof via `IHolderSigner` (no silent demo-holder fallback)
- [x] Verifier demo inspects disclosed claims and highlights issuer → `cnf` → `kb+jwt` custody

**Out of scope for Phase 2:** Real HTTP OID4VCI token endpoint (Phase 4); multi-credential presentations.

---

## Phase 3 — Production wallet hardening (interfaces first)

- [x] `ICredentialRepository` (full `StoredCredential` JSON at the API boundary; branding owns encrypt-at-rest)
- [x] `IIssuerTrustRegistry` with `isTrustedIssuer` (+ resolve/list for consent copy)
- [x] Host `present.acceptedIssuers` allow-list intersected with wallet matches
- [x] `CredentialsHelper` in `@1shotapi/ows-oid4` (consent **before** PoP; fail-closed status)
- [x] `ICredentialStatusValidator` rename; demo noop; fail-closed in helper
- [x] Forward-declared `AES256CipherText` + `OWSSigner.encryptAES256` / `decryptAES256` (stubs → `notImplemented`)

### Phase 3.1 — Signer KMS seal

- [x] PRF-derived `encryptAES256` / `decryptAES256` (HKDF from secp256k1 scalar, `ows-aes1:` envelope, batch, recovery-session path)

### Deferred (later phases / follow-ons)

| Item | Target |
|------|--------|
| Branding encrypt-at-rest using those APIs (1Shot: batch decrypt on first use, session memory) | Consumer app — not general-wallet |
| `@owf/token-status-list` (or equiv.) behind `ICredentialStatusValidator` | **Phase 3.2** — real status / revocation |
| PRF / key-material catastrophe or migrate-or-rewrap | Later investigation (catastrophic; out of V3 scope) |

---

## Phase 4 — Real OID4VCI / OID4VP HTTP clients

- [x] `@1shotapi/ows-oid4`: optional credentials add-on — `CredentialsHelper`, `HttpOid4vciClient` / `HttpOid4vpClient` (fetch-only)
- [x] Pre-authorized_code token + credential endpoints; client-discovered `c_nonce`
- [x] DCQL subset → OWS `PresentationDefinition`; `request_uri` HTTPS JSON
- [x] Wallet attestation hooks (`IWalletAttestationProvider`; demo profile)
- [x] Response encryption (`direct_post.jwt`, ECDH-ES + A256GCM) when verifier requests it
- [x] Local HTTP demos: `examples/credential-issuer` / `examples/credential-verifier`
- [x] `general-wallet` wires HTTP clients (mocks remain for unit tests only)

**Deferred from Phase 4:** auth-code + PKCE, arbitrary DCQL / PE 2.0, production attestation trust roots, multi-credential presentations.

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
| `packages/ows-types/src/utils/credentials/` | SD-JWT VC presentation, crypto, and OID4 PoP helpers |
| `packages/ows-oid4/` | Optional credentials add-on: helper, HTTP OID4 clients, DCQL mapper, response encrypt |
| `packages/ows-wallet-utils/src/credentials/` | Wire schemas + `CredentialWalletRegistrar` hooks |
| `packages/ows-provider/src/credentials/` | Host client, SD-JWT verify |
| `examples/general-wallet/src/ows/registerCredentialsProvider.ts` | Demo wire: repo + `ows-oid4` helper + trust |
| `examples/shared/` | Demo mocks / fixtures (unit tests; not published) |
| `examples/credential-issuer` | Host demo — HTTP OID4VCI issuer |
| `examples/credential-verifier` | Host demo — HTTP OID4VP verifier + custody UI |
