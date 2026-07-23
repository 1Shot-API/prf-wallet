# @1shotapi/ows-signer-utils

## 0.2.1

### Patch Changes

- ca64262: Fix recoverable ECDSA `v` for on-chain ecrecover (`27`/`28` instead of yParity `0`/`1`), which caused MetaMask Delegation / OpenZeppelin `ECDSAInvalidSignature()` on relayer estimate. Canonicalize message and typed-data signatures in `EvmSigner`. Prefer optional display `release()` over `hide()` in `SignHelper` so nested host RPC flyouts stay visible. Prefer cached address / public key in `toViemLocalAccount` to avoid an extra WebAuthn ceremony when warming a viem account.

## 0.2.0

### Minor Changes

- 498d823: Replace SignHelper `requestSendTransactionApproval` with branding-owned `approveAndSignTransaction`; export `prepareEvmTransaction`. Allow `camera` on the branding iframe for optional QR address scan.

### Patch Changes

- Updated dependencies [498d823]
  - @1shotapi/ows-types@0.1.3

## 0.1.2

### Patch Changes

- Add typed eth_sendTransaction support: branded transaction hash, RpcHelper active-chain request/broadcast helpers, and SignHelper prepare → sign → broadcast with transaction consent.
- Updated dependencies
  - @1shotapi/ows-types@0.1.2

## 0.1.1

### Patch Changes

- afc99f3: Replace PasskeyPublicKey with branded COSEPublicKey / SPKIPublicKey. Signing Layer emits COSE (`cosePublicKey`) from attestation authenticator data; add COSEToSPKIPublicKey in ows-signer-utils for Web Crypto consumers.
- Updated dependencies [afc99f3]
  - @1shotapi/ows-types@0.1.1

## 0.1.0

### Minor Changes

- 89e40a9: Phase 3 credentials hardening: `ICredentialRepository`, `IIssuerTrustRegistry.isTrustedIssuer`, `CredentialsHelper`, host `acceptedIssuers` on present, fail-closed status checks, and stubbed `OWSSigner.encryptAES256` / `decryptAES256` with branded `AES256CipherText`.
- b9831dd: Add `SignHelper` for headless EIP-1193 `personal_sign` / typed-data wiring (display → consent → ensureReady → sign). Branding apps supply consent UI and register the returned handlers on `OWSWallet`.
- 55501c4: Add `overlaySignerIframe` to visually place the Signing Layer iframe over a dialog slot without reparenting (avoids reload / dropped RPCs). Share inline-style capture/restore with `prepareSignerIframeForWebAuthn`.
- a803f5a: Implement OWSSigner SDK with RPC client, EVM signing namespace, and viem LocalAccount adapter. Emit RecoverySessionStarted from ows-signer after recoverKey success. Adopt `@1shotapi/ows-types` for shared signer protocol types and errors.

### Patch Changes

- 55f9a22: Implement PRF-derived `encryptAES256` / `decryptAES256` in the Signing Layer: AES-256-GCM keyed via HKDF from the wallet secp256k1 scalar (same material as `signDigest`), `ows-aes1:` envelopes, batch + recovery-session paths.
- 8eeecf2: Add branded `HexString`, `Base64UrlEncodedString`, and `SdJwtVcPresentationString` primitives. Add branded public key primitives (`PasskeyPublicKey`, `SECP256K1PublicKey`, `ED25519PublicKey`) and apply them to signer protocol types and RPC parsing in `ows-signer-utils`.
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
