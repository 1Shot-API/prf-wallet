# @1shotapi/ows-signer-utils

## 0.6.2

### Patch Changes

- 042beab: Bitcoin chain ids are now descriptive string sentinels (`"Bitcoin"`, `"BitcoinTestnet"`) instead of numeric `-1`/`-2`. Add `ChainUtils` for narrowing `OWSChainId` across EVM, Bitcoin, and Solana, plus `SolanaChainId` sentinels.
- Updated dependencies [042beab]
  - @1shotapi/ows-types@0.8.0

## 0.6.0

### Minor Changes

- 728eb8d: Add Bitcoin Native SegWit (P2WPKH) support:
  - `ows-types`: Replace `BitcoinAccountAddress` with `BitcoinSegwitAccountAddress`. Add `BitcoinSignatureHex`, `BitcoinTransactionHash`, `BitcoinChainId` (-1 mainnet, -2 testnet), `OWSChainId`, BIP-122 static wallet types, and dual-network Bitcoin cache methods on `IOWSSigner`.
  - `ows-signer-utils`: Add `BitcoinSigner` (`signer.bitcoin`), SegWit address derivation (`addressFromSecp256k1PublicKey`), BIP-143 transaction marshalling, and dual-network caching.
  - `ows-provider`: Add `BitcoinHostClient` (`proxy.bitcoin.getAccountAddresses`) conforming to Reown BIP-122 static-wallet pattern.
  - `ows-wallet-utils`: Add `validateBitcoinSegwitAddress` with strict bech32 SegWit v0 validation, and `BitcoinWalletRegistrar` (`wallet.bitcoin.register`).

### Patch Changes

- Updated dependencies [728eb8d]
  - @1shotapi/ows-types@0.7.0

## 0.5.1

### Patch Changes

- Clear stuck passkey ceremonies after timeout so a retry can start, and include RS256 alongside ES256 in WebAuthn create params.

  `ows-signer` now steals a hung ceremony lock, aborts in-flight `credentials.get/create`, and treats cancel/Abort as SignDenied. `ows-signer-utils` posts cancel before each new signer RPC so branding retries do not hit “already pending.”

## 0.5.0

### Minor Changes

- df9c4b7: Return full WebAuthn assertion fields (`authenticatorData`, `clientDataJSON`, `signature`, `credentialId`) from challenge-capable Signing Layer ceremonies as nested `assertion`, replacing `challengeSignature`.

### Patch Changes

- Updated dependencies [df9c4b7]
  - @1shotapi/ows-types@0.5.0

## 0.4.0

### Minor Changes

- 2f6bb67: Host-owned wallet sizing: flyout vs full-screen drawer, no branding size requests.

  `requestDisplay` is a show session only (no width/height). On small viewports the host panel opens as a full-screen drawer with a bottom wipe; larger viewports keep the lower-right flyout at `walletSizeX`/`walletSizeY`.

### Patch Changes

- Updated dependencies [2f6bb67]
  - @1shotapi/ows-types@0.2.4

## 0.3.5

### Patch Changes

- c8fd466: Add `createCredential` option `deferKeyDerivation` so Safari first-party registration can skip the PRF follow-up; `CredentialCreated.secp256k1PublicKey` is optional when deferred.
- Updated dependencies [c8fd466]
  - @1shotapi/ows-types@0.2.3

## 0.3.4

### Patch Changes

- eafc2c5: Add `OWSSigner.clearSession()` so branding can drop the in-memory credential id and address cache when switching accounts.

## 0.3.3

### Patch Changes

- 9d0836e: Branding owns personal_sign / typed-data consent **and** the Signing Layer ceremony (`approveAndSignPersonalMessage` / `approveAndSignTypedData`) so the consent view stays mounted under the signer panel. `SignHelper` is a thin EIP-1193 adapter only — `ensureReady` / `onAuthenticated` live in branding `approveAndSign*` wrappers, not on `SignHelperOptions`.

## 0.3.2

### Patch Changes

- 09d93bb: Add `importPrivateKey` — paste a hex secp256k1 key in the Signing Layer to start a recovery session.
- Updated dependencies [09d93bb]
  - @1shotapi/ows-types@0.2.2

## 0.3.1

### Patch Changes

- 08133a8: revealPrivateKey keeps the ceremony panel open until the user dismisses the key UI (PrivateKeyRevealed).
- Updated dependencies [08133a8]
  - @1shotapi/ows-types@0.2.1

## 0.3.0

### Minor Changes

- ae79e0f: Batch digest signing and `executeBatch` mixed ceremony so one passkey covers many signs/AES/auth ops; signing APIs are array-only (breaking).
- a39b7b2: Signing Layer passkey Confirm/Cancel UI (ceremony params + `SignDenied` / `OwsSignDeniedError`) and visible ceremony panel; remove invisible 1×1 WebAuthn prep and fold `credentialId` into options bags.

### Patch Changes

- Updated dependencies [ae79e0f]
- Updated dependencies [a39b7b2]
  - @1shotapi/ows-types@0.2.0

## 0.2.2

### Patch Changes

- 6856913: Always return `yParity` from `signedAuthorizationFromSignature`. After recoverable ECDSA started emitting `v` 27/28, the previous branch returned only `v`, so relayer auth payloads sent `yParity: null` ("Invalid authorization list entry").

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
