---
"@1shotapi/ows-types": minor
"@1shotapi/ows-provider": minor
"@1shotapi/ows-wallet-utils": minor
---

Move SD-JWT VC presentation and crypto utilities from `ows-wallet-utils` into `ows-types` (`utils/credentials/`). Drop `ows-provider`'s dependency on `ows-wallet-utils`; host apps use `@1shotapi/ows-types` for presentation helpers and `@1shotapi/ows-provider` for verify/proxy only.

**Breaking:** `buildSdJwtVcPresentation`, `extractHolderJwkFromSdJwtVc`, and crypto helpers are no longer exported from `@1shotapi/ows-wallet-utils` or re-exported from `@1shotapi/ows-provider`. Use `PresentationUtils` / `CredentialCryptoUtils` from `@1shotapi/ows-types`. `CredentialCryptoUtils.createOwsEd25519HolderSigner` lives on `@1shotapi/ows-types`.
