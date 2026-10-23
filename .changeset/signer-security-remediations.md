---
"@1shotapi/ows-signer": patch
"@1shotapi/ows-signer-utils": minor
---

Security remediations from the Signing Layer audit: require same-origin Branding↔Signing (parent origin gate, `createSignerIframe` check, CSP `frame-ancestors 'self'`), show requester origin on Confirm, make `clearSession()` clear the recovery session, and gate reveal/clipboard on document visibility and focus. Publish curated AI-assisted audit notes under `ows-signer/audits/2026-10-23-signing-layer/`.
