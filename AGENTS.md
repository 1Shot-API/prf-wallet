# Agent instructions — Open Wallet Standard (OWS)

Monorepo: **1Shot API Open Wallet Standard** (`@1shotapi/open-wallet`).

## Stack

OWS uses three iframe layers: **Host Layer**, **Branding Layer**, and **Signing Layer**.

```
examples/host                 Host Layer — @1shotapi/ows-provider (EIP-1193)
examples/general-wallet       Branding Layer — React + Tailwind general-purpose wallet demo
packages/ows-signer           Signing Layer (plain JS, zero deps, on-chain)
packages/ows-signer-utils     Branding Layer ↔ Signing Layer (evm.signMessage, etc.)
packages/ows-types            Shared types, errors, and cross-layer utils (including SD-JWT VC)
packages/ows-oid4             Optional credentials add-on (CredentialsHelper, HTTP OID4 clients)
packages/ows-wallet-utils     Branding Layer Postmate/RPC wrappers; credentials wire hooks only
packages/ows-provider         Host Layer EIP-1193 + credentials proxy; SD-JWT verify
examples/shared               Demo-only OID4 mocks, stores, and fixtures (not published)
packages/ows-onchain          EIP-8244 deploy pipeline for ows-signer
spec/credentials/             OWS Credentials Extension normative docs
```

## Hard rules

1. **`packages/ows-signer` is plain JavaScript only.** No TypeScript, bundler, dependencies, or build step.
2. **Signing Layer signs curves/digests, not chain APIs.** EIP-191, EIP-712, etc. belong in `ows-signer-utils`.
3. **Host Layer must never embed the Signing Layer directly.** Always Host → Branding → Signing.
4. **Signing Layer accepts `postMessage` only when `event.source === window.parent` and `window.parent !== window.top`.**
5. **Do not vendor Postmate.** Use the `postmate` package from npm. Set iframe `allow` (WebAuthn, clipboard) before navigation — see `OWSProxy` / `createSignerIframe`.
6. **Examples are not published.**

## Code style

Prefer **methods on objects** over standalone exported functions when the logic belongs to a single class or module (e.g. serialize an RPC envelope inside `RpcHostClient`, not as a public `createRpcRequest` helper). Export free functions only when they are genuinely shared utilities with multiple independent call sites.

**No deprecations during active development.** OWS is pre-1.0 and not yet published for external consumers. When a pattern is renamed or superseded, update all call sites to the new API — do not leave `@deprecated` aliases, re-exports, or compatibility shims. Remove old names once migrations are complete.

Prefer Typescript interfaces over generic types. Prefix all interfaces with I, ie IHolderSigner. HolderSigner would be an implementation. Prefer enums over discriminated strings. Prefix enums with E, ie EEip1193Method.

Prefer **constructor parameter properties** for DTO / event / value-object classes instead of declaring fields and assigning them separately — it is shorter and easier to read:

```ts
// Prefer
class AccountCreatedEvent extends OWSAnalyticsEvent {
  constructor(
    hostDomain: DomainString,
    public readonly accountAddress: EVMAccountAddress,
  ) {
    super("AccountCreated", hostDomain);
  }
}

// Avoid
class AccountCreatedEvent extends OWSAnalyticsEvent {
  readonly accountAddress: EVMAccountAddress;
  constructor(hostDomain: DomainString, accountAddress: EVMAccountAddress) {
    super("AccountCreated", hostDomain);
    this.accountAddress = accountAddress;
  }
}
```

## Branded types

Use **branded primitives** from `@1shotapi/ows-types` (`ts-brand`) anywhere a value is semantically more than a raw `string`, `number`, or `bigint`.

**Always prefer a branded primitive over an unbranded `string`, `number`, or `bigint`.** Do not use raw primitives for domain values (addresses, call IDs, chain IDs, amounts, etc.) when a branded type exists or should exist in `ows-types`.

**Never union a branded type with its base primitive** (e.g. `EVMAccountAddress | string`, `DomainString | string`, `UnixTimestamp | number`). That defeats the brand — callers can pass unvalidated strings/numbers and TypeScript will not catch it. Accept only the branded type at API boundaries; brand at the validation/derivation site before calling.

- Define each primitive in `packages/ows-types/src/primitives/<Name>.ts` using the same pattern as `RPCCallId` (type alias + `make()` constructor).
- Export from `packages/ows-types/src/primitives/index.ts`.
- Examples: `EVMAccountAddress` (not `0x${string}` or viem `Address`), `EVMSignatureHex`, `SolanaAccountAddress`, `BitcoinSegwitAccountAddress`, `BitcoinChainId` (`"Bitcoin"` / `"BitcoinTestnet"`), `SolanaChainId`, `RPCCallId`.
- Narrow `OWSChainId` with `ChainUtils.isEVMChainId` / `isBitcoinChainId` / `isSolanaChainId` (see `packages/ows-types/src/utils/ChainUtils.ts`).
- Brand at the point of validation or derivation (e.g. Zod `.transform(EVMAccountAddress)`, or after `publicKeyToAddress`).
- For polymorphic APIs (e.g. EIP-1193 `request`), use a **mapped method table** (`EIP1193Requests` in `ows-types`) with a conditional generic on `request()` so callers get inferred branded results without `as` casts.

Do not introduce parallel branded types in consumer packages — add or extend primitives in `ows-types` instead.

## Tooling

- Node.js 22+, npm workspaces
- TypeScript packages: `tsc` → `dist/`
- Changesets for `@1shotapi/*` independent versioning
- On-chain: https://github.com/TtheBC01/eip-8244

## Common commands

```bash
npm install && npm run build && npm test
npm run dev -w @1shotapi/ows-example-general-wallet
npm run dev -w @1shotapi/ows-example-host
npm run dev -w @1shotapi/ows-example-credential-issuer
npm run dev -w @1shotapi/ows-example-credential-verifier
```

## Status

Bootstrapped; OWS signer logic and SDKs not yet implemented.

## Agent Skills

Branding Layer scaffolding skill (install in a consumer repo):

```bash
npx skills add 1Shot-API/open-wallet@ows-branding-layer
```

See [skills/ows-branding-layer](skills/ows-branding-layer/).
