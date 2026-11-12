---
"@1shotapi/ows-types": minor
"@1shotapi/ows-clear-signing": minor
---

Add ERC-7730 clear signing. `@1shotapi/ows-types` gains the `EVMFunctionSelector`, `EIP712EncodeTypeHash`, `EIP712TypeName` and `ClearSigningRegistrySha` primitives, the `EClearSigningFieldFormat` / `EClearSigningVisibility` / `EClearSigningIteration` enums, resolved-descriptor interfaces, and `ClearSigningLookupResultSchema` for Relayer `GET /clear-signing/*` responses. New `@1shotapi/ows-clear-signing` computes registry lookup keys (`ClearSigningUtils`) and renders a resolved descriptor against a transaction or EIP-712 message (`ClearSigningFormatter`), re-verifying contract/domain binding, selector and type hash locally.
