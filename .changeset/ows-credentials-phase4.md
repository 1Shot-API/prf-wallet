---
"@1shotapi/ows-types": minor
"@1shotapi/ows-oid4": minor
"@1shotapi/ows-wallet-utils": minor
---

Phase 4 credentials: optional `@1shotapi/ows-oid4` add-on (`CredentialsHelper`, HTTP OID4VCI/OID4VP clients). Holder bridge is `CredentialCryptoUtils.createOwsEd25519HolderSigner` in `ows-types`. Wire registrar/Zod schemas stay in `ows-wallet-utils`. `IOWSSigner` lives in `ows-types` (implemented by `OWSSigner`). Verifier/issuer HTTP demos own their server-side JWE helpers.
