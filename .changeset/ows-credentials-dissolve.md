---
"@1shotapi/ows-types": minor
"@1shotapi/ows-wallet-utils": minor
"@1shotapi/ows-provider": minor
"@1shotapi/ows-branding-core": patch
---

Fold verifiable credentials into core OWS packages: types and OID4 interfaces in `ows-types`, branding wire and SD-JWT presentation in `ows-wallet-utils`, host proxy and SD-JWT verify in `ows-provider`. Demo mocks move to `examples/credentials-shared` (not published). Removes `@1shotapi/ows-credentials`.
