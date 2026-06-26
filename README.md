# Open Wallet Standard (OWS)

**1Shot API Open Wallet Standard** — open-source reference implementation for **WebAuthn PRF** non-custodial wallets. See the [1Shot API blog post](https://1shotapi.com/blog/rip-embedded-wallets-stop-paying-privy) for motivation.

OWS defines a three-layer iframe architecture: host app → wallet iframe → custody signer. The custody signer is published on-chain ([EIP-8244](https://github.com/TtheBC01/eip-8244)) as immutable plain JavaScript with zero dependencies.

## Architecture

```
Host (layer A)              @1shotapi/ows-provider          EIP-1193 for viem/ethers
  └── Wallet iframe (B)     @1shotapi/ows-wallet-utils      Your branding + signing UX
        └── Custody signer (C)  @1shotapi/ows-signer      KMS/HSM-style curve signing
              ▲
              └── @1shotapi/ows-signer-utils marshals EVM/Bitcoin/etc. → digest → sign
```

| Layer | Package | Published |
|-------|---------|-----------|
| C — Custody signer | `@1shotapi/ows-signer` | Yes (plain JS, on-chain) |
| B — Signer SDK | `@1shotapi/ows-signer-utils` | Yes |
| B — Wallet SDK | `@1shotapi/ows-wallet-utils` | Yes |
| A — Host provider | `@1shotapi/ows-provider` | Yes |
| C — On-chain deploy | `@1shotapi/ows-onchain` | Yes |
| Demos | `examples/*` | No |

Cross-frame messaging for host ↔ wallet uses [@1shotapi/postmate](https://github.com/1Shot-API/postmate) (external package, not vendored here).

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

```bash
# Terminal 1 — wallet iframe (layer B)
npm run dev -w @1shotapi/ows-example-wallet

# Terminal 2 — host app (layer A)
npm run dev -w @1shotapi/ows-example-host
```

See [examples/host/README.md](examples/host/README.md) for ngrok / HTTPS setup (required for passkeys).

## Repository layout

```
packages/
  ows-signer/           Plain JS custody signer — no build step
  ows-signer-utils/     Embed signer iframe; evm.signMessage(), etc.
  ows-wallet-utils/     Host ↔ wallet iframe (Postmate RPC wrappers)
  ows-provider/         EIP-1193 provider for host apps
  ows-onchain/          EIP-8244 compress → deploy → serve
examples/
  wallet-iframe/        Reference wallet wrapper (layer B)
  host/                 Reference host application (layer A)
```

## Custody signer design

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
