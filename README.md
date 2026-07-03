# Open Wallet Standard (OWS)

**1Shot API Open Wallet Standard** — open-source reference implementation for **WebAuthn PRF** non-custodial wallets. See the [1Shot API blog post](https://1shotapi.com/blog/rip-embedded-wallets-stop-paying-privy) for motivation.

OWS defines a three-layer iframe architecture: **Host Layer** → **Branding Layer** → **Signing Layer**. The Signing Layer is published on-chain ([EIP-8244](https://github.com/TtheBC01/eip-8244)) as immutable plain JavaScript with zero dependencies.

## Architecture

```
Host Layer                  @1shotapi/ows-provider          EIP-1193 for viem/ethers
  └── Branding Layer        @1shotapi/ows-wallet-utils      Your branding + signing UX
        └── Signing Layer   @1shotapi/ows-signer            KMS/HSM-style curve signing
              ▲
              └── @1shotapi/ows-signer-utils marshals EVM/Bitcoin/etc. → digest → sign
```

| Layer | Package | Published |
|-------|---------|-----------|
| Shared types | `@1shotapi/ows-types` | Yes |
| Signing Layer | `@1shotapi/ows-signer` | Yes (plain JS, on-chain) |
| Branding ↔ Signing SDK | `@1shotapi/ows-signer-utils` | Yes |
| Host ↔ Branding SDK | `@1shotapi/ows-wallet-utils` | Yes |
| Host Layer provider | `@1shotapi/ows-provider` | Yes |
| On-chain deploy | `@1shotapi/ows-onchain` | Yes |
| Demos | `examples/*` | No |

Cross-frame messaging for Host ↔ Branding uses [@1shotapi/postmate](https://github.com/1Shot-API/postmate) (external package, not vendored here).

## Quick start

**Requirements:** Node.js 22+

```bash
git clone https://github.com/1Shot-API/open-wallet.git
cd open-wallet
npm install
npm run build
npm test
```

### Run the OWS demos

Copy [`.env.example`](.env.example) to `.env` and set `NGROK_AUTHTOKEN` and optionally `NGROK_DOMAIN` (your reserved ngrok domain) for HTTPS passkey testing.

```bash
# Terminal 1 — general-purpose Branding Layer + Signing Layer (single ngrok tunnel)
npm run dev:general-wallet

# Terminal 2 — Host Layer app (reads NGROK_DOMAIN from repo root .env)
npm run dev -w @1shotapi/ows-example-host
```

See [examples/general-wallet/README.md](examples/general-wallet/README.md) and [examples/host/README.md](examples/host/README.md) for details.

## Repository layout

```
packages/
  ows-types/            Shared types and errors (all layers)
  ows-signer/           Plain JS Signing Layer — no build step
  ows-signer-utils/     Branding Layer ↔ Signing Layer (evm.signMessage, etc.)
  ows-wallet-utils/     Host Layer ↔ Branding Layer (Postmate RPC wrappers)
  ows-branding-core/    Branding module contracts + install helpers
  ows-registry/         Copy-paste Branding Layer UI modules (registry)
  ows-provider/         EIP-1193 provider for Host Layer apps
  ows-onchain/          EIP-8244 compress → deploy → serve
examples/
  general-wallet/       General-purpose Branding Layer demo (MetaMask-style)
  host/                 Host Layer reference application
```

## Signing Layer design

`@1shotapi/ows-signer` is intentionally minimal — a **curve-based signing primitive** (starting with secp256k1), not a chain-aware wallet. Chain-specific marshalling (EIP-191, EIP-712, etc.) lives in `@1shotapi/ows-signer-utils` so the on-chain artifact stays small and stable.

## Monorepo tooling

npm workspaces + [Changesets](https://github.com/changesets/changesets) for independent `@1shotapi/*` package versioning.

```bash
npm run changeset          # describe a change
npm run version-packages   # bump versions + changelogs
npm run release            # build + publish to npm
```

## Status

**Scaffold only** — package structure and OWS branding are in place. Signer logic, SDKs, and on-chain pipeline are forthcoming.

## License

MIT — see [LICENSE](LICENSE).
