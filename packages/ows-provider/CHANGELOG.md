# @1shotapi/ows-provider

## 0.3.1

### Patch Changes

- 28dc576: Use width-only viewport checks for flyout vs drawer so short desktop windows keep the corner flyout.

## 0.3.0

### Minor Changes

- 2f6bb67: Host-owned wallet sizing: flyout vs full-screen drawer, no branding size requests.

  `requestDisplay` is a show session only (no width/height). On small viewports the host panel opens as a full-screen drawer with a bottom wipe; larger viewports keep the lower-right flyout at `walletSizeX`/`walletSizeY`.

### Patch Changes

- Updated dependencies [2f6bb67]
  - @1shotapi/ows-types@0.2.4

## 0.2.1

### Patch Changes

- 498d823: Replace SignHelper `requestSendTransactionApproval` with branding-owned `approveAndSignTransaction`; export `prepareEvmTransaction`. Allow `camera` on the branding iframe for optional QR address scan.
- Updated dependencies [498d823]
  - @1shotapi/ows-types@0.1.3

## 0.2.0

### Minor Changes

- 58ef5d1: Add create-time `presentationMode` (`flyout` | `inline`) for branding iframe chrome. Presentation is immutable — recreate the proxy to switch (no reparent/`setPresentation`; that breaks Postmate). Default visible size is 360×600.

## 0.1.0

### Minor Changes

- 0e1b1d1: Move SD-JWT VC presentation and crypto utilities from `ows-wallet-utils` into `ows-types` (`utils/credentials/`). Drop `ows-provider`'s dependency on `ows-wallet-utils`; host apps use `@1shotapi/ows-types` for presentation helpers and `@1shotapi/ows-provider` for verify/proxy only.

  **Breaking:** `buildSdJwtVcPresentation`, `extractHolderJwkFromSdJwtVc`, and crypto helpers are no longer exported from `@1shotapi/ows-wallet-utils` or re-exported from `@1shotapi/ows-provider`. Use `PresentationUtils` / `CredentialCryptoUtils` from `@1shotapi/ows-types`. `CredentialCryptoUtils.createOwsEd25519HolderSigner` lives on `@1shotapi/ows-types`.

- aaf43d4: Add `OWSWallet.requestDisplay()` / `requestHide()` so the branding iframe can ask the host to show or hide a lower-right wallet flyout (opaque panel, no modal backdrop) before WebAuthn or approval UI in cross-origin embeds. Host-side `OWSProxy` handles `ows:requestDisplay`, `ows:requestHide`, and `ows:releaseDisplay`.
- e83e5ce: Fold verifiable credentials into core OWS packages: types and OID4 interfaces in `ows-types`, branding wire and SD-JWT presentation in `ows-wallet-utils`, host proxy and SD-JWT verify in `ows-provider`. Demo mocks live under `examples/shared` (not published). Removes `@1shotapi/ows-credentials`.

### Patch Changes

- 3c8b506: Add OID4VCI holder proof-of-possession via `ProofUtils` (`buildOid4vciProofJwt` / `verifyOid4vciProofJwt`, branded `JWKThumbprint`) and require proof in issuance context. Enforce `kb+jwt` audience during SD-JWT VC presentation verify.
- 89e40a9: Phase 3 credentials hardening: `ICredentialRepository`, `IIssuerTrustRegistry.isTrustedIssuer`, `CredentialsHelper`, host `acceptedIssuers` on present, fail-closed status checks, and stubbed `OWSSigner.encryptAES256` / `decryptAES256` with branded `AES256CipherText`.
- 9a87faf: Move shared EIP-1193 method lists and typed request tables into `@1shotapi/ows-types`. Add `RpcHelper` in `ows-wallet-utils` to register JSON-RPC read methods and chain switching on `OWSWallet` (replaces the registry rpc-provider module for branding apps).
- eae834a: Add `EVMChainId` and allow branding modules to register additional EIP-1193 methods (e.g. JSON-RPC reads) on the wallet Postmate model.
- Updated dependencies [0e1b1d1]
- Updated dependencies [aaf43d4]
- Updated dependencies [e83e5ce]
- Updated dependencies [3c8b506]
- Updated dependencies [89e40a9]
- Updated dependencies [a78bba8]
- Updated dependencies [9a87faf]
- Updated dependencies [eae834a]
- Updated dependencies [55f9a22]
- Updated dependencies [aaf43d4]
- Updated dependencies [8eeecf2]
  - @1shotapi/ows-types@0.1.0
