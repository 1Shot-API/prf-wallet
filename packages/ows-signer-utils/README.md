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
const [sig] = await signer.evm.signMessage(["hello"]);
const [typedSig] = await signer.evm.signTypedData([
  {
    domain: { name: "App", version: "1", chainId: 1, verifyingContract: "0x…" },
    types: { … },
    primaryType: "Mail",
    message: { … },
  },
]);

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

### Signer display (passkey Confirm / passphrase)

`OWSSigner` automatically shows a centered visible ceremony panel (`showSignerCeremonyPanel`) for WebAuthn Confirm UI and recovery passphrase/reveal. Callers do **not** need a 1×1 invisible focus layer.

| Helper | Purpose |
|--------|---------|
| `showSignerCeremonyPanel(iframe)` | Centered visible panel (used internally by `OWSSigner`). Returns a restore function. |
| `overlaySignerIframe(iframe, slot, options?)` | Optional slot-aligned overlay if you still need to pin the iframe over a specific element (prefer the auto panel for new code). |

Pass optional `explanationHeader` / `explanationText` / `confirmButtonText` / `denyButtonText` on ceremony RPCs. Cancel emits `SignDenied` → `OwsSignDeniedError`.

### EIP-1193 signing (`SignHelper`)

Headless `personal_sign` / `eth_signTypedData*` / `eth_sendTransaction` orchestration (display → consent → sign for messages; send delegates to branding `approveAndSignTransaction`). Does not register handlers — the branding app owns order:

```typescript
import { SignHelper, prepareEvmTransaction } from "@1shotapi/ows-signer-utils";

const signHelper = new SignHelper(signer, wallet, {
  ensureReady: ensureOnboardedForSigning, // setup only if no credential
  onAuthenticated, // mark unlocked after message/typed-data ceremonies
  getChainId: () => rpcHelper.getChainId(),
  requestPersonalSignApproval,
  requestSignTypedDataApproval,
  approveAndSignTransaction, // consent + prepare + sign + broadcast → hash
});
for (const [method, handler] of Object.entries(signHelper.handlers)) {
  wallet.registerEip1193(method, handler);
}
```

Export `prepareEvmTransaction(chainRpc, account, tx)` for branding / relayer submit paths. Consent UI stays app-owned (see `examples/general-wallet` approval dialog).

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
| `createCredential(name, options?)` | Register passkey; options include `rpName`, ceremony UI fields |
| `signDigest(digests[], options?)` | Sign digests under one ceremony (`credentialId` + ceremony UI) |
| `executeBatch(params)` | Mixed ceremony: digests + AES + public key + optional WebAuthn `challenge` |
| `getPublicKey(params?)` | Derive keys; optional `challenge` / ceremony UI |
| `createRecoveryData(..., options?)` | Encrypt recovery blob (ceremony UI + `credentialId`) |
| `recoverKey(..., options?)` | Decrypt recovery blob into session |
| `revealPrivateKey(options?)` | Signer UI to reveal key (stays open until Done) |
| `importPrivateKey()` | Signer UI to paste hex key → recovery session |
| `clearRecoverySession()` | End recovery session |
| `encryptAES256(plaintexts, options?)` | Batch AES-256-GCM seal (`ows-aes1:`) |
| `decryptAES256(ciphertexts, options?)` | Batch AES-256-GCM unseal |

### `signer.evm`

| Method | Description |
|--------|-------------|
| `getAccountAddress()` | Ethereum address from secp256k1 public key |
| `signMessage(messages[], options?)` | EIP-191 personal sign (batch) |
| `signTypedData(typedDataList[], options?)` | EIP-712 (batch) |
| `signTransaction(transactions[], options?)` | Signed serialized tx hex (batch) |
| `signAuthorization(authorizations[], options?)` | EIP-7702 authorization (batch) |

All EVM batch methods accept optional `{ credentialId, explanationHeader, … }` once for the whole batch.

### `signer.solana`

| Method | Description |
|--------|-------------|
| `getAccountAddress()` | Solana address (base58 ed25519 public key) |

Accepts optional `{ credentialId }` per call.

### Errors

- `OwsNotAllowedError` — WebAuthn cancelled or policy blocked
- `OwsSignDeniedError` — user cancelled Signing Layer Confirm UI (before WebAuthn)
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
