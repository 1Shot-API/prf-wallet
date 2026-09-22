---
"@1shotapi/ows-types": minor
---

Add `IAppendedCaveatConfiguration` and optional `caveats?: IAppendedCaveatConfiguration[]` on `IExecutionPermissionRequest`.

Hosts can now append extra caveats to a top-level EIP-7715 scope on a single delegation, mirroring `createDelegation({ scope, caveats })` in `@metamask/smart-accounts-kit`. The field is optional and additive, so existing requests are unchanged.
