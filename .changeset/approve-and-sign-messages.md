---
"@1shotapi/ows-signer-utils": patch
---

Branding owns personal_sign / typed-data consent **and** the Signing Layer ceremony (`approveAndSignPersonalMessage` / `approveAndSignTypedData`) so the consent view stays mounted under the signer panel. `SignHelper` is a thin EIP-1193 adapter only — `ensureReady` / `onAuthenticated` live in branding `approveAndSign*` wrappers, not on `SignHelperOptions`.
