---
"@1shotapi/ows-types": patch
"@1shotapi/ows-signer-utils": patch
---

Add branded `HexString`, `Base64UrlEncodedString`, and `SdJwtVcPresentationString` primitives. Add branded public key primitives (`PasskeyPublicKey`, `SECP256K1PublicKey`, `ED25519PublicKey`) and apply them to signer protocol types and RPC parsing in `ows-signer-utils`.
