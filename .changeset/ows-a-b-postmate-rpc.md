---
"@1shotapi/ows-wallet-utils": minor
"@1shotapi/ows-provider": minor
"@1shotapi/ows-types": minor
---

Add `OWSWallet.requestDisplay()` / `requestHide()` so the branding iframe can ask the host to show or hide a lower-right wallet flyout (opaque panel, no modal backdrop) before WebAuthn or approval UI in cross-origin embeds. Host-side `OWSProxy` handles `ows:requestDisplay`, `ows:requestHide`, and `ows:releaseDisplay`.
