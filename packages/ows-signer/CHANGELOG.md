# @1shotapi/ows-signer

## 0.4.1

### Patch Changes

- Clear stuck passkey ceremonies after timeout so a retry can start, and include RS256 alongside ES256 in WebAuthn create params.

  `ows-signer` now steals a hung ceremony lock, aborts in-flight `credentials.get/create`, and treats cancel/Abort as SignDenied. `ows-signer-utils` posts cancel before each new signer RPC so branding retries do not hit “already pending.”

## 0.4.0

### Minor Changes

- df9c4b7: Return full WebAuthn assertion fields (`authenticatorData`, `clientDataJSON`, `signature`, `credentialId`) from challenge-capable Signing Layer ceremonies as nested `assertion`, replacing `challengeSignature`.

## 0.3.4

### Patch Changes

- c8fd466: Add `createCredential` option `deferKeyDerivation` so Safari first-party registration can skip the PRF follow-up; `CredentialCreated.secp256k1PublicKey` is optional when deferred.

## 0.3.3

### Patch Changes

- ce5535c: Keep the create-passkey Confirm panel visible through the PRF follow-up assertion, and update its copy so the second WebAuthn prompt explains why it is requested.

## 0.3.2

### Patch Changes

- 09d93bb: Add `importPrivateKey` — paste a hex secp256k1 key in the Signing Layer to start a recovery session.

## 0.3.1

### Patch Changes

- 08133a8: revealPrivateKey keeps the ceremony panel open until the user dismisses the key UI (PrivateKeyRevealed).

## 0.3.0

### Minor Changes

- ae79e0f: Batch digest signing and `executeBatch` mixed ceremony so one passkey covers many signs/AES/auth ops; signing APIs are array-only (breaking).
- a39b7b2: Signing Layer passkey Confirm/Cancel UI (ceremony params + `SignDenied` / `OwsSignDeniedError`) and visible ceremony panel; remove invisible 1×1 WebAuthn prep and fold `credentialId` into options bags.

## 0.2.2

### Patch Changes

- ca64262: Fix recoverable ECDSA `v` for on-chain ecrecover (`27`/`28` instead of yParity `0`/`1`), which caused MetaMask Delegation / OpenZeppelin `ECDSAInvalidSignature()` on relayer estimate. Canonicalize message and typed-data signatures in `EvmSigner`. Prefer optional display `release()` over `hide()` in `SignHelper` so nested host RPC flyouts stay visible. Prefer cached address / public key in `toViemLocalAccount` to avoid an extra WebAuthn ceremony when warming a viem account.

## 0.2.1

### Patch Changes

- afc99f3: Replace PasskeyPublicKey with branded COSEPublicKey / SPKIPublicKey. Signing Layer emits COSE (`cosePublicKey`) from attestation authenticator data; add COSEToSPKIPublicKey in ows-signer-utils for Web Crypto consumers.

## 0.2.0

### Minor Changes

- 55f9a22: Implement PRF-derived `encryptAES256` / `decryptAES256` in the Signing Layer: AES-256-GCM keyed via HKDF from the wallet secp256k1 scalar (same material as `signDigest`), `ows-aes1:` envelopes, batch + recovery-session paths.

### Patch Changes

- 89e40a9: Phase 3 credentials hardening: `ICredentialRepository`, `IIssuerTrustRegistry.isTrustedIssuer`, `CredentialsHelper`, host `acceptedIssuers` on present, fail-closed status checks, and stubbed `OWSSigner.encryptAES256` / `decryptAES256` with branded `AES256CipherText`.
- a803f5a: Implement OWSSigner SDK with RPC client, EVM signing namespace, and viem LocalAccount adapter. Emit RecoverySessionStarted from ows-signer after recoverKey success. Adopt `@1shotapi/ows-types` for shared signer protocol types and errors.
