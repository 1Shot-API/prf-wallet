# @1shotapi/ows-types

## 0.1.3

### Patch Changes

- 498d823: Add EChainTechnology and RelayerTransactionId; move IBlockchainProvider and AddressUtils (ENS-aware) into ows-wallet-utils with viem as a peer dependency.

## 0.1.2

### Patch Changes

- Add typed eth_sendTransaction support: branded transaction hash, RpcHelper active-chain request/broadcast helpers, and SignHelper prepare → sign → broadcast with transaction consent.

## 0.1.1

### Patch Changes

- afc99f3: Replace PasskeyPublicKey with branded COSEPublicKey / SPKIPublicKey. Signing Layer emits COSE (`cosePublicKey`) from attestation authenticator data; add COSEToSPKIPublicKey in ows-signer-utils for Web Crypto consumers.

## 0.1.0

### Minor Changes

- 0e1b1d1: Move SD-JWT VC presentation and crypto utilities from `ows-wallet-utils` into `ows-types` (`utils/credentials/`). Drop `ows-provider`'s dependency on `ows-wallet-utils`; host apps use `@1shotapi/ows-types` for presentation helpers and `@1shotapi/ows-provider` for verify/proxy only.

  **Breaking:** `buildSdJwtVcPresentation`, `extractHolderJwkFromSdJwtVc`, and crypto helpers are no longer exported from `@1shotapi/ows-wallet-utils` or re-exported from `@1shotapi/ows-provider`. Use `PresentationUtils` / `CredentialCryptoUtils` from `@1shotapi/ows-types`. `CredentialCryptoUtils.createOwsEd25519HolderSigner` lives on `@1shotapi/ows-types`.

- aaf43d4: Add `OWSWallet.requestDisplay()` / `requestHide()` so the branding iframe can ask the host to show or hide a lower-right wallet flyout (opaque panel, no modal backdrop) before WebAuthn or approval UI in cross-origin embeds. Host-side `OWSProxy` handles `ows:requestDisplay`, `ows:requestHide`, and `ows:releaseDisplay`.
- e83e5ce: Fold verifiable credentials into core OWS packages: types and OID4 interfaces in `ows-types`, branding wire and SD-JWT presentation in `ows-wallet-utils`, host proxy and SD-JWT verify in `ows-provider`. Demo mocks live under `examples/shared` (not published). Removes `@1shotapi/ows-credentials`.
- 3c8b506: Add OID4VCI holder proof-of-possession via `ProofUtils` (`buildOid4vciProofJwt` / `verifyOid4vciProofJwt`, branded `JWKThumbprint`) and require proof in issuance context. Enforce `kb+jwt` audience during SD-JWT VC presentation verify.
- 89e40a9: Phase 3 credentials hardening: `ICredentialRepository`, `IIssuerTrustRegistry.isTrustedIssuer`, `CredentialsHelper`, host `acceptedIssuers` on present, fail-closed status checks, and stubbed `OWSSigner.encryptAES256` / `decryptAES256` with branded `AES256CipherText`.
- a78bba8: Phase 4 credentials: optional `@1shotapi/ows-oid4` add-on (`CredentialsHelper`, HTTP OID4VCI/OID4VP clients). Holder bridge is `CredentialCryptoUtils.createOwsEd25519HolderSigner` in `ows-types`. Wire registrar/Zod schemas stay in `ows-wallet-utils`. `IOWSSigner` lives in `ows-types` (implemented by `OWSSigner`). Verifier/issuer HTTP demos own their server-side JWE helpers.
- 9a87faf: Move shared EIP-1193 method lists and typed request tables into `@1shotapi/ows-types`. Add `RpcHelper` in `ows-wallet-utils` to register JSON-RPC read methods and chain switching on `OWSWallet` (replaces the registry rpc-provider module for branding apps).
- eae834a: Add `EVMChainId` and allow branding modules to register additional EIP-1193 methods (e.g. JSON-RPC reads) on the wallet Postmate model.
- aaf43d4: Add `@1shotapi/ows-types` for shared OWS error classes and wire protocol types used across host, wallet, and signer SDKs.

### Patch Changes

- 55f9a22: Implement PRF-derived `encryptAES256` / `decryptAES256` in the Signing Layer: AES-256-GCM keyed via HKDF from the wallet secp256k1 scalar (same material as `signDigest`), `ows-aes1:` envelopes, batch + recovery-session paths.
- 8eeecf2: Add branded `HexString`, `Base64UrlEncodedString`, and `SdJwtVcPresentationString` primitives. Add branded public key primitives (`PasskeyPublicKey`, `SECP256K1PublicKey`, `ED25519PublicKey`) and apply them to signer protocol types and RPC parsing in `ows-signer-utils`.
