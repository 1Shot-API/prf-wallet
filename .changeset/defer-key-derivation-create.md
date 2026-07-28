---
"@1shotapi/ows-signer": patch
"@1shotapi/ows-signer-utils": patch
"@1shotapi/ows-types": patch
---

Add `createCredential` option `deferKeyDerivation` so Safari first-party registration can skip the PRF follow-up; `CredentialCreated.secp256k1PublicKey` is optional when deferred.
