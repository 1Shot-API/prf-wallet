---
"@1shotapi/ows-types": patch
"@1shotapi/ows-provider": minor
"@1shotapi/ows-wallet-utils": minor
"@1shotapi/ows-signer-utils": minor
"@1shotapi/ows-oid4": minor
---

Host-owned wallet sizing: flyout vs full-screen drawer, no branding size requests.

`requestDisplay` is a show session only (no width/height). On small viewports the host panel opens as a full-screen drawer with a bottom wipe; larger viewports keep the lower-right flyout at `walletSizeX`/`walletSizeY`.
