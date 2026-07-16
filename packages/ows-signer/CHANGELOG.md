# @1shotapi/ows-signer

## 0.2.1

### Patch Changes

- afc99f3: Replace PasskeyPublicKey with branded COSEPublicKey / SPKIPublicKey. Signing Layer emits COSE (`cosePublicKey`) from attestation authenticator data; add COSEToSPKIPublicKey in ows-signer-utils for Web Crypto consumers.

## 0.2.0

### Minor Changes

- 55f9a22: Implement PRF-derived `encryptAES256` / `decryptAES256` in the Signing Layer: AES-256-GCM keyed via HKDF from the wallet secp256k1 scalar (same material as `signDigest`), `ows-aes1:` envelopes, batch + recovery-session paths.

### Patch Changes

- 89e40a9: Phase 3 credentials hardening: `ICredentialRepository`, `IIssuerTrustRegistry.isTrustedIssuer`, `CredentialsHelper`, host `acceptedIssuers` on present, fail-closed status checks, and stubbed `OWSSigner.encryptAES256` / `decryptAES256` with branded `AES256CipherText`.
- a803f5a: Implement OWSSigner SDK with RPC client, EVM signing namespace, and viem LocalAccount adapter. Emit RecoverySessionStarted from ows-signer after recoverKey success. Adopt `@1shotapi/ows-types` for shared signer protocol types and errors.
