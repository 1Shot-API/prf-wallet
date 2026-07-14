# OWS Branding Layer architecture notes

## Three layers

| Layer | Runs where | Trust / UX |
|-------|------------|------------|
| Host | Integrator dapp | EIP-1193; must be secure context if it embeds HTTPS wallet |
| Branding | Wallet origin (your product) | Branding, consent, app-owned UI + SDK helpers |
| Signing | Nested iframe (often same origin as branding) | Passkeys / PRF; minimal attack surface |

## Origins and `rpId`

- Signing Layer `rpId` is always `window.location.hostname` of the signer document.
- Prefer **same origin** for branding + signer (shared passkey namespace).
- Canonical CDN / on-chain gateway is an alternative shared `rpId` for all integrators.

## Secure contexts

Browsers require the **entire iframe ancestor chain** to be secure for WebAuthn. Therefore:

- Production hosts: HTTPS
- Local custom hosts (`ows-host.com`): HTTPS via mkcert (see `examples/host` in open-wallet)
- `http://localhost` remains a special-case secure context

## Display protocol

Branding calls `OWSWallet.requestDisplay` → host `OWSProxy` shows a lower-right opaque flyout → branding runs WebAuthn/approval → `requestHide` / `releaseDisplay`.

## Integrity (future)

Signed-manifest / verify-before-execute for `ows-signer` is planned (see `packages/ows-signer/docs/trusted-loader-plan.md`). Not required for a first branding scaffold.

## Reference demo

`examples/general-wallet` + `examples/host` in the open-wallet monorepo demonstrate the full Host → Branding → Signing path with ngrok HTTPS for passkeys.
