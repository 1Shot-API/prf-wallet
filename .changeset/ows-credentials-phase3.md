---
"@1shotapi/ows-types": minor
"@1shotapi/ows-wallet-utils": minor
"@1shotapi/ows-provider": patch
"@1shotapi/ows-signer-utils": minor
"@1shotapi/ows-signer": patch
---

Phase 3 credentials hardening: `ICredentialRepository`, `IIssuerTrustRegistry.isTrustedIssuer`, `CredentialsHelper`, host `acceptedIssuers` on present, fail-closed status checks, and stubbed `OWSSigner.encryptAES256` / `decryptAES256` with branded `AES256CipherText`.
