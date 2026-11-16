---
"@1shotapi/ows-provider": minor
"@1shotapi/ows-types": patch
---

Add an EVM-only entry point, `@1shotapi/ows-provider/evm`, exporting `OWSProxyCore` (Branding iframe, `ethereum` EIP-1193 provider, `rpc`, display, analytics). `OWSProxy` now extends `OWSProxyCore` and adds the `credentials`, `bitcoin`, and `solana` namespaces; its public API is unchanged. Both packages declare `"sideEffects": false`, and the zod schemas on the Host RPC path in `ows-types` are marked pure, so the `/evm` entry bundles to about 7 KB gzipped instead of about 100 KB.
