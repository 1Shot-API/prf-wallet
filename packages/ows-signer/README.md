# @1shotapi/ows-signer

The **OWS custody signer** (layer C) — plain JavaScript, zero npm dependencies, no build step.

## Design

Minimal **KMS/HSM** iframe: WebAuthn PRF key custody, curve-based signing, optional export/recovery UI. Chain-specific marshalling lives in `@1shotapi/ows-signer-utils`.

## Deployment and rpId (hybrid)

- `rpId` is always **`window.location.hostname`** (the signer document origin).
- **Canonical CDN / on-chain gateway:** shared passkey namespace for all integrators on that host.
- **Per-brand rpId:** self-host or reverse-proxy signer HTML on your wallet origin.

## Nesting

Must be embedded as **iframe inside a wallet iframe** (not directly in the host). Rejects messages unless `window.parent !== window.top`.

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
| `signDigest` | `digestData`, `scheme`, `credentialId?` | `KeyDerived` (PRF path), `DigestSigned` |
| `revealPrivateKey` | `credentialId?` | `KeyDerived` (+ DOM display) |
| `createRecoveryData` | `passwordText`, `buttonText`, `minPasswordLength`, `credentialId?` | `KeyDerived`, `RecoveryDataCreated` |
| `recoverKey` | `aes256EncryptedPrivateKey`, `passwordText`, `buttonText`, `credentialId?` | DOM display; `RecoverySessionStarted` or re-bind → `RecoverySessionCleared` |
| `getPublicKey` | `credentialId?`, `challenge?` | `KeyDerived`, `PublicKey`, `ChallengeSigned?` |
| `clearRecoverySession` | — | `RecoverySessionCleared` |

Failure events: `NotAllowed`, `InvalidRequest`.

`createCredential` options:

- `rpName` — relying party display name in passkey UI (default `"OWS"`); does not affect `rpId`
- `userDisplayName` — friendly account label (defaults to `name`)
- `userId` — stable user handle bytes (base64); random if omitted

## Signing schemes

`secp256k1-ecdsa`, `secp256k1-ecdsa-recoverable`, `secp256k1-bip340` (not yet implemented), `ed25519`.

`digestData` is `0x`-prefixed hex. Hash schemes require 32 bytes.

## PRF labels

- `ows-v1/secp256k1`
- `ows-v1/ed25519` (derived via HKDF from PRF output)

## Recovery envelope

`ows1:0x…` — version byte, 16-byte salt, 12-byte IV, AES-GCM-256 ciphertext (PBKDF2-SHA256, 250k iterations).

## Recovery session

`recoverKey` caches the secp256k1 scalar in memory for subsequent `signDigest` calls without PRF. Cleared via `clearRecoverySession` or successful `credentialId` re-bind after recovery.

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

## Tests

```bash
npm test -w @1shotapi/ows-signer
```
