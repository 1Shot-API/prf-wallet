# Findings — Signing Layer audit 2026-10-23

Statuses reflect remediations landed with this audit pack.

---

## Fixed — `ows-signer:recovery-session-survives-clearSession`

| Field | Value |
|-------|--------|
| Audit verdict | confirmed |
| Overall severity | low (impact medium, likelihood low) |
| Status | **fixed** |

**Issue.** After `importPrivateKey` / `recoverKey`, `OWSSigner.clearSession()` cleared Branding caches and rejected pending RPCs but did not call `clearRecoverySession`. Signing kept the recovery scalar; later `signDigest` / AES used Confirm-less recovery paths.

**Remediation.** `clearSession()` is async and awaits `clearRecoverySession()`. Embedded wallet Change Account awaits `clearSession()`.

---

## Mitigated — `ows-signer/no-branding-identity-binding-any-embedder-full-rpc`

| Field | Value |
|-------|--------|
| Audit verdict | needs_validation |
| Status | **mitigated** |

**Issue.** Listener accepted any same-nesting parent without origin identity; `trustedParentOrigin` was stored but unused; Confirm UI showed only Branding-supplied copy. README advised omitting `frame-ancestors` for permissionless embeds. A hostile Branding on another origin could embed a shared signer host and drive signing after one Confirm click on attacker-written copy (without exfiltrating the key over RPC).

**Remediation.**

- Reject parent messages unless `event.origin === location.origin`; lock first trusted origin
- `OWSSigner.create` / `createSignerIframe` require same-origin signer URL
- Confirm panel shows requester origin
- CSP guidance and 1Shot wallet deploy: `frame-ancestors 'self'`

---

## Mitigated — `ows-signer/ui/reveal-key-clickjack-clipboard-no-visibility-guard`

| Field | Value |
|-------|--------|
| Audit verdict | needs_validation |
| Status | **mitigated** |

**Issue.** `revealPrivateKey` → `showPrivateKey` could display hex and clipboard-write on Copy without Page Visibility / focus checks, while the signer was intentionally frameable by arbitrary Brandings.

**Remediation.**

- Require `document.visibilityState === "visible"` and `document.hasFocus()` before showing the key UI; re-check before clipboard write
- Same-origin + `frame-ancestors 'self'` reduce foreign framing
