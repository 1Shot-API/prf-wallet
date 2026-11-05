---
"@1shotapi/ows-signer": patch
---

Allow private-key reveal after the passkey sheet blurs the signer iframe. `showPrivateKey` still requires a visible document, and still requires focus unless the Confirm or passphrase click in that ceremony happened while the signer was visible and focused. Copy still checks focus at the click and does not reuse that snapshot.
