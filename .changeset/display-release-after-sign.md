---
"@1shotapi/ows-signer-utils": patch
"@1shotapi/ows-wallet-utils": patch
---

Fix flyout retention after personal_sign / typed-data (including SIWE): run optional `onAuthenticated` after display release, and harden `DisplayChildClient.releaseSession` so stale display IDs still decrement the live session instead of silently no-oping.
