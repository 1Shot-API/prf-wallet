# OWS Signing Layer — Trusted Loader Plan

**Status:** Spec / design only — **tabled**. No implementation until revisited.

This document records how the Branding Layer can cryptographically confirm that the Signing Layer (`ows-signer`) bytes it loads match an official release, defeating cache poisoning and many MITM-adjacent failures beyond TLS alone.

---

## Goal

Raise the bar so an attacker must compromise **both**:

1. The Branding Layer (or its verifier), **and**
2. The Signing Layer payload (or its trust roots),

before a malicious custody kernel can run. HTTPS remains mandatory; integrity checks are defense-in-depth on top.

**Non-goal:** Fully defeating a malicious browser extension that can rewrite branding JS before the verifier runs. Document that limit honestly; design for dual-compromise cost and managed environments (WebView / no extensions) where the model is strongest.

---

## Why not “just HTTPS / ETag / getVersion”

| Mechanism | Integrity? | Role |
|-----------|------------|------|
| HTTPS/TLS | Transport only | Required baseline |
| ETag / Last-Modified | No | Cache validators, not signatures |
| `getVersion` RPC | No | Attestation after load; a malicious kernel can lie |
| SRI (`integrity=`) | Yes, per file | Useful building block; awkward alone for a multi-file ES module graph |
| Signed manifest + verify-before-execute | Yes | Primary client-side pattern |
| EIP-8244 on-chain artifact | Yes (pinned address) | Second, immutable trust root |

There is no W3C “sign this iframe app” API. The workable pattern is the same idea as the historical IPFS + trusted loader patent: **fetch → verify → only then execute**.

---

## Architecture

```
Release pipeline
  ows-signer sources (plain JS)
        │
        ├─► npm @1shotapi/ows-signer (verbatim bytes)
        ├─► signed manifest (file digests + signature)
        └─► ows-onchain / EIP-8244 (optional immutable html()/hash)

Branding Layer (ows-signer-utils)
  TrustedLoader
        │  1. Load trust root (embedded pubkey / pinned contract)
        │  2. Fetch manifest + signature (or embed at branding build time)
        │  3. Verify signature over manifest
        │  4. Fetch each listed file; SHA-384 (SRI-compatible) match
        │  5. Fail closed OR boot signer via blob URLs / verified bootstrap
        ▼
  Nested Signing Layer iframe (current nesting rules unchanged)
```

### Trust roots (pick at least one; prefer both)

1. **Publisher signed manifest** — Ed25519 (or Sigstore-style) over a canonical JSON manifest. Public key shipped in branding / `ows-signer-utils` config. Fast updates.
2. **On-chain pin** — EIP-8244 contract address + content hash for a given `signerVersion`. Branding compares fetched/gzipped bytes (or gateway output) to the pinned digest. Immutable second root.

For a given release, signed-manifest digests and on-chain hash **must agree**.

### Manifest sketch (illustrative)

```json
{
  "format": "ows-signer-manifest/v1",
  "signerVersion": "0.x.y",
  "apiVersion": 1,
  "hashAlg": "sha384",
  "files": [
    { "path": "html/index.html", "digest": "sha384-…" },
    { "path": "src/main.js", "digest": "sha384-…" }
  ],
  "onchain": {
    "chainId": 1,
    "contract": "0x…",
    "contentHash": "0x…"
  }
}
```

Signature covers a stable serialization of the manifest (exact encoding TBD at implementation time).

### Loader placement

| Piece | Package | Notes |
|-------|---------|--------|
| Signer sources + this plan | `ows-signer` | Kernel stays plain JS, zero deps |
| Manifest emit + on-chain hash | `ows-onchain` (+ release CI) | Same bytes as npm publish |
| `TrustedLoader` / `OWSSigner.create({ integrity })` | `ows-signer-utils` | Branding Layer owns verify-before-execute |
| Branding config (pubkey, allowed versions) | Integrator / general-wallet | Walmart pins official releases |

**Hard rule preserved:** Host never embeds Signing Layer directly. Loader runs in Branding Layer only.

---

## Threat model (summary)

**Mitigated or raised cost**

- CDN / reverse-proxy cache poisoning of signer assets
- Accidental wrong-version deploy behind a stable URL
- Passive MITM that cannot forge the publisher signature / on-chain hash
- Integrator proxy that forgets to update but still serves old pinned URL (fail closed if version/hash mismatch)

**Not fully mitigated**

- Extension or malware that patches branding **before** the loader runs
- Compromised branding build that ships a malicious trust root
- User ignoring fail-closed UI and forcing an unverified path (if any escape hatch exists — prefer none in production)

---

## Implementation phases (when un-tabled)

### Phase 0 — Spec freeze (this doc)

- [x] Record goals, trust roots, package boundaries, threat limits
- [ ] Choose signature format (raw Ed25519 vs Sigstore) and manifest canonicalization
- [ ] Decide boot strategy: blob URL document vs same-origin verified copy vs CSP+SRI-only for single-file gateway HTML

### Phase 1 — Release artifacts

- Emit `manifest.json` + detached signature from CI for every `ows-signer` release
- Content-address or pin digests for every file under `html/` and `src/`
- Align `ows-onchain` build so on-chain `contentHash` matches manifest

### Phase 2 — Branding loader (`ows-signer-utils`)

- `verifySignerRelease({ baseUrl | bytes, manifest, trust })` → fail closed
- Integrate into `OWSSigner.create` / iframe creation path
- Optional: embed last-known-good manifest in branding build for offline pin

### Phase 3 — Hardening

- Strict CSP on signer document — **baseline shipped** in branding hosts (e.g. 1Shot wallet nginx `/signer/`): `default-src 'none'`, `script-src`/`style-src 'self'`, `connect-src 'none'`, `base-uri 'none'`; **`frame-ancestors` omitted** for permissionless branding embeds. See package README. Future: per-file SRI / hashes when trusted-loader lands.
- Display signer fingerprint / version in branding UI during sensitive ops
- Document Walmart-style proxy: proxy official bytes, still run loader against pinned trust root
- Explicit “no unverified boot” production default

### Phase 4 — Optional

- Import-map + SRI where browser support is enough
- Isolated Web App / managed WebView guidance for extension-hostile deployments

---

## Open decisions (parked)

1. **Boot medium:** blob: iframe origin vs verified files on branding origin (affects `rpId` / WebAuthn hostname — must stay consistent with hybrid rpId model in README).
2. **Trust key rotation:** how branding learns new publisher keys without TOFU weakness.
3. **Dev mode:** local unsigned signer for `npm run dev` vs always-signed fixtures.
4. **Single-file on-chain HTML vs multi-file npm tree:** whether loader verifies gateway bootstrap only, or full module graph when self-hosting.

---

## Relation to existing code

- Nesting and `postMessage` rules in `README.md` stay as-is.
- `getVersion` remains a post-boot health/compat signal, **not** an integrity proof.
- `createSignerIframe` in `ows-signer-utils` is the natural insertion point for the loader.
- `packages/ows-onchain` is the planned immutable anchor; scaffold exists today.

---

## Recommendation when revisiting

Ship **signed manifest + verify-before-execute** first (works for npm/CDN/proxy). Add **EIP-8244 hash pin** as the second root once the on-chain pipeline emits stable digests. Treat extension resistance as operational (managed browsers) plus dual-layer compromise cost, not as a solved web-platform problem.
