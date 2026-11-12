# @1shotapi/ows-clear-signing

ERC-7730 clear signing for OWS Branding Layers.

The 1Shot Relayer keeps a synced copy of the
[ERC-7730 registry](https://github.com/ethereum/clear-signing-erc7730-registry) and serves one
**resolved** descriptor per request (`includes` merged, definitions inlined, trimmed to the matching
format). This package does everything wallet-side:

- `ClearSigningUtils.calldataLookupKey(chainId, to, data)`: `{ chainId, address, selector }` for `GET /clear-signing/calldata`
- `ClearSigningUtils.eip712LookupKey(typedData)`: `{ chainId, verifyingContract, primaryType, encodeTypeHash }` for `GET /clear-signing/eip712`
- `ClearSigningFormatter`: renders a resolved descriptor into an `IClearSigningDisplay` (intent, interpolated intent, labeled fields)

Validate Relayer responses with `ClearSigningLookupResultSchema` from `@1shotapi/ows-types`.

## Trust model

The formatter re-verifies everything it can locally, so a compromised resolver can only change
labels. It can never change the decoded values shown to the user.

- **Calldata:** `context.contract.deployments` must contain `(chainId, to)`. The selector of `format.key` must equal `data[0:4]`. Arguments are decoded by the wallet from `format.key`.
- **EIP-712:** the domain must have `chainId` and `verifyingContract`. The `context.eip712` deployments, domain and `domainSeparator` constraints must hold. `format.key` must equal `encodeType(primaryType)`.

Any failure throws `ClearSigningError`. Callers MUST then fall back to their generic signing UI.

## Usage

```ts
import { ClearSigningFormatter, ClearSigningUtils } from "@1shotapi/ows-clear-signing";
import { ClearSigningLookupResultSchema } from "@1shotapi/ows-types";

const key = ClearSigningUtils.calldataLookupKey(chainId, to, data);
const result = ClearSigningLookupResultSchema.parse(await (await fetch(url)).json());
if (result.found) {
  const formatter = new ClearSigningFormatter(environment); // IClearSigningEnvironment
  const display = await formatter.formatCalldata(result.descriptor, { chainId, from, to, data, value });
}
```

`IClearSigningEnvironment` supplies the following, each returning `null` when unknown:

- token metadata
- the native currency
- chain names
- address names

The formatter does no network I/O of its own.

## Supported formats

- Fully supported: `raw`, `amount`, `tokenAmount` (threshold/message, `nativeCurrencyAddress`, `chainId`), `addressName` ("You" for the signer, `senderAddress`), `tokenTicker`, `nftName`, `date` (timestamp, blockheight), `duration`, `unit` (with SI prefixes), `enum`, `chainId`.
- `calldata`: rendered as "Embedded call to …" without recursive decoding.
- `interoperableAddressName`: rendered raw.

Paths support the `#.`, `@.` and `$.` roots, as well as relative paths, indices, negative indices, byte and array slices, `[]` iteration, groups (`sequential` / `bundled`), array-indexed params, `metadata.maps` references, and `visible` rules (`never` / `optional` / `ifNotIn` / `mustMatch`).
