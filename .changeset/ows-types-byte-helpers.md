---
"@1shotapi/ows-types": minor
"@1shotapi/ows-signer-utils": minor
"@1shotapi/ows-wallet-utils": minor
---

ows-types: add `UnprefixedHexString` and `SECP256K1CompressedPublicKey` primitives; add Bitcoin address primitives `BitcoinTaprootAccountAddress` (P2TR), `BitcoinSegwitScriptAddress` (P2WSH), `BitcoinLegacyAccountAddress` (P2PKH), and `BitcoinScriptHashAddress` (P2SH), plus `BitcoinAddress` as the union of these and `BitcoinSegwitAccountAddress`; add `BitcoinAddressUtils` decoding helpers; add `ConversionUtils.bytesToUnprefixedHex`, `unprefixedHexToBytes`, `concatBytes`, and `bytesEqual`. `IBitcoinGetAccountAddressesParams.account` is now a `BitcoinAddress`. `BitcoinSegwitAccountAddressSchema` now rejects mixed-case bech32 per BIP-173.

ows-signer-utils: `compressSecp256k1PublicKey` returns a branded `SECP256K1CompressedPublicKey` and accepts only `SECP256K1PublicKey`; `addressFromSecp256k1PublicKey` and `prepareBitcoinTransaction` no longer accept raw `Uint8Array` keys.

ows-wallet-utils: `getAccountAddresses` validates `account` with `BitcoinAddressSchema`.
