---
"@1shotapi/ows-types": minor
"@1shotapi/ows-signer-utils": minor
"@1shotapi/ows-provider": minor
"@1shotapi/ows-wallet-utils": minor
---

Add Bitcoin Native SegWit (P2WPKH) support:
- `ows-types`: Replace `BitcoinAccountAddress` with `BitcoinSegwitAccountAddress`. Add `BitcoinSignatureHex`, `BitcoinTransactionHash`, `BitcoinChainId` (-1 mainnet, -2 testnet), `OWSChainId`, BIP-122 static wallet types, and dual-network Bitcoin cache methods on `IOWSSigner`.
- `ows-signer-utils`: Add `BitcoinSigner` (`signer.bitcoin`), SegWit address derivation (`addressFromSecp256k1PublicKey`), BIP-143 transaction marshalling, and dual-network caching.
- `ows-provider`: Add `BitcoinHostClient` (`proxy.bitcoin.getAccountAddresses`) conforming to Reown BIP-122 static-wallet pattern.
- `ows-wallet-utils`: Add `validateBitcoinSegwitAddress` with strict bech32 SegWit v0 validation, and `BitcoinWalletRegistrar` (`wallet.bitcoin.register`).
