# @1shotapi/ows-signer-utils

Typed, browser-only SDK for **Branding Layer** authors: embed the OWS Signing Layer iframe, speak the OWS v1 `postMessage` protocol, and expose `OWSSigner` with passkey/recovery helpers plus a Viem-aligned `signer.evm` namespace.

## Install

```bash
npm install @1shotapi/ows-signer-utils viem
```

`viem` is a **peer dependency** (^2.x). This package uses viem for EIP-191/712/transaction/7702 hashing, serialization, and types — not as a wallet client.

## Quick start

```typescript
import { OWSSigner, toViemLocalAccount } from "@1shotapi/ows-signer-utils";

const container = document.getElementById("signer-slot")!;
const signer = await OWSSigner.create(
  container,
  "https://your-signer.example/signer.html",
  { credentialId: optionalExistingId },
);

await signer.createCredential("my-wallet", { rpName: "MyBrand" });

const address = await signer.evm.getAccountAddress();
const sig = await signer.evm.signMessage({ message: "hello" });
const typedSig = await signer.evm.signTypedData({
  domain: { name: "App", version: "1", chainId: 1, verifyingContract: "0x…" },
  types: { … },
  primaryType: "Mail",
  message: { … },
});

// Optional: viem LocalAccount for smart-account kits
const account = await toViemLocalAccount(signer);
```

## Architecture

```
Host Layer  →  Branding Layer  →  Signing Layer
                      ↑
              @1shotapi/ows-signer-utils
```

This package runs in the **Branding Layer**. It must not be used from the host page directly — the Signing Layer requires the branding iframe for correct WebAuthn / iframe nesting.

Outbound RPC: `iframe.contentWindow.postMessage(request, signerOrigin)`  
Inbound events: validate `event.origin === signerOrigin` and `event.source === iframe.contentWindow`.

## Iframe requirements

- Parent page must be a [secure context](https://developer.mozilla.org/en-US/docs/Web/Security/Secure_Contexts) (HTTPS or localhost).
- The iframe is created with `allow="publickey-credentials-get *"` for passkey ceremonies.
- Do **not** add a restrictive `sandbox` that blocks WebAuthn.
- Default iframe size is hidden (`0×0`); pass `{ hidden: false }` to show it.

### Showing the signer over UI (passphrase / recovery)

Do **not** reparent the signer iframe into a dialog — that can reload the iframe document and drop in-flight RPCs. Use:

| Helper | Purpose |
|--------|---------|
| `overlaySignerIframe(iframe, slot, options?)` | Visible overlay: position the iframe's home container over a slot (e.g. backup dialog). Returns a restore function. |
| `prepareSignerIframeForWebAuthn(iframe)` | Invisible 1×1 focus layer for passkey ceremonies (used internally by `OWSSigner`). |

```typescript
import { overlaySignerIframe } from "@1shotapi/ows-signer-utils";

const restore = overlaySignerIframe(iframe, signerSlot, {
  homeContainer: document.getElementById("signer-container")!,
});
try {
  await signer.createRecoveryData(/* … */);
} finally {
  restore();
}
```

## API

### `OWSSigner.create(container, signerUrl, options?)`

| Option | Description |
|--------|-------------|
| `credentialId` | Existing WebAuthn credential id |
| `hidden` | Hide iframe (default `true`) |
| `rpcTimeoutMs` | RPC timeout (default 120s) |

### Root methods (Signing Layer passthrough)

| Method | Description |
|--------|-------------|
| `getVersion()` | Signer API/version info |
| `createCredential(name, options?)` | Register passkey; options include `rpName`, `userDisplayName`, `userId` |
| `signDigest(digest, scheme?, credentialId?)` | Sign a 32-byte `0x` digest |
| `getPublicKey(params?)` | Derive keys; optional `challenge` for `ChallengeSigned` |
| `createRecoveryData(...)` | Encrypt recovery blob |
| `recoverKey(...)` | Decrypt recovery blob into session |
| `revealPrivateKey(credentialId?)` | Signer UI to reveal key |
| `clearRecoverySession()` | End recovery session |

### `signer.evm`

| Method | Description |
|--------|-------------|
| `getAccountAddress()` | Ethereum address from secp256k1 public key |
| `signMessage({ message })` | EIP-191 personal sign |
| `signTypedData(typedData)` | EIP-712 |
| `signTransaction(transaction)` | Returns signed serialized tx hex |
| `signAuthorization(authorization)` | EIP-7702 authorization |

All EVM methods accept optional `{ credentialId }` per call.

### `signer.solana`

| Method | Description |
|--------|-------------|
| `getAccountAddress()` | Solana address (base58 ed25519 public key) |

Accepts optional `{ credentialId }` per call.

### Errors

- `OwsNotAllowedError` — user cancelled or policy blocked
- `OwsInvalidRequestError` — bad params
- `OwsTimeoutError` — RPC timeout

## Related packages

| Package | Role |
|---------|------|
| `@1shotapi/ows-signer` | Plain JS Signing Layer |
| `@1shotapi/ows-wallet-utils` | Host Layer ↔ Branding Layer messaging |
| `@1shotapi/ows-provider` | EIP-1193 provider for Host Layer apps |

## License

MIT
