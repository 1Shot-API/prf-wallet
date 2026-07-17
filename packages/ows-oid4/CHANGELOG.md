# @1shotapi/ows-oid4

## 0.1.1

### Patch Changes

- fd48ab0: Call ensureReady before acceptOffer display and before present match when the local credential cache is empty, so locked / first-visit wallets unlock before OID4 consent.
- Updated dependencies
  - @1shotapi/ows-types@0.1.2

## 0.1.0

### Minor Changes

- a78bba8: Phase 4 credentials: optional `@1shotapi/ows-oid4` add-on (`CredentialsHelper`, HTTP OID4VCI/OID4VP clients). Holder bridge is `CredentialCryptoUtils.createOwsEd25519HolderSigner` in `ows-types`. Wire registrar/Zod schemas stay in `ows-wallet-utils`. `IOWSSigner` lives in `ows-types` (implemented by `OWSSigner`). Verifier/issuer HTTP demos own their server-side JWE helpers.

### Patch Changes

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
