# OWS Credentials — Provider methods

Credential operations are exposed only through the **`credentials` namespace**. They do not use generic `proxy.rpc()` or `wallet.registerRpc()`.

## Host API (`proxy.credentials`)

```ts
const proxy = await OWSProxy.create(container, walletUrl);

await proxy.credentials.acceptOffer(input);
await proxy.credentials.present(input);
await proxy.credentials.list(filter?);
await proxy.credentials.delete(input);
```

## Branding API (`wallet.credentials`)

Handlers must be registered **before** `wallet.start()`:

```ts
wallet.credentials.register({
  acceptOffer: async (input) => { /* … */ },
  present: async (input) => { /* … */ },
  list: async (filter) => { /* … */ },
  delete: async (input) => { /* … */ },
});
```

## Wire transport

Calls use the standard OWS `RpcRequestEnvelope` / `ows:rpcCallback` protocol. Postmate model keys are **namespaced**:

| Public method | Wire key |
|---------------|----------|
| `acceptOffer` | `credentials.acceptOffer` |
| `present` | `credentials.present` |
| `list` | `credentials.list` |
| `delete` | `credentials.delete` |

## Methods

### `acceptOffer`

OID4VCI-style credential issuance (stub accepts mock or inline offers).

**Input:**

```json
{
  "credentialOfferUri": "mock://kyc-offer/demo",
  "offer": { }
}
```

Either `credentialOfferUri` or inline `offer` may be provided.

**Result:**

```json
{
  "credentialId": "cred_mock_kyc_001",
  "format": "sd-jwt-vc",
  "type": ["VerifiableCredential", "KycCredential"]
}
```

### `present`

OID4VP-style presentation to a verifier.

**Input:**

```json
{
  "requestUri": "mock://kyc-presentation/demo",
  "request": { }
}
```

**Result:**

```json
{
  "presentation": "MOCK_PRESENTATION_BLOB",
  "format": "sd-jwt-vc",
  "disclosedClaims": ["ageOver18", "country"]
}
```

### `list`

Returns credential summaries (no full credential payloads by default).

**Input (optional):**

```json
{
  "type": "KycCredential",
  "issuer": "https://issuer.example"
}
```

**Result:** array of `CredentialSummary`.

### `delete`

Removes a stored credential.

**Input:**

```json
{
  "credentialId": "cred_mock_kyc_001"
}
```

**Result:** `null` (void).

## Errors

| Code | Meaning |
|------|---------|
| `4001` | User rejected consent |
| `-32602` | Invalid params |
| `-32601` | Credentials namespace not registered |
| `-32603` | Internal / mock flow error |

## Display lifecycle

Interactive methods (`acceptOffer`, `present`) should call `wallet.requestDisplay()` before WebAuthn or consent UI, and release the display session when done. The host auto-focuses the wallet iframe on RPC; explicit display is still recommended for cross-origin embeds.
