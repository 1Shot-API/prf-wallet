---
"@1shotapi/ows-provider": patch
"@1shotapi/ows-wallet-utils": patch
"@1shotapi/ows-signer-utils": patch
"@1shotapi/ows-oid4": patch
---

Replace bare `"*"` internal deps with `workspace:^` and enable Changesets `updateInternalDependents: "always"`.

Bare `"*"` stayed in published tarballs and let consumers resolve an older `ows-types` without `BITCOIN_WIRE_METHODS`. Workspace protocol + version-packages keeps published ranges pinned to the versions in each release.
