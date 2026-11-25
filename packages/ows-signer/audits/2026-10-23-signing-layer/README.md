# Signing Layer security review — 2026-10-23

| Field | Value |
|-------|--------|
| Package | `@1shotapi/ows-signer` (+ Branding helpers in `@1shotapi/ows-signer-utils`) |
| Date | 2026-10-23 |
| Profile | Deep, **scoped** (Signing Layer + Branding↔Signing protocol only) |
| Method | AI-assisted review via the Cursor **security-audit** skill (multi-agent recon, hunt, validate, verify) |
| Human review | Not a traditional human pen-test firm engagement |
| Source under review | Open Wallet monorepo (`prf-wallet`), Signing packages as of the audit run |

## Disclosure

This review was **performed by AI agents** guided by a structured security-audit workflow (architecture recon, parallel hunters, independent verifiers, coverage critics). Findings were validated against source. It is **not** a substitute for a dedicated human security assessment, formal certification, or bug-bounty coverage of the full wallet stack.

Runtime behaviours that depend on browsers, CSP headers, or WebAuthn UX were recorded as needs-validation where source alone could not prove exploitability; product remediations for those items are listed below and in sibling files.

## Scope

**In scope**

- `packages/ows-signer` (Signing Layer: `postMessage`, WebAuthn/PRF, recovery, UI)
- `packages/ows-signer-utils` (Branding↔Signing RPC / `OWSSigner`)
- Related signing types in `packages/ows-types`

**Out of scope**

- Host Layer (`ows-provider`), Host↔Branding Postmate (`ows-wallet-utils`)
- OID4 credentials, on-chain deploy pipeline, example apps as production targets

## Tooling

- Cursor Agent + security-audit skill (phased recon → hunt → validate → report)
- Source-only verification on Windows (no OS-enforced sandbox / artifact promotion in that environment)
- Schema-validated findings export from the audit run (curated here; raw agent scratch not published)

## Outcomes (after remediations in this change set)

| Fingerprint | Audit verdict | Remediation status |
|-------------|---------------|--------------------|
| `ows-signer:recovery-session-survives-clearSession` | confirmed (low) | **Fixed** — `clearSession()` clears recovery |
| `ows-signer/no-branding-identity-binding-any-embedder-full-rpc` | needs_validation | **Mitigated** — same-origin Branding↔Signing + `frame-ancestors 'self'` + Confirm shows requester |
| `ows-signer/ui/reveal-key-clickjack-clipboard-no-visibility-guard` | needs_validation | **Mitigated** — visibility+focus gates; CSP framing |

Rejected candidates (not treated as vulnerabilities): passphrase min-length (by design), cancel-surviving non-Confirm prompts (hygiene), recoverKey rebind fail-open (no extra capability), unbound signer bytes / deploy CSP (roadmap / operator trust root).

## Documents in this folder

| File | Audience |
|------|----------|
| [REPORT.md](REPORT.md) | Human-readable summary of posture and method |
| [findings.md](findings.md) | Curated finding write-ups with post-fix status |
| [findings.json](findings.json) | Machine-readable summary records |

## Related remediations

Implemented alongside publication of this pack:

- Same-origin parent message gate; lock trusted parent origin; Confirm shows requester origin
- `OWSSigner.create` rejects cross-origin signer URLs
- Signing CSP documents and 1Shot wallet nginx/Vite CSP: `frame-ancestors 'self'`
- `OWSSigner.clearSession()` awaits `clearRecoverySession()`
- `showPrivateKey` / Copy require `document` visible and focused
