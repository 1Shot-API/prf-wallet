---
"@1shotapi/ows-oid4": patch
---

Call ensureReady before acceptOffer display and before present match when the local credential cache is empty, so locked / first-visit wallets unlock before OID4 consent.
