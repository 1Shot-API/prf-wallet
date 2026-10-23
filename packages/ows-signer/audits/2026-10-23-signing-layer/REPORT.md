# Security audit report — Signing Layer (2026-10-23)

## Run metadata

| Field | Value |
|-------|--------|
| Profile | `deep` (scoped) |
| Scope | Signing Layer + Branding↔Signing protocol |
| Out of scope | Host Layer, OID4, on-chain deploy, Host↔Branding Postmate |
| Source ref (audit baseline) | `1aa132220ab27a85b88b64b0d6371c197908e317` (`feature/SecurityAudit`) |
| Method | AI-assisted (Cursor security-audit skill); source-validated |
| Execution notes | Source-only on Windows host; CSP/WebAuthn runtime facts marked needs-validation where unproven |

This is a **partial** pass: Signing Layer only. It does not claim coverage of the full wallet stack.

## Security posture (at audit time)

Nesting gates (`event.source === window.parent`, `parent !== top`) and crypto paths (PRF→HKDF, AES-GCM, recovery envelopes) were coherent. Ceremony Confirm + userVerification paths looked intentional. Ceremony copy is sanitized via `textContent` with length caps; private keys are not sent plaintext over `postMessage`.

**Concrete defect (confirmed):** `OWSSigner.clearSession()` cleared Branding-side caches but did not end the Signing recovery session, so post–Change Account signing could use a cached scalar without Confirm/WebAuthn.

**Product/threat leads (needs_validation at audit time):** permissionless cross-origin Branding embeds of a shared signer host (Confirm never showed requester origin); reveal/clipboard without visibility/focus framing guards.

## Findings summary

| Severity / class | Title | Post-remediation |
|------------------|-------|------------------|
| confirmed / low | Recovery scalar survives `clearSession` | Fixed |
| needs_validation | Any Branding origin full RPC; Confirm hid origin | Mitigated (same-origin + CSP + origin UI) |
| needs_validation | Reveal-key clickjack / clipboard | Mitigated (visibility+focus + CSP) |

## Positive patterns

- Double-iframe nesting required before listener registration
- Branding inbound RPC checks both `origin` and `iframe.contentWindow`
- Recovery session documented; `executeBatch` with `challenge` forces WebAuthn even under recovery
- Ceremony copy sanitized via `textContent` with length caps
- Private keys not sent plaintext over `postMessage`

## Product decision after audit

Cross-origin “permissionless CDN/IPFS signer” embeds are **retired**. Branding and Signing must share the same origin (e.g. `wallet.1shotapi.com` + `/signer/`). Hostile Brandings must not frame a foreign user’s signer hostname.

## Rejected candidates

Not published as vulnerabilities: Branding-controlled passphrase minimum length; passphrase/import prompts surviving `cancel` (same-principal hygiene); recoverKey rebind deny leaving recovery session (same capability as default recover); unbound signer bytes / deploy-only CSP guidance (operator trust root / trusted-loader roadmap).
