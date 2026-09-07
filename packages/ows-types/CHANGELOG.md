# @1shotapi/ows-types

## 0.8.0

### Minor Changes

- 042beab: Bitcoin chain ids are now descriptive string sentinels (`"Bitcoin"`, `"BitcoinTestnet"`) instead of numeric `-1`/`-2`. Add `ChainUtils` for narrowing `OWSChainId` across EVM, Bitcoin, and Solana, plus `SolanaChainId` sentinels.

## 0.7.0

### Minor Changes

- 728eb8d: Add Bitcoin Native SegWit (P2WPKH) support:
  - `ows-types`: Replace `BitcoinAccountAddress` with `BitcoinSegwitAccountAddress`. Add `BitcoinSignatureHex`, `BitcoinTransactionHash`, `BitcoinChainId` (-1 mainnet, -2 testnet), `OWSChainId`, BIP-122 static wallet types, and dual-network Bitcoin cache methods on `IOWSSigner`.
  - `ows-signer-utils`: Add `BitcoinSigner` (`signer.bitcoin`), SegWit address derivation (`addressFromSecp256k1PublicKey`), BIP-143 transaction marshalling, and dual-network caching.
  - `ows-provider`: Add `BitcoinHostClient` (`proxy.bitcoin.getAccountAddresses`) conforming to Reown BIP-122 static-wallet pattern.
  - `ows-wallet-utils`: Add `validateBitcoinSegwitAddress` with strict bech32 SegWit v0 validation, and `BitcoinWalletRegistrar` (`wallet.bitcoin.register`).

## 0.6.0

### Minor Changes

- 4c9757f: Add `ConversionUtils.addressToBytes32Hex` to left-pad a 20-byte EVM address (`0x${string}`) to `bytes32` without duplicating pad helpers in consumers.

## 0.5.1

### Patch Changes

- 36fa253: Wire Branding→Host EIP-1193 notifications (`chainChanged`, `accountsChanged`) over Postmate so hosts stay in sync when the wallet changes chain or accounts.

## 0.5.0

### Minor Changes

- df9c4b7: Return full WebAuthn assertion fields (`authenticatorData`, `clientDataJSON`, `signature`, `credentialId`) from challenge-capable Signing Layer ceremonies as nested `assertion`, replacing `challengeSignature`.

## 0.4.0

### Minor Changes

- 09afc87: Add Branding→Host analytics wire (`ows:analytics`): `IOWSAnalyticsEvent` / abstract `OWSAnalyticsEvent` (branding subclasses) with index-signature extras, `OWSWallet.analytics.emit`, and `OWSProxy.analytics` EventEmitter.

## 0.3.1

### Patch Changes

- Add EVMContractAddress, DomainString, and UnixTimestamp branded primitives

  - EVMContractAddress: contract deployments vs account addresses (EIP-7715 factory / delegationManager)
  - DomainString: hostname without scheme or path (distinct from UriString)
  - UnixTimestamp: Unix time in seconds

## 0.3.0

### Minor Changes

- ee8dcf7: Add EIP-7715 execution-permission types and optional RpcHelper hooks

  ows-types exports PermissionRequest/Response shapes and the four draft method names on the EIP-1193 method table. RpcHelper registers those methods when branding passes `executionPermissions` callbacks; UI remains app-owned.

## 0.2.4

### Patch Changes

- 2f6bb67: Host-owned wallet sizing: flyout vs full-screen drawer, no branding size requests.

  `requestDisplay` is a show session only (no width/height). On small viewports the host panel opens as a full-screen drawer with a bottom wipe; larger viewports keep the lower-right flyout at `walletSizeX`/`walletSizeY`.

## 0.2.3

### Patch Changes

- c8fd466: Add `createCredential` option `deferKeyDerivation` so Safari first-party registration can skip the PRF follow-up; `CredentialCreated.secp256k1PublicKey` is optional when deferred.

## 0.2.2

### Patch Changes

- 09d93bb: Add `importPrivateKey` — paste a hex secp256k1 key in the Signing Layer to start a recovery session.

## 0.2.1

### Patch Changes

- 08133a8: revealPrivateKey keeps the ceremony panel open until the user dismisses the key UI (PrivateKeyRevealed).

## 0.2.0

### Minor Changes

- ae79e0f: Batch digest signing and `executeBatch` mixed ceremony so one passkey covers many signs/AES/auth ops; signing APIs are array-only (breaking).
- a39b7b2: Signing Layer passkey Confirm/Cancel UI (ceremony params + `SignDenied` / `OwsSignDeniedError`) and visible ceremony panel; remove invisible 1×1 WebAuthn prep and fold `credentialId` into options bags.

## 0.1.3

### Patch Changes

- 498d823: Add EChainTechnology and RelayerTransactionId; move IBlockchainProvider and AddressUtils (ENS-aware) into ows-wallet-utils with viem as a peer dependency.

## 0.1.2

### Patch Changes

- Add typed eth_sendTransaction support: branded transaction hash, RpcHelper active-chain request/broadcast helpers, and SignHelper prepare → sign → broadcast with transaction consent.

## 0.1.1

### Patch Changes

- afc99f3: Replace PasskeyPublicKey with branded COSEPublicKey / SPKIPublicKey. Signing Layer emits COSE (`cosePublicKey`) from attestation authenticator data; add COSEToSPKIPublicKey in ows-signer-utils for Web Crypto consumers.

## 0.1.0

### Minor Changes

- 0e1b1d1: Move SD-JWT VC presentation and crypto utilities from `ows-wallet-utils` into `ows-types` (`utils/credentials/`). Drop `ows-provider`'s dependency on `ows-wallet-utils`; host apps use `@1shotapi/ows-types` for presentation helpers and `@1shotapi/ows-provider` for verify/proxy only.

  **Breaking:** `buildSdJwtVcPresentation`, `extractHolderJwkFromSdJwtVc`, and crypto helpers are no longer exported from `@1shotapi/ows-wallet-utils` or re-exported from `@1shotapi/ows-provider`. Use `PresentationUtils` / `CredentialCryptoUtils` from `@1shotapi/ows-types`. `CredentialCryptoUtils.createOwsEd25519HolderSigner` lives on `@1shotapi/ows-types`.

- aaf43d4: Add `OWSWallet.requestDisplay()` / `requestHide()` so the branding iframe can ask the host to show or hide a lower-right wallet flyout (opaque panel, no modal backdrop) before WebAuthn or approval UI in cross-origin embeds. Host-side `OWSProxy` handles `ows:requestDisplay`, `ows:requestHide`, and `ows:releaseDisplay`.
- e83e5ce: Fold verifiable credentials into core OWS packages: types and OID4 interfaces in `ows-types`, branding wire and SD-JWT presentation in `ows-wallet-utils`, host proxy and SD-JWT verify in `ows-provider`. Demo mocks live under `examples/shared` (not published). Removes `@1shotapi/ows-credentials`.
- 3c8b506: Add OID4VCI holder proof-of-possession via `ProofUtils` (`buildOid4vciProofJwt` / `verifyOid4vciProofJwt`, branded `JWKThumbprint`) and require proof in issuance context. Enforce `kb+jwt` audience during SD-JWT VC presentation verify.
- 89e40a9: Phase 3 credentials hardening: `ICredentialRepository`, `IIssuerTrustRegistry.isTrustedIssuer`, `CredentialsHelper`, host `acceptedIssuers` on present, fail-closed status checks, and stubbed `OWSSigner.encryptAES256` / `decryptAES256` with branded `AES256CipherText`.
- a78bba8: Phase 4 credentials: optional `@1shotapi/ows-oid4` add-on (`CredentialsHelper`, HTTP OID4VCI/OID4VP clients). Holder bridge is `CredentialCryptoUtils.createOwsEd25519HolderSigner` in `ows-types`. Wire registrar/Zod schemas stay in `ows-wallet-utils`. `IOWSSigner` lives in `ows-types` (implemented by `OWSSigner`). Verifier/issuer HTTP demos own their server-side JWE helpers.
- 9a87faf: Move shared EIP-1193 method lists and typed request tables into `@1shotapi/ows-types`. Add `RpcHelper` in `ows-wallet-utils` to register JSON-RPC read methods and chain switching on `OWSWallet` (replaces the registry rpc-provider module for branding apps).
- eae834a: Add `EVMChainId` and allow branding modules to register additional EIP-1193 methods (e.g. JSON-RPC reads) on the wallet Postmate model.
- aaf43d4: Add `@1shotapi/ows-types` for shared OWS error classes and wire protocol types used across host, wallet, and signer SDKs.

### Patch Changes

- 55f9a22: Implement PRF-derived `encryptAES256` / `decryptAES256` in the Signing Layer: AES-256-GCM keyed via HKDF from the wallet secp256k1 scalar (same material as `signDigest`), `ows-aes1:` envelopes, batch + recovery-session paths.
- 8eeecf2: Add branded `HexString`, `Base64UrlEncodedString`, and `SdJwtVcPresentationString` primitives. Add branded public key primitives (`PasskeyPublicKey`, `SECP256K1PublicKey`, `ED25519PublicKey`) and apply them to signer protocol types and RPC parsing in `ows-signer-utils`.
