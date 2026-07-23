# @1shotapi/ows-signer

The **OWS Signing Layer** — plain JavaScript, zero npm dependencies, no build step.

## Design

Minimal **KMS/HSM** iframe: WebAuthn PRF key custody, curve-based signing, optional export/recovery UI. Chain-specific marshalling lives in `@1shotapi/ows-signer-utils`.

## Deployment and rpId (hybrid)

- `rpId` is always **`window.location.hostname`** (the signer document origin).
- **Canonical CDN / on-chain gateway:** shared passkey namespace for all integrators on that host.
- **Per-brand rpId:** self-host or reverse-proxy signer HTML on your branding origin.

## Nesting

Must be embedded as **iframe inside a Branding Layer iframe** (not directly in the host). Rejects messages unless `window.parent !== window.top`.

## Wire protocol

Parent → signer:

```json
{ "v": 1, "kind": "request", "method": "signDigest", "correlationId": "…", "params": { } }
```

Signer → parent:

```json
{ "v": 1, "kind": "event", "event": "DigestSigned", "correlationId": "…", "data": { } }
```

Only accepts messages when `event.source === window.parent`. Replies use the parent's `event.origin` as `targetOrigin`.

## Methods

| Method | Params | Success events |
|--------|--------|----------------|
| `getVersion` | — | `Version` |
| `createCredential` | `name`, `options?` (`rpName`, `userDisplayName`, `userId`) | `KeyDerived`, `CredentialCreated` |
| `signDigest` | `digests[]` (`digestData`, `scheme`), `credentialId?` | `KeyDerived` (PRF path), `DigestSigned` (`results[]`) |
| `executeBatch` | `digests?`, `plaintexts?`, `ciphertexts?`, `includePublicKey?`, `challenge?`, `credentialId?` | `KeyDerived` (when keys derived), `BatchExecuted` |
| `revealPrivateKey` | `credentialId?` | `KeyDerived` (+ DOM display) |
| `createRecoveryData` | `passwordText`, `buttonText`, `minPasswordLength`, `credentialId?` | `KeyDerived`, `RecoveryDataCreated` |
| `recoverKey` | `aes256EncryptedPrivateKey`, `passwordText`, `buttonText`, `credentialId?` | DOM display; `RecoverySessionStarted` or re-bind → `RecoverySessionCleared` |
| `getPublicKey` | `credentialId?`, `challenge?` | `KeyDerived`, `PublicKey`, `ChallengeSigned?` |
| `clearRecoverySession` | — | `RecoverySessionCleared` |
| `encryptAES256` | `plaintexts[]`, `credentialId?` | `KeyDerived` (PRF path), `AES256Encrypted` |
| `decryptAES256` | `ciphertexts[]`, `credentialId?` | `KeyDerived` (PRF path), `AES256Decrypted` |

Failure events: `NotAllowed`, `InvalidRequest`.

`createCredential` options:

- `rpName` — relying party display name in passkey UI (default `"OWS"`); does not affect `rpId`
- `userDisplayName` — friendly account label (defaults to `name`)
- `userId` — stable user handle bytes (base64); random if omitted

## Signing schemes

`secp256k1-ecdsa`, `secp256k1-ecdsa-recoverable`, `secp256k1-bip340` (not yet implemented), `ed25519`.

`digestData` is `0x`-prefixed hex. Hash schemes require 32 bytes. `signDigest` and `executeBatch` take **arrays** of digests so one passkey ceremony covers many signatures. Empty `digests` arrays succeed without a ceremony. `executeBatch` with a `challenge` always forces a real WebAuthn assertion (recovery session alone cannot produce an assertion signature).

## PRF labels

- `ows-v1/secp256k1`
- `ows-v1/ed25519` (derived via HKDF from PRF output)
- `ows-v1/aes256-gcm` (HKDF from the secp256k1 scalar — same material as `signDigest`)

## Recovery envelope

`ows1:0x…` — version byte, 16-byte salt, 12-byte IV, AES-GCM-256 ciphertext (PBKDF2-SHA256, 250k iterations).

## AES-256 seal envelope (credentials / general payload)

`ows-aes1:0x…` — version byte, 12-byte IV, AES-GCM-256 ciphertext+tag. Key is HKDF-SHA256 of the wallet secp256k1 scalar with info `ows-v1/aes256-gcm` (no PBKDF2). Works under a recovery session without a new WebAuthn ceremony. Batch methods amortize one ceremony across many plaintexts/ciphertexts.

## Recovery session

`recoverKey` caches the secp256k1 scalar in memory for subsequent `signDigest` / `encryptAES256` / `decryptAES256` / `executeBatch` (without `challenge`) calls without PRF. Cleared via `clearRecoverySession` or successful `credentialId` re-bind after recovery.

## Layout

```
html/index.html           Entry document
src/main.js               Bootstrap + message listener
src/handlers.js           RPC dispatch
src/webauthn.js           Passkey ceremonies
src/crypto/               PRF, signing, recovery
src/crypto/vendor/        Vendored @noble/secp256k1 + ed25519 (MIT)
reference/                1ShotPay reference (not published)
```

## On-chain

See `@1shotapi/ows-onchain`.

## Integrity (planned)

Client-side confirmation that official signer bytes are loaded (signed manifest + verify-before-execute, optional EIP-8244 pin) is **specced and tabled** — see [docs/trusted-loader-plan.md](docs/trusted-loader-plan.md). Not implemented yet.

## Tests

```bash
npm test -w @1shotapi/ows-signer
```
